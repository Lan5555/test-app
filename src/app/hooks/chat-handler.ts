"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  attachments?: string[];
  createdAt: string;
  status: "sending" | "sent" | "delivered" | "read";
  clientId?: string;
}

export interface RoomMember {
  id: string;
  name: string;
  online: boolean;
}

export interface Room {
  id: string;
  name: string;
  isGroup: boolean;
  memberIds: string[];
  code?: string;
}

function makeClientId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChatSocket(accessToken: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [membersByRoom, setMembersByRoom] = useState<Record<string, RoomMember[]>>({});
  const [typingByRoom, setTypingByRoom] = useState<Record<string, string[]>>({});
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const [rooms, setRooms] = useState<Room[]>([]);
  
  const activeRoomsRef = useRef<Set<string>>(new Set());
  const isMounted = useRef(true);
  const historyReceivedRef = useRef<Set<string>>(new Set());
  const isConnectingRef = useRef(false);
  const pendingRoomRef = useRef<Room | null>(null); // ✅ Track pending room

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    const socket = io(`${process.env.NEXT_PUBLIC_WS_URL}/chat`, {
      auth: { token: accessToken },
      transports: ["websocket"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      forceNew: true,
    });
    
    socketRef.current = socket;

    socket.on("connect", () => {
      if (isMounted.current) setConnected(true);
      isConnectingRef.current = false;
      
      // ✅ If there's a pending room, emit it again
      if (pendingRoomRef.current) {
        console.log("🔄 Re-emitting pending room creation...");
        socket.emit("room:create", pendingRoomRef.current);
        pendingRoomRef.current = null;
      }
    });

    socket.on("disconnect", () => {
      if (isMounted.current) setConnected(false);
    });

    socket.on("connect_error", (err) => {
      isConnectingRef.current = false;
    });

    socket.on("connected", ({ userId }: { userId: string }) => {
      if (isMounted.current) setCurrentUserId(userId);
    });

    socket.on("rooms:list", ({ rooms }: { rooms: Room[] }) => {
      if (isMounted.current) {
        setRooms(rooms);
        historyReceivedRef.current.clear();
        if (rooms.length > 0) {
          console.log("🔵 Auto-joining first room:", rooms[0].id);
          socket.emit("room:join", { roomId: rooms[0].id });
        }
      }
    });

    // ✅ FIXED: Handle room creation - FORCE update state
    socket.on("room:created", ({ room }: { room: Room }) => {
      console.log("🔵 Room created event received:", room);
      console.log("🔵 Current rooms before update:", rooms);
      
      if (isMounted.current) {
        // ✅ Use functional update to ensure we have the latest state
        setRooms((prevRooms) => {
          // Check if room already exists
          if (prevRooms.some(r => r.id === room.id)) {
            console.log("⚠️ Room already exists:", room.id);
            return prevRooms;
          }
          
          // ✅ Create new array with the room added
          const newRooms = [...prevRooms, room];
          console.log("✅ Updated rooms (new length):", newRooms.length);
          console.log("✅ New rooms array:", newRooms);
          
          // ✅ If this is the first room, auto-select it
          if (newRooms.length === 1) {
            console.log("🔵 First room created, auto-joining:", room.id);
            setTimeout(() => {
              socket.emit("room:join", { roomId: room.id });
            }, 100);
          }
          
          return newRooms;
        });
        
        // Clear history cache for new room
        historyReceivedRef.current.delete(room.id);
        
        // Join the room
        socket.emit("room:join", { roomId: room.id });
      }
    });

    // Handle room history
    socket.on("room:history", ({ roomId, roomName, messages, members }) => {
      console.log("📜 Room history received for:", roomId, "messages:", messages?.length);
      if (isMounted.current) {
        if (historyReceivedRef.current.has(roomId)) {
          return;
        }
        historyReceivedRef.current.add(roomId);
        
        setMessagesByRoom((prev) => ({ ...prev, [roomId]: messages || [] }));
        setMembersByRoom((prev) => ({ ...prev, [roomId]: members || [] }));
      }
    });

    // Handle new message
    socket.on("message:new", (message: ChatMessage) => {
      console.log("💬 New message received:", message);
      if (isMounted.current) {
        setMessagesByRoom((prev) => {
          const existing = prev[message.roomId] || [];
          const optimisticIndex = message.clientId
            ? existing.findIndex((m) => m.clientId === message.clientId)
            : -1;

          const next =
            optimisticIndex >= 0
              ? existing.map((m, i) => (i === optimisticIndex ? message : m))
              : [...existing, message];

          return { ...prev, [message.roomId]: next };
        });
      }
    });

    socket.on("message:status", ({ messageId, status }) => {
      if (isMounted.current) {
        setMessagesByRoom((prev) => {
          const next = { ...prev };
          for (const roomId of Object.keys(next)) {
            next[roomId] = next[roomId].map((m) => 
              m.id === messageId ? { ...m, status } : m
            );
          }
          return next;
        });
      }
    });

    socket.on("message:status:bulk", ({ roomId, messageIds, status }) => {
      if (isMounted.current) {
        setMessagesByRoom((prev) => ({
          ...prev,
          [roomId]: (prev[roomId] || []).map((m) => 
            messageIds.includes(m.id) ? { ...m, status } : m
          ),
        }));
      }
    });

    socket.on("typing:update", ({ roomId, userId, isTyping }) => {
      if (isMounted.current) {
        setTypingByRoom((prev) => {
          const current = prev[roomId] || [];
          const next = isTyping 
            ? Array.from(new Set([...current, userId])) 
            : current.filter((id) => id !== userId);
          return { ...prev, [roomId]: next };
        });
      }
    });

    socket.on("presence:update", ({ userId, online }) => {
      if (isMounted.current) {
        setPresence((prev) => ({ ...prev, [userId]: online }));
        
        setMembersByRoom((prev) => {
          const next = { ...prev };
          for (const roomId of Object.keys(next)) {
            next[roomId] = next[roomId].map(member => 
              member.id === userId ? { ...member, online } : member
            );
          }
          return next;
        });
      }
    });

    // Handle member joined
    socket.on("room:member-joined", ({ roomId, userId, members }) => {
      console.log("👤 Member joined room:", roomId, userId);
      if (isMounted.current) {
        setMembersByRoom((prev) => ({ ...prev, [roomId]: members }));
        setPresence((prev) => ({ ...prev, [userId]: true }));
      }
    });

    socket.on("error", (err: { message: string }) => {
      console.error("❌ Chat socket error:", err.message);
    });

    return () => {
      isConnectingRef.current = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      activeRoomsRef.current.clear();
      historyReceivedRef.current.clear();
    };
  }, [accessToken]);

  const joinRoom = useCallback((roomId: string) => {
    if (!socketRef.current) return;
    historyReceivedRef.current.delete(roomId);
    if (!activeRoomsRef.current.has(roomId)) {
      activeRoomsRef.current.add(roomId);
      console.log("🔵 Joining room:", roomId);
      socketRef.current.emit("room:join", { roomId });
    }
  }, []);

  const leaveRoom = useCallback((roomId: string) => {
    if (!socketRef.current) return;
    activeRoomsRef.current.delete(roomId);
    historyReceivedRef.current.delete(roomId);
    socketRef.current.emit("room:leave", { roomId });
    
    setTimeout(() => {
      if (isMounted.current) {
        setMessagesByRoom((prev) => {
          const next = { ...prev };
          delete next[roomId];
          return next;
        });
        setMembersByRoom((prev) => {
          const next = { ...prev };
          delete next[roomId];
          return next;
        });
        setTypingByRoom((prev) => {
          const next = { ...prev };
          delete next[roomId];
          return next;
        });
      }
    }, 5000);
  }, []);

  // ✅ FIXED: Create room with proper error handling
  const createRoom = useCallback((name: string, isGroup: boolean, memberIds: string[]) => {
    if (!socketRef.current) {
      console.error("❌ Socket not connected - saving room to pending");
      pendingRoomRef.current = { name, isGroup, memberIds } as Room;
      return;
    }
    
    const stringMemberIds = memberIds.map(id => String(id));
    console.log("🔵 Creating room:", { name, isGroup, memberIds: stringMemberIds });
    
    // ✅ Clear pending room
    pendingRoomRef.current = null;
    
    socketRef.current.emit("room:create", { 
      name, 
      isGroup, 
      memberIds: stringMemberIds 
    }, (response: { success: boolean; data: Room }) => {
      console.log("🔵 Room create response:", response);
      if (response?.success && response.data) {
        console.log("✅ Room created successfully:", response.data);
        // ✅ Force add the room to state if not added by event
        setRooms((prev) => {
          if (prev.some(r => r.id === response.data.id)) return prev;
          const newRooms = [...prev, response.data];
          console.log("✅ Force added room to state:", newRooms);
          return newRooms;
        });
      } else {
        console.error("❌ Room creation failed:", response);
      }
    });
  }, []);

  // Join room by code
  const joinRoomByCode = useCallback((code: string) => {
    if (!socketRef.current) {
      console.error("❌ Socket not connected");
      return;
    }
    console.log("🔵 Joining room by code:", code);
    socketRef.current.emit("room:join-by-code", { code });
  }, []);

  const sendMessage = useCallback(
    (roomId: string, content: string, attachments?: string[]) => {
      if (!currentUserId || !socketRef.current) return;
      const clientId = makeClientId();

      const optimistic: ChatMessage = {
        id: clientId,
        roomId,
        senderId: currentUserId,
        content,
        attachments,
        createdAt: new Date().toISOString(),
        status: "sending",
        clientId,
      };

      setMessagesByRoom((prev) => ({ 
        ...prev, 
        [roomId]: [...(prev[roomId] || []), optimistic] 
      }));
      
      socketRef.current.emit("message:send", { 
        roomId, 
        content, 
        attachments, 
        clientId 
      });
    },
    [currentUserId]
  );

  const startTyping = useCallback((roomId: string) => {
    socketRef.current?.emit("typing:start", { roomId });
  }, []);

  const stopTyping = useCallback((roomId: string) => {
    socketRef.current?.emit("typing:stop", { roomId });
  }, []);

  const markRead = useCallback((roomId: string) => {
    socketRef.current?.emit("message:read", { roomId });
  }, []);

  const refreshRooms = useCallback(() => {
    if (socketRef.current && currentUserId) {
      console.log("🔄 Refreshing rooms...");
      socketRef.current.emit("rooms:list", { userId: currentUserId });
    }
  }, [currentUserId]);

  return {
    connected,
    currentUserId,
    rooms,
    messagesByRoom,
    membersByRoom,
    typingByRoom,
    presence,
    joinRoom,
    leaveRoom,
    sendMessage,
    startTyping,
    stopTyping,
    markRead,
    createRoom,
    joinRoomByCode,
    refreshRooms,
  };
}