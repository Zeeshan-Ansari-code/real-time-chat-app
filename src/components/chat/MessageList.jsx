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
  messagesEndRef
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
      <div ref={messagesEndRef} />
    </div>
  );
}

