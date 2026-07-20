"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChatSocket } from "@/app/hooks/chat-handler";
import { CreateRoomModal } from "@/app/components/create-room";
import { 
  ArchiveIcon, BellOffIcon, CheckIcon, ChevronDownIcon, 
  FileIcon, PaperclipIcon, PlusIcon, SearchIcon, SendIcon, 
  SmileIcon, TrashIcon, UsersIcon, XIcon, LogInIcon, CopyIcon,
  MenuIcon, Loader2
} from "lucide-react";
import { MoreIcon, DoubleCheckIcon } from '../../components/chat-icons';
import { useToast } from "@/app/components/toast";
import { JoinRoomModal } from "@/app/components/join-room-modal";
import { Users } from "@/app/helpers/factories";
import { CoreService } from "@/app/helpers/api-handler";

/* ============================== Types ============================== */
interface MemberMeta {
  name: string;
  initials: string;
  color: string;
}

const EMOJIS = ["😀", "😂", "😍", "👍", "🙏", "🎉", "🔥", "😊", "😅", "🤔", "👏", "💯", "❤️", "😢", "🚀", "✅"];

// Display metadata - will be populated dynamically
const MEMBER_META: Record<string, MemberMeta> = {};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function uploadAttachments(files: File[]): Promise<string[]> {
  return files.map((f) => f.name);
}

