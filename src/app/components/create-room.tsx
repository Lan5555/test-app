"use client";

import { useState, useEffect, useRef } from "react";
import { XIcon, UsersIcon, UserPlusIcon, CheckIcon, UserIcon, CopyIcon, CheckIcon as CheckIcon2 } from "lucide-react";
import { CoreService } from "@/app/helpers/api-handler";
import { Users } from "../helpers/factories";


interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (name: string, isGroup: boolean, memberIds: string[]) => void;
  currentUserId: string;
}

const service: CoreService = new CoreService();

export function CreateRoomModal({ 
  isOpen, 
  onClose, 
  onCreateRoom, 
  currentUserId 
}: CreateRoomModalProps) {
  const [users, setUsers] = useState<Users[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Users[]>([]);
  const [loading, setLoading] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [isGroup, setIsGroup] = useState(false);
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchAllUsers();
    }
  }, [isOpen]);

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      const response = await service.get('/users/api/find-all-users');
      if (response.success) {
        const dataArray = Array.isArray(response.data) ? response.data : [response.data];
      const parsedUsers = dataArray.map((item) => Users.fromJson(item));
      setUsers(parsedUsers.filter((user) => user.id.toString() !== currentUserId?.toString()));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const toggleUser = (user: Users) => {
    setSelectedUsers(prev => {
      const exists = prev.find(u => u.id === user.id);
      if (exists) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleCreateRoom = () => {
    if (selectedUsers.length === 0) {
      alert('Please select at least one user');
      return;
    }

    let name = roomName.trim();
    if (!isGroup && selectedUsers.length === 1) {
      name = selectedUsers[0].name;
    } else if (isGroup && !name) {
      name = `${selectedUsers.map(u => u.name).join(', ')}`;
    } else if (!name) {
      name = `${selectedUsers.map(u => u.name).join(', ')}`;
    }

    const memberIds = [currentUserId, ...selectedUsers.map(u => u.id.toString())];
    onCreateRoom(name, isGroup || selectedUsers.length > 1, memberIds);
    onClose();
    
    setSelectedUsers([]);
    setRoomName("");
    setIsGroup(false);
  };

  const removeUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id.toString() !== userId));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div 
        ref={modalRef}
        className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0B1E3D]">
              <UserPlusIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">New Conversation</h2>
              <p className="text-xs text-slate-400">Select users to start chatting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Room Type Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsGroup(false)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                !isGroup 
                  ? 'bg-[#0B1E3D] text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <UserIcon className="h-4 w-4 inline mr-2" />
              Direct Message
            </button>
            <button
              onClick={() => setIsGroup(true)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${
                isGroup 
                  ? 'bg-[#0B1E3D] text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <UsersIcon className="h-4 w-4 inline mr-2" />
              Group Chat
            </button>
          </div>

          {/* Group Name Input */}
          {isGroup && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Group Name
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Enter group name..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 text-black"
              />
            </div>
          )}

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Selected ({selectedUsers.length})
              </label>
              <div className="flex flex-wrap gap-1.5">
                {selectedUsers.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                  >
                    {user.name}
                    <button
                      onClick={() => removeUser(user.id.toString())}
                      className="hover:text-blue-900"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Users List */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Select Users
            </label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              ) : users.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  No users available
                </div>
              ) : (
                users.map((user) => {
                  const isSelected = selectedUsers.some(u => u.id === user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggleUser(user)}
                      className={`flex w-full items-center justify-between px-3 py-2.5 transition ${
                        isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B1E3D] text-xs font-semibold text-white">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-slate-700">{user.name}</p>
                          <p className="text-xs text-slate-400">{user.email}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckIcon className="h-5 w-5 text-blue-600" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Info about room codes */}
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-xs text-blue-700">
              💡 After creating, you'll get a <strong>6-character room code</strong> to share with others.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4">
          <button
            onClick={handleCreateRoom}
            disabled={selectedUsers.length === 0}
            className="w-full rounded-lg bg-[#0B1E3D] py-2.5 text-sm font-medium text-white transition hover:bg-[#132c56] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlusIcon className="h-4 w-4 inline mr-2" />
            Create {isGroup ? 'Group' : 'Conversation'}
          </button>
        </div>
      </div>
    </div>
  );
}