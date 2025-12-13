"use client";
import { File } from "lucide-react";
import { useEffect, useRef } from "react";
import axios from "axios";

export default function MessageInput({
  newMsg,
  setNewMsg,
  onSend,
  fileInputRef,
  handleFileSelect,
  selectedFile,
  removeSelectedFile,
  isUploading,
  conversationId,
  user
}) {
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!conversationId || !user || !newMsg.trim()) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing indicator
    axios.post(`/api/typing/${conversationId}`, {
      userId: user.id,
      name: user.name
    }).catch(() => {});

    // Clear typing indicator after 1 second of no typing
    typingTimeoutRef.current = setTimeout(() => {
      // Typing indicator will auto-clear on the other side
    }, 1000);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [newMsg, conversationId, user]);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSend(); }}
      className="p-4 lg:p-6 border-t dark:border-gray-700 bg-gradient-to-r from-white to-blue-50 dark:from-gray-900 dark:to-blue-900/20 flex gap-2 lg:gap-3"
    >
      {/* File upload button */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="p-2 lg:p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 hover:scale-110"
        disabled={isUploading}
        title="Attach file"
      >
        {isUploading ? (
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        ) : (
          <File className="w-5 h-5" />
        )}
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
      />

      {/* Selected file preview */}
      {selectedFile && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <File className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-32">
            {selectedFile.fileName}
          </span>
          <button
            type="button"
            onClick={removeSelectedFile}
            className="text-red-500 hover:text-red-700 text-lg font-bold"
          >
            ×
          </button>
        </div>
      )}

      <input
        type="text"
        value={newMsg}
        onChange={(e) => setNewMsg(e.target.value)}
        placeholder="Type a message..."
        className="flex-1 border dark:border-gray-600 rounded-full px-4 lg:px-6 py-2 lg:py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md text-sm lg:text-base"
      />
      <button
        type="submit"
        className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 lg:px-6 py-2 lg:py-3 rounded-full hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 text-sm lg:text-base"
        disabled={(!newMsg.trim() && !selectedFile)}
      >
        Send
      </button>
    </form>
  );
}

