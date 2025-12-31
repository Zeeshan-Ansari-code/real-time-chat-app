"use client";
import { File, Mic, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import VoiceRecorder from "./VoiceRecorder";
import LocationShare from "./LocationShare";
import EmojiPickerButton from "./EmojiPicker";

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
  user,
  isAIChat = false,
  onVoiceMessage,
  onLocationShare
}) {
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);
  const debounceTimeoutRef = useRef(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showLocationShare, setShowLocationShare] = useState(false);

  useEffect(() => {
    // Don't send typing indicators for AI chat
    if (isAIChat || !conversationId || !user || !newMsg.trim()) {
      // Clear any pending typing indicators if message is empty
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      return;
    }

    // Clear existing debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce: Only send typing indicator after user stops typing for 500ms
    debounceTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      // Only send if at least 2 seconds have passed since last typing indicator
      // This prevents too many API calls while user is actively typing
      if (now - lastTypingSentRef.current >= 2000) {
        axios.post(`/api/typing/${conversationId}`, {
          userId: user.id,
          name: user.name
        }).catch(() => {});
        
        lastTypingSentRef.current = now;
      }
    }, 500); // Wait 500ms after user stops typing

    // Clear typing indicator timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Clear typing indicator after 3 seconds of no typing
    typingTimeoutRef.current = setTimeout(() => {
      // Typing indicator will auto-clear on the other side
    }, 3000);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [newMsg, conversationId, user, isAIChat]);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSend(); }}
      className="p-4 sm:p-5 lg:p-6 border-t border-gray-200 dark:border-gray-800 bg-gradient-to-r from-white via-blue-50/30 to-blue-100/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 shadow-sm flex items-center gap-3 flex-wrap pb-6 lg:pb-6"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)" }}
    >
      {/* Action buttons - hidden for AI chat */}
      {!isAIChat && (
        <>
          <div className="flex items-center gap-1">
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
            <button
              type="button"
              onClick={() => setShowVoiceRecorder(true)}
              className="p-2 lg:p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 hover:scale-110"
              disabled={isUploading}
              title="Voice message"
            >
              <Mic className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowLocationShare(true)}
              className="p-2 lg:p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 hover:scale-110"
              disabled={isUploading}
              title="Share location"
            >
              <MapPin className="w-5 h-5" />
            </button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          />
        </>
      )}

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

      <div className="flex-1 min-w-0 flex items-center gap-2 border dark:border-gray-600 rounded-full px-4 lg:px-6 py-2 lg:py-3 bg-white dark:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md">
        <input
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder={isAIChat ? "Ask AI anything..." : "Type a message..."}
          className="flex-1 min-w-0 bg-transparent text-gray-900 dark:text-white focus:outline-none text-sm lg:text-base"
          disabled={isUploading}
        />
        <EmojiPickerButton
          onEmojiSelect={(emoji) => setNewMsg((prev) => prev + emoji)}
          className="flex-shrink-0"
        />
      </div>
      <button
        type="submit"
        className={`flex-shrink-0 bg-gradient-to-r ${isAIChat ? 'from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700' : 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'} text-white px-4 lg:px-6 py-2 lg:py-3 rounded-full disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 text-sm lg:text-base text-center flex items-center justify-center gap-2`}
        disabled={(!newMsg.trim() && !selectedFile) || isUploading}
      >
        {isUploading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            {isAIChat ? "AI is thinking..." : "Sending..."}
          </>
        ) : (
          "Send"
        )}
      </button>

      {/* Voice Recorder Modal */}
      {showVoiceRecorder && (
        <VoiceRecorder
          onRecordingComplete={(audioBlob) => {
            if (onVoiceMessage) {
              onVoiceMessage(audioBlob);
            }
            setShowVoiceRecorder(false);
          }}
          onCancel={() => setShowVoiceRecorder(false)}
        />
      )}

      {/* Location Share Modal */}
      {showLocationShare && (
        <LocationShare
          onLocationSelected={(location) => {
            if (onLocationShare) {
              onLocationShare(location);
            }
            setShowLocationShare(false);
          }}
          onCancel={() => setShowLocationShare(false)}
        />
      )}
    </form>
  );
}