export default function ChatPage() {
  const { sessionData, addToast, studentsInfo } = useToast();
  const socket = useChatSocket(sessionData ? sessionData?.token : '');

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [mutedRooms, setMutedRooms] = useState<Set<string>>(new Set());
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // ✅ Mobile state
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
  // ✅ User cache
  const [activeUsersMap, setActiveUsersMap] = useState<Record<string, Users>>({});
  
  const previousMessageCounts = useRef<Record<string, number>>({});
  const isFirstLoad = useRef(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const membersRef = useRef<HTMLDivElement>(null);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [copyContent, setCopyContent] = useState<string>('');

  const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    console.log('Text copied successfully!');
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
};

  // ✅ Helper: Get user name from cache
  const getUserName = useCallback((userId: string): string => {
    if (activeUsersMap[userId]) {
      return activeUsersMap[userId].name;
    }
    if (MEMBER_META[userId]) {
      return MEMBER_META[userId].name;
    }
    return userId;
  }, [activeUsersMap]);

  useEffect(() => {
  const closeTooltip = () => setCopyContent('');
  window.addEventListener('click', closeTooltip);
  return () => window.removeEventListener('click', closeTooltip);
}, []);

  // ✅ Helper: Get user initials
  const getUserInitials = useCallback((userId: string): string => {
    const name = getUserName(userId);
    if (name && name !== userId) {
      return name.slice(0, 2).toUpperCase();
    }
    if (MEMBER_META[userId]) {
      return MEMBER_META[userId].initials;
    }
    return userId.slice(0, 2).toUpperCase();
  }, [getUserName]);

  // ✅ Fetch and cache user
  const fetchAndCacheUser = useCallback(async (userId: string) => {
    if (activeUsersMap[userId]) return activeUsersMap[userId];
    
    try {
      const res = await new CoreService().send(`/users/api/find-one-user`, {
        userId: Number(userId)
      });
      
      if (res.success) {
        const userData = Users.fromJson(res.data!);
        
        setActiveUsersMap((prev) => ({
          ...prev,
          [userId]: userData
        }));
        
        MEMBER_META[userId] = {
          name: userData.name,
          initials: userData.name.slice(0, 2).toUpperCase(),
          color: "#" + Math.floor(Math.random()*16777215).toString(16).slice(0, 6)
        };
        
        return userData;
      }
      return null;
    } catch (e: any) {
      addToast(e.message, 'error');
      return null;
    }
  }, [activeUsersMap, addToast]);

  // ✅ Fetch all users in a room
  const fetchAllRoomUsers = useCallback(async (memberIds: string[]) => {
    const promises = memberIds.map(id => fetchAndCacheUser(id));
    await Promise.all(promises);
  }, [fetchAndCacheUser]);

  // ✅ Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setShowSidebar(true);
      } else {
        if (activeRoomId) {
          setShowSidebar(false);
        } else {
          setShowSidebar(true);
        }
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [activeRoomId]);

  useEffect(() => {
    if (isMobile && activeRoomId) {
      setShowSidebar(false);
    }
  }, [activeRoomId, isMobile]);

  // Use rooms from socket
  const rooms = socket.rooms;
  const activeRoom = useMemo(() => rooms.find((r) => r.id === activeRoomId) ?? rooms[0] ?? null, [rooms, activeRoomId]);

  const roomMessages = socket.messagesByRoom[activeRoom?.id ?? ''] ?? [];
  const typingUserIds = socket.typingByRoom[activeRoom?.id ?? ''] ?? [];
  const typingMemberId = typingUserIds.find((id) => id !== socket.currentUserId) ?? null;
  
  const typingMeta = typingMemberId ? {
    name: getUserName(typingMemberId),
    initials: getUserInitials(typingMemberId),
    color: MEMBER_META[typingMemberId]?.color || "#64748B"
  } : null;

  // ✅ FIXED: Use real names from activeUsersMap
  const activeMembers = useMemo(
    () => {
      if (!activeRoom) return [];
      
      const uniqueMembers = Array.from(
        new Map(
          (activeRoom.memberIds ?? []).map((id) => {
            const userId = String(id);
            const name = getUserName(userId);
            const initials = getUserInitials(userId);
            
            if (!MEMBER_META[userId]) {
              MEMBER_META[userId] = {
                name: name,
                initials: initials,
                color: "#" + Math.floor(Math.random()*16777215).toString(16).slice(0, 6)
              };
            }
            
            return [
              userId,
              {
                id: userId,
                name: name,
                initials: initials,
                color: MEMBER_META[userId]?.color || "#64748B",
                online: socket.presence[userId] ?? false,
              }
            ];
          })
        ).values()
      );
      
      return uniqueMembers;
    },
    [activeRoom, socket.presence, activeUsersMap, getUserName, getUserInitials]
  );

  // ✅ Fetch users when room changes
  useEffect(() => {
    if (activeRoom && activeRoom.memberIds) {
      fetchAllRoomUsers(activeRoom.memberIds);
    }
  }, [activeRoom, fetchAllRoomUsers]);

  // ✅ Fetch users when rooms list changes
  useEffect(() => {
    rooms.forEach(room => {
      if (room.memberIds) {
        fetchAllRoomUsers(room.memberIds);
      }
    });
  }, [rooms, fetchAllRoomUsers]);

  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [rooms, searchQuery]);

  // Force refresh rooms when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && socket.connected) {
        socket.refreshRooms();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket.connected, socket.refreshRooms]);

  // Refresh rooms on reconnect
  useEffect(() => {
    if (socket.connected && socket.currentUserId) {
      socket.refreshRooms();
    }
  }, [socket.connected, socket.currentUserId, socket.refreshRooms]);

  // Set first room as active only once when rooms load
  useEffect(() => {
    if (rooms.length > 0 && !activeRoomId && isFirstLoad.current) {
      isFirstLoad.current = false;
      setActiveRoomId(rooms[0].id);
    }
  }, [rooms, activeRoomId]);

  // Auto-select newly created room
  useEffect(() => {
    if (rooms.length > 0 && activeRoomId) {
      const roomExists = rooms.some(r => r.id === activeRoomId);
      if (!roomExists) {
        setActiveRoomId(rooms[rooms.length - 1].id);
      }
    }
  }, [rooms, activeRoomId]);

  // When rooms load for first time
  useEffect(() => {
    if (rooms.length > 0 && !activeRoomId && isFirstLoad.current) {
      isFirstLoad.current = false;
      setActiveRoomId(rooms[0].id);
    }
  }, [rooms, activeRoomId]);

  // Join room only when activeRoomId changes or socket connects
  useEffect(() => {
    if (!socket.connected || !activeRoomId) return;
    
    socket.joinRoom(activeRoomId);
    socket.markRead(activeRoomId);
    setUnread((prev) => ({ ...prev, [activeRoomId]: 0 }));

    return () => {
      socket.leaveRoom(activeRoomId);
    };
  }, [activeRoomId, socket.connected]);

  // Track unread counts
  useEffect(() => {
    for (const room of rooms) {
      const count = socket.messagesByRoom[room.id]?.length ?? 0;
      const prevCount = previousMessageCounts.current[room.id] ?? count;
      if (room.id !== activeRoomId && count > prevCount) {
        setUnread((prev) => ({ ...prev, [room.id]: (prev[room.id] ?? 0) + (count - prevCount) }));
      }
      previousMessageCounts.current[room.id] = count;
    }
  }, [socket.messagesByRoom, activeRoomId, rooms]);

  // Mark newly-arrived messages read while the room is open
  useEffect(() => {
    if (socket.connected && activeRoomId) socket.markRead(activeRoomId);
  }, [roomMessages.length]);

  // Auto-scroll
  useEffect(() => {
    if (isAtBottom && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [roomMessages.length, typingMemberId]);

  useEffect(() => {
    if (activeRoomId) {
      setIsAtBottom(true);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    }
  }, [activeRoomId]);

  // Close popovers on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (membersRef.current && !membersRef.current.contains(e.target as Node)) setMembersOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  }

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    setIsAtBottom(true);
  }

  function handleSelectRoom(id: string) {
    setActiveRoomId(id);
    setEmojiOpen(false);
    setMenuOpen(false);
    setMembersOpen(false);
  }

  function handleNewRoom() {
    setIsModalOpen(true);
  }

  // Handle joining a room by code
  const handleJoinRoom = (code: string) => {
    socket.joinRoomByCode(code);
    addToast('Joined room successfully!', 'success');
  };

  // Copy room code to clipboard
  const copyRoomCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ✅ FIXED: Create room with proper user fetching
  const handleCreateRoom = async (name: string, isGroup: boolean, memberIds: string[]) => {
    // Fetch all users first
    await fetchAllRoomUsers(memberIds);
    
    // Store metadata for users
    memberIds.forEach(id => {
      const userId = String(id);
      if (!MEMBER_META[userId] && userId !== socket.currentUserId) {
        const name = getUserName(userId);
        MEMBER_META[userId] = {
          name: name,
          initials: getUserInitials(userId),
          color: "#" + Math.floor(Math.random()*16777215).toString(16).slice(0, 6)
        };
      }
    });

    socket.createRoom(name, isGroup, memberIds);
    addToast('Room created successfully!', 'success');
  };

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if ((!trimmed && attachments.length === 0) || !activeRoom) return;

    let attachmentUrls: string[] | undefined;
    if (attachments.length > 0) {
      setUploading(true);
      try {
        attachmentUrls = await uploadAttachments(attachments);
      } finally {
        setUploading(false);
      }
    }

    socket.sendMessage(activeRoom.id, trimmed, attachmentUrls);
    socket.stopTyping(activeRoom.id);
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);

    setDraft("");
    setAttachments([]);
    setIsAtBottom(true);
  }

  function handleDraftChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDraft(e.target.value);
    if (!activeRoom) return;

    socket.startTyping(activeRoom.id);
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => socket.stopTyping(activeRoom.id), 1200);
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
    e.target.value = "";
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function insertEmoji(emoji: string) {
    setDraft((prev) => prev + emoji);
    textareaRef.current?.focus();
  }

  function toggleMute(id: string) {
    setMutedRooms((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setMenuOpen(false);
  }

  function switchToRemaining(excludeId: string) {
    const remaining = rooms.filter((r) => r.id !== excludeId);
    if (remaining.length > 0) setActiveRoomId(remaining[0].id);
  }

  function archiveRoom(id: string) {
    socket.leaveRoom(id);
    switchToRemaining(id);
    setMenuOpen(false);
  }

  function deleteRoom(id: string) {
    if (!window.confirm("Delete this conversation? This can't be undone.")) return;
    socket.leaveRoom(id);
    switchToRemaining(id);
    setMenuOpen(false);
  }

  const lastMessageOf = (roomId: string) => {
    const msgs = socket.messagesByRoom[roomId];
    if (!msgs || msgs.length === 0) return { text: "No messages yet", timestamp: "" };
    const last = msgs[msgs.length - 1];
    const text = last.content || (last.attachments?.length ? `📎 ${last.attachments.length} attachment(s)` : "");
    return { text, timestamp: formatTime(last.createdAt) };
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  if (!socket.connected) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Connecting to chat...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="flex h-screen w-full overflow-hidden bg-white">
        {/* Mobile overlay */}
        {isMobile && showSidebar && activeRoomId && (
          <div 
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Sidebar */}
        <aside 
          ref={sidebarRef}
          className={`
            flex h-full flex-col border-r border-slate-200 bg-white
            transition-transform duration-300 ease-in-out
            ${isMobile ? 'fixed left-0 top-0 z-50 w-[85vw] max-w-[320px] shadow-xl' : 'w-75 shrink-0'}
            ${isMobile && !showSidebar ? '-translate-x-full' : 'translate-x-0'}
          `}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 pt-6 pb-4">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[17px] font-semibold tracking-tight text-slate-900">Messages</h1>
              <span
                className={`h-1.5 w-1.5 rounded-full ${socket.connected ? "bg-emerald-500" : "bg-slate-300"}`}
                title={socket.connected ? "Connected" : "Connecting…"}
              />
            </div>
            <div className="flex items-center gap-1">
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setShowSidebar(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition mr-1"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsJoinModalOpen(true)}
                aria-label="Join room by code"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
              >
                <LogInIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNewRoom}
                aria-label="Start new conversation"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B1E3D] text-white shadow-sm transition hover:bg-[#132c56] active:scale-95"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
              <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations"
                className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search" className="text-slate-400 hover:text-slate-600">
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 pb-4">
            {filteredRooms.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-slate-400">
                {searchQuery ? "No conversations found." : "No conversations yet. Start one!"}
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {filteredRooms.map((r) => {
                  const isActive = r.id === activeRoomId;
                  const primaryId = r.memberIds[0];
                  const primaryUser = primaryId ? activeUsersMap[primaryId] : null;
                  const primaryName = primaryUser?.name || primaryId || 'Unknown';
                  const primaryInitials = primaryUser?.name ? primaryUser.name.slice(0, 2).toUpperCase() : (primaryId?.slice(0, 2).toUpperCase() || '?');
                  const primaryColor = MEMBER_META[primaryId]?.color || "#64748B";
                  const anyOnline = r.memberIds.some((id) => socket.presence[id]);
                  const preview = lastMessageOf(r.id);
                  const roomUnread = unread[r.id] ?? 0;
                  const muted = mutedRooms.has(r.id);

                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectRoom(r.id)}
                        className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                          isActive ? "bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-6 w-0.75 -translate-y-1/2 rounded-r-full bg-linear-to-b from-blue-500 to-[#0B1E3D]" />
                        )}

                        <span className="relative shrink-0">
                          {r.isGroup ? (
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-[#1B3A6B] to-[#0B1E3D] text-white">
                              <UsersIcon className="h-4.5 w-4.5" />
                            </span>
                          ) : (
                            <span
                              className="flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                              style={{ backgroundColor: isActive ? "#0B1E3D" : primaryColor }}
                            >
                              {primaryInitials}
                            </span>
                          )}
                          {!r.isGroup && anyOnline && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className={`truncate text-[13.5px] font-medium ${isActive ? "text-slate-900" : "text-slate-700"}`}>
                              {r.isGroup ? r.name : primaryName}
                              {muted && <span className="ml-1 text-slate-300">(muted)</span>}
                            </span>
                            <span className="shrink-0 font-mono text-[10.5px] text-slate-400">{preview.timestamp}</span>
                          </span>
                          <span className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="truncate text-[12.5px] text-slate-500">{preview.text}</span>
                            {roomUnread > 0 && !muted && (
                              <span className="flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1 font-mono text-[10px] font-medium text-white">
                                {roomUnread}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
        </aside>

        {/* Room View */}
        <section className="flex h-full min-w-0 flex-1 flex-col bg-[#F7F9FC]">
          {activeRoom ? (
            <>
              {/* Header */}
              <header className="relative flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4">
                <div className="flex items-center gap-2 min-w-0">
                  {isMobile && (
                    <button
                      type="button"
                      onClick={toggleSidebar}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                    >
                      <MenuIcon className="h-5 w-5" />
                    </button>
                  )}

                  <span className="relative shrink-0">
                    {activeRoom.isGroup ? (
                      <span className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full bg-linear-to-br from-[#1B3A6B] to-[#0B1E3D] text-white">
                        <UsersIcon className="h-4 w-4 md:h-4.5 md:w-4.5" />
                      </span>
                    ) : (
                      <span
                        className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-full text-[11px] md:text-[12px] font-semibold text-white"
                        style={{ backgroundColor: activeMembers[0]?.color ?? "#0B1E3D" }}
                      >
                        {activeMembers[0]?.initials ?? "?"}
                      </span>
                    )}
                    {!activeRoom.isGroup && activeMembers[0]?.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 md:h-3 md:w-3 rounded-full border-2 border-white bg-emerald-500" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="relative" ref={membersRef}>
                      <button
                        type="button"
                        onClick={() => activeRoom.isGroup && setMembersOpen((v) => !v)}
                        className={`flex items-center gap-1 font-display text-[13px] md:text-[14.5px] font-semibold text-slate-900 truncate ${
                          activeRoom.isGroup ? "cursor-pointer hover:text-blue-700" : "cursor-default"
                        }`}
                      >
                        <span className="truncate">{activeRoom.name}</span>
                        {activeRoom.isGroup && <ChevronDownIcon className="h-3 w-3 md:h-3.5 md:w-3.5 shrink-0 text-slate-400" />}
                      </button>

                      {membersOpen && activeRoom.isGroup && (
                        <div className="absolute left-0 top-8 z-10 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
                          <p className="px-3.5 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            {activeMembers.length} members
                          </p>
                          {activeMembers.map((m) => (
                            <div key={m.id} className="flex items-center gap-2.5 px-3.5 py-1.5">
                              <span className="relative shrink-0">
                                <span
                                  className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                  style={{ backgroundColor: m.color }}
                                >
                                  {m.initials}
                                </span>
                                {m.online && (
                                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                                )}
                              </span>
                              <span className="text-[13px] text-slate-700 truncate">{m.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[10px] md:text-[12px] text-slate-500 truncate">
                        {typingMeta ? (
                          <span className="inline-flex items-center gap-1.5 text-blue-600">
                            <span className="flex gap-0.5">
                              <span className="h-1 w-1 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.3s]" />
                              <span className="h-1 w-1 animate-bounce rounded-full bg-blue-500 [animation-delay:-0.15s]" />
                              <span className="h-1 w-1 animate-bounce rounded-full bg-blue-500" />
                            </span>
                            {activeRoom.isGroup ? `${typingMeta.name} is typing` : "typing"}
                          </span>
                        ) : activeRoom.isGroup ? (
                          `${activeMembers.length} members · ${activeMembers.filter((m) => m.online).length} online`
                        ) : activeMembers[0]?.online ? (
                          "Online"
                        ) : (
                          "Offline"
                        )}
                      </p>
                    </div>

                    {activeRoom.code && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[8px] md:text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 md:px-2 md:py-0.5 rounded text-slate-500">
                          {activeRoom.code}
                        </span>
                        <button
                          onClick={() => copyRoomCode(activeRoom.code!)}
                          className="text-slate-400 hover:text-slate-600 transition"
                          title="Copy room code"
                        >
                          {copied ? (
                            <CheckIcon className="h-2.5 w-2.5 md:h-3 md:w-3 text-emerald-500" />
                          ) : (
                            <CopyIcon className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-label="Conversation options"
                    aria-expanded={menuOpen}
                    className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <MoreIcon className="h-4 w-4 md:h-4.5 md:w-4.5" />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-10 z-10 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                      <button type="button" onClick={() => toggleMute(activeRoom.id)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50">
                        <BellOffIcon className="h-4 w-4 text-slate-400" />
                        {mutedRooms.has(activeRoom.id) ? "Unmute notifications" : "Mute notifications"}
                      </button>
                      <button type="button" onClick={() => archiveRoom(activeRoom.id)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50">
                        <ArchiveIcon className="h-4 w-4 text-slate-400" />
                        Archive conversation
                      </button>
                      <div className="my-1 h-px bg-slate-100" />
                      <button type="button" onClick={() => deleteRoom(activeRoom.id)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-red-600 hover:bg-red-50">
                        <TrashIcon className="h-4 w-4" />
                        Delete conversation
                      </button>
                    </div>
                  )}
                </div>
              </header>

              {/* Messages */}
              <div className="relative flex-1 overflow-hidden">
                <div ref={scrollRef} onScroll={handleScroll} className="h-full space-y-1 overflow-y-auto px-3 py-3 md:px-6 md:py-6">
                  {roomMessages.length === 0 && (
                    <p className="pt-10 text-center text-[13px] text-slate-400">No messages yet — say hello.</p>
                  )}

                  {roomMessages.map((m, i) => {
                    const isUser = m.senderId === socket.currentUserId;
                    const sender = isUser ? null : MEMBER_META[m.senderId];
                    const prev = roomMessages[i - 1];
                    const isGroupedWithPrev = prev && prev.senderId === m.senderId;

                    return (
                      <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"} ${isGroupedWithPrev ? "mt-0.5" : "mt-4"}`}>
                        <div className={`flex max-w-[85%] md:max-w-[68%] gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                          {!isUser && activeRoom.isGroup && (
                            <span className="w-6 md:w-7 shrink-0">
                              {!isGroupedWithPrev && (
                                <span
                                  className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full text-[8px] md:text-[10px] font-semibold text-white"
                                  style={{ backgroundColor: sender?.color ?? "#64748B" }}
                                >
                                  {sender?.initials ?? "?"}
                                </span>
                              )}
                            </span>
                          )}

                          <div className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
                            {!isUser && activeRoom.isGroup && !isGroupedWithPrev && (
                              <span className="px-1 text-[10px] md:text-[12px] font-medium text-slate-600">
                                {sender?.name || m.senderId}
                              </span>
                            )}

                            {m.content && (
                              <div
                                className={`px-3 py-2 md:px-4 md:py-2.5 text-[12px] md:text-[13.5px] leading-relaxed ${
                                  isUser
                                    ? `rounded-2xl rounded-br-md bg-[#0B1E3D] text-white ${m.status === "sending" ? "opacity-60" : ""}`
                                    : "rounded-2xl rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                                } relative`}
                                onContextMenu={(e) => {
                                e.preventDefault(); // Stops the browser menu from showing
                                
                                setCopyContent(m.id); // Shows your custom tooltip
                              }}>
                                {copyContent === m.id && (<div className="shadow p-1 w-auto h-auto rounded absolute -top-8 right-0 flex justify-center items-center bg-white gap-1 cursor-pointer hover:scale-95 transition" onClick={(e) => {
                                   e.stopPropagation(); // Prevents the window click listener from closing it instantly
                                  copyToClipboard(m.content);
                                  addToast('Copied Successfully');
                                  setCopyContent(m.id);
                                }}>
                                  <CopyIcon className="text-gray-500 w-3 h-3"/> <p className="text-[10px] text-gray-600">Copy</p>
                                </div>)}
                                {m.content}
                              </div>
                            )}

                            {m.attachments && m.attachments.length > 0 && (
                              <div className="flex flex-col gap-1.5">
                                {m.attachments.map((name, idx) => (
                                  <div
                                    key={idx}
                                    className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 md:px-3 md:py-2 text-[11px] md:text-[12.5px] ${
                                      isUser ? "border-blue-900/20 bg-[#0B1E3D] text-white" : "border-slate-200 bg-white text-slate-600"
                                    }`}
                                  >
                                    <FileIcon className="h-3 w-3 md:h-4 md:w-4 shrink-0 opacity-70" />
                                    <span className="max-w-37.5 md:max-w-55 truncate">{name}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-1 px-1 font-mono text-[9px] md:text-[10.5px] text-slate-400">
                              <span>{formatTime(m.createdAt)}</span>
                              {isUser && m.status === "read" && <DoubleCheckIcon className="h-2.5 w-2.5 md:h-3 md:w-3 text-blue-500" />}
                              {isUser && m.status === "delivered" && <DoubleCheckIcon className="h-2.5 w-2.5 md:h-3 md:w-3 text-slate-400" />}
                              {isUser && m.status === "sent" && <CheckIcon className="h-2.5 w-2.5 md:h-3 md:w-3 text-slate-400" />}
                              {isUser && m.status === "sending" && <span className="italic">sending…</span>}
                            </div>
                          </div>
                        </div>
                        
                      </div>
                    );
                  })}

                  {typingMeta && (
                    <div className="mt-4 flex justify-start">
                      <div className="flex gap-2">
                        {activeRoom.isGroup && (
                          <span
                            className="flex h-6 w-6 md:h-7 md:w-7 shrink-0 items-center justify-center rounded-full text-[8px] md:text-[10px] font-semibold text-white"
                            style={{ backgroundColor: typingMeta.color }}
                          >
                            {typingMeta.initials}
                          </span>
                        )}
                        <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 md:px-4 md:py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                          <span className="h-1 w-1 md:h-1.5 md:w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                          <span className="h-1 w-1 md:h-1.5 md:w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                          <span className="h-1 w-1 md:h-1.5 md:w-1.5 animate-bounce rounded-full bg-slate-400" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {!isAtBottom && (
                  <button
                    type="button"
                    onClick={scrollToBottom}
                    className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 md:px-3.5 md:py-1.5 text-[11px] md:text-[12px] font-medium text-slate-600 shadow-md transition hover:bg-slate-50"
                  >
                    <ChevronDownIcon className="h-3 w-3 md:h-3.5 md:w-3.5" />
                    Jump to latest
                  </button>
                )}
              </div>

              {/* Message Input */}
              <form onSubmit={handleSend} className="shrink-0 border-t border-slate-200 bg-white px-3 py-2 md:px-6 md:py-4">
                {attachments.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {attachments.map((file, i) => (
                      <div key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1 pl-2 pr-1.5 text-[11px] md:text-[12px] text-slate-600">
                        <FileIcon className="h-3 w-3 md:h-3.5 md:w-3.5 shrink-0 text-slate-400" />
                        <span className="max-w-30 md:max-w-40 truncate">{file.name}</span>
                        <button type="button" onClick={() => removeAttachment(i)} aria-label={`Remove ${file.name}`} className="flex h-4 w-4 md:h-4.5 md:w-4.5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                          <XIcon className="h-2.5 w-2.5 md:h-3 md:w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-1.5 md:gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 md:px-3 md:py-2 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
                  <input ref={fileInputRef} type="file" multiple onChange={handleFileChange} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Attach file" className="flex h-7 w-7 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                    <PaperclipIcon className="h-4 w-4 md:h-4.5 md:w-4.5" />
                  </button>

                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={handleDraftChange}
                    onKeyDown={handleTextareaKeyDown}
                    rows={1}
                    placeholder={activeRoom.isGroup ? `Message #${activeRoom.name.toLowerCase().replace(/\s+/g, "-")}` : `Message ${activeRoom.name}`}
                    className="max-h-32 flex-1 resize-none bg-transparent py-1 text-[12px] md:text-[13.5px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  />

                  <div className="relative" ref={emojiRef}>
                    <button type="button" onClick={() => setEmojiOpen((v) => !v)} aria-label="Add emoji" aria-expanded={emojiOpen} className="flex h-7 w-7 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                      <SmileIcon className="h-4 w-4 md:h-4.5 md:w-4.5" />
                    </button>

                    {emojiOpen && (
                      <div className="absolute bottom-11 right-0 z-10 grid w-48 md:w-56 grid-cols-8 gap-1 rounded-lg border border-slate-200 bg-white p-1.5 md:p-2 shadow-lg">
                        {EMOJIS.map((emoji) => (
                          <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-md text-[14px] md:text-[16px] hover:bg-slate-100">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={(!draft.trim() && attachments.length === 0) || uploading || !socket.connected}
                    aria-label="Send message"
                    className="flex h-7 w-7 md:h-8 md:w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition enabled:hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <SendIcon className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center px-4">
                <UsersIcon className="h-10 w-10 md:h-12 md:w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-[14px] md:text-[15px] font-medium text-slate-700">No conversation selected</p>
                <p className="text-[12px] md:text-[13px] text-slate-400 mt-1">Start a new chat or select an existing one</p>
                <button
                  onClick={handleNewRoom}
                  className="mt-4 rounded-lg bg-[#0B1E3D] px-4 py-2 text-sm text-white hover:bg-[#132c56]"
                >
                  Start Conversation
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreateRoom={handleCreateRoom}
        currentUserId={socket.currentUserId || ''}
      />

      {/* Join Room Modal */}
      <JoinRoomModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onJoinRoom={handleJoinRoom}
      />
    </>
  );
}