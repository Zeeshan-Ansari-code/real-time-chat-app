"use client";
import { useEffect, useRef } from "react";
import MessageItem from "./MessageItem";

export default function MessageList({
  messages,
  user,
  selectedMessages,
  onToggleMessageSelection,
  onTranslateMessage,
  onDeleteMessage,
  formatFileSize,
  otherUserId,
  isTranslatingMessage,
  isDeletingMessage,
  messagesContainerRef,
  messagesEndRef,
  typingUsers = []
}) {
  // Store callback in ref to avoid dependency issues
  const onToggleRef = useRef(onToggleMessageSelection);
  useEffect(() => {
    onToggleRef.current = onToggleMessageSelection;
  }, [onToggleMessageSelection]);

  // Close selection when clicking on empty space in chat area
  useEffect(() => {
    const handleClick = (e) => {
      if (selectedMessages.size > 0) {
        const target = e.target;
        
        // Check if click is on message actions (buttons) - keep selection
        const clickedMessageActions = target.closest('.message-actions');
        if (clickedMessageActions) {
          return; // Don't clear if clicking on action buttons
        }
        
        // Check if click is directly on the message bubble (the actual message content)
        // Not on the wrapper or empty space around it
        const messageBubble = target.closest('[data-message-bubble]');
        if (messageBubble) {
          // Click is on the actual message bubble - don't clear, let message handle toggle
          return;
        }
        
        // Check if click is on "Seen" text or other message-related elements
        // that are part of the message but not the bubble
        const messageWrapper = target.closest('.message-item-wrapper');
        if (messageWrapper) {
          // Click is within message wrapper but not on the bubble itself
          // This means clicking on empty space around the message - clear selection
          onToggleRef.current(null);
          return;
        }
        
        // Check if click is on message-item container but not on any message content
        const messageItem = target.closest('.message-item');
        if (messageItem && !target.closest('[data-message-bubble]')) {
          // Click is on empty space within message-item - clear selection
          onToggleRef.current(null);
          return;
        }
        
        // Clicked anywhere else (outside messages) - clear selection
        onToggleRef.current(null);
      }
    };
    
    // Use document click to catch all clicks
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [selectedMessages]);

  return (
    <div
      ref={messagesContainerRef}
      className="flex-1 overflow-y-auto p-5 lg:p-6 space-y-4 bg-gradient-to-b from-white via-blue-50/30 to-blue-100/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 40px)" }}
    >
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
          <p className="text-center">
            No messages yet.<br />
            <span className="text-sm">Start the conversation!</span>
          </p>
        </div>
      )}
      {messages.map((m) => (
        <div key={m._id} className="message-item">
          <MessageItem
            message={m}
            isOwnMessage={m.sender._id === user.id}
            isSelected={selectedMessages.has(m._id)}
            onSelect={onToggleMessageSelection}
            onTranslate={onTranslateMessage}
            onDelete={onDeleteMessage}
            formatFileSize={formatFileSize}
            otherUserId={otherUserId}
            isTranslatingMessage={isTranslatingMessage}
            isDeletingMessage={isDeletingMessage}
          />
        </div>
      ))}
      {typingUsers.length > 0 && (
        <div className="message-item flex">
          <div className="max-w-xs md:max-w-sm lg:max-w-md px-4 py-2 rounded-2xl bg-white/90 dark:bg-gray-800/90 shadow text-blue-700 dark:text-blue-200 text-xs font-medium flex items-center gap-2 border border-blue-100 dark:border-blue-900/50">
            <span className="flex space-x-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></span>
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
            </span>
            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

