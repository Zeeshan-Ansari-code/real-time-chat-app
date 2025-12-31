"use client";
import { useState, useRef, useEffect } from "react";
import EmojiPicker from "emoji-picker-react";
import { Smile } from "lucide-react";

export default function MessageReactions({ 
  message, 
  currentUserId, 
  onAddReaction, 
  onRemoveReaction 
}) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showPicker]);

  // Don't show emoji picker button if no reactions - users can react by clicking on existing reactions
  if (!message.reactions || message.reactions.length === 0) {
    return null;
  }

  // Group reactions by emoji
  const reactionsByEmoji = {};
  message.reactions.forEach((reaction) => {
    if (!reactionsByEmoji[reaction.emoji]) {
      reactionsByEmoji[reaction.emoji] = [];
    }
    reactionsByEmoji[reaction.emoji].push(reaction);
  });

  const handleReactionClick = (emoji, reactions) => {
    const userReaction = reactions.find(
      (r) => (r.userId?._id || r.userId) === currentUserId
    );
    if (userReaction) {
      onRemoveReaction(message._id, emoji);
    } else {
      onAddReaction(message._id, emoji);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {Object.entries(reactionsByEmoji).map(([emoji, reactions]) => {
        const hasUserReaction = reactions.some(
          (r) => (r.userId?._id || r.userId) === currentUserId
        );
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => handleReactionClick(emoji, reactions)}
            className={`text-xs px-2 py-1 rounded-full border transition-colors flex items-center gap-1 ${
              hasUserReaction
                ? "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700"
                : "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
            title={`${reactions.length} reaction${reactions.length > 1 ? "s" : ""}`}
          >
            <span>{emoji}</span>
            <span className="text-[10px] text-gray-600 dark:text-gray-300">
              {reactions.length}
            </span>
          </button>
        );
      })}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Add reaction"
        >
          <Smile className="w-3 h-3" />
        </button>
        {showPicker && (
          <div
            ref={pickerRef}
            className="absolute bottom-full left-0 mb-2 z-50"
          >
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                onAddReaction(message._id, emojiData.emoji);
                setShowPicker(false);
              }}
              theme="light"
              width={280}
              height={350}
            />
          </div>
        )}
      </div>
    </div>
  );
}

