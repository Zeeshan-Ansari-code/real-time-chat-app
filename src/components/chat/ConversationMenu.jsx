"use client";
import { X, User, Trash2, Archive, Bell, BellOff } from "lucide-react";
import { useState } from "react";

export default function ConversationMenu({ isOpen, onClose, otherUser, onDeleteConversation }) {
  const [muted, setMuted] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold dark:text-white">Conversation Options</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {otherUser?.name?.[0] || "?"}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">{otherUser?.name || "Unknown User"}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">View profile</p>
            </div>
            <User className="w-5 h-5 text-gray-400" />
          </div>

          <button
            onClick={() => setMuted(!muted)}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
          >
            {muted ? (
              <>
                <BellOff className="w-5 h-5 text-gray-400" />
                <span className="flex-1 text-gray-900 dark:text-white">Unmute Notifications</span>
              </>
            ) : (
              <>
                <Bell className="w-5 h-5 text-gray-400" />
                <span className="flex-1 text-gray-900 dark:text-white">Mute Notifications</span>
              </>
            )}
          </button>

          <button
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <Archive className="w-5 h-5 text-gray-400" />
            <span className="flex-1 text-gray-900 dark:text-white">Archive Chat</span>
          </button>

          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to delete this conversation? This action cannot be undone.")) {
                onDeleteConversation?.();
                onClose();
              }
            }}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left text-red-600 dark:text-red-400"
          >
            <Trash2 className="w-5 h-5" />
            <span className="flex-1 font-medium">Delete Conversation</span>
          </button>
        </div>
      </div>
    </div>
  );
}

