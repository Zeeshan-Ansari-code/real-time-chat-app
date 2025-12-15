"use client";
import { useState, useEffect, useRef } from "react";
import { Search, MoreVertical, X, User, Trash2, Archive, Bell, BellOff, ArrowLeft } from "lucide-react";
import CallButton from "@/components/call/CallButton";

export default function ChatHeader({
  otherUserName,
  recvLang,
  onRecvLangChange,
  isTranslating,
  typingUsers,
  isOtherOnline,
  conversationId,
  otherUser,
  user,
  pusherRef,
  onOutgoingCall,
  messages,
  onDeleteConversation,
  isArchived = false,
  onArchiveConversation,
  onUnarchiveConversation,
  onBackMobile,
  showBackButton = false
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [muted, setMuted] = useState(false);
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target) && !showSearch) {
        setSearchQuery("");
        setSearchResults([]);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSearch]);

  // Search functionality - use ref to track messages to avoid infinite loops
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const currentMessages = messagesRef.current;
    if (!currentMessages || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const results = currentMessages
      .filter((msg) => {
        if (!msg.text) return false;
        return msg.text.toLowerCase().includes(query);
      })
      .map((msg) => ({
        ...msg,
        highlightedText: msg.text.replace(
          new RegExp(`(${query})`, "gi"),
          "<mark class='bg-yellow-300 dark:bg-yellow-600'>$1</mark>"
        ),
      }));

    setSearchResults(results);
  }, [searchQuery]); // Only depend on searchQuery, use ref for messages

  return (
    <div className="p-5 lg:p-6 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-white via-blue-50/40 to-blue-100/40 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 shadow-sm">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            {showBackButton && onBackMobile && (
              <button
                onClick={onBackMobile}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300 -ml-2"
                aria-label="Back to chats"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h2 className="font-bold text-gray-900 dark:text-white text-xl lg:text-2xl truncate">
              {otherUserName || "Unknown User"}
            </h2>
            <div className={`w-2.5 h-2.5 rounded-full ${isOtherOnline ? 'bg-green-500' : 'bg-gray-400'} shadow-sm`}></div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Translate to:</span>
              <select
                value={recvLang}
                onChange={(e) => onRecvLangChange(e.target.value)}
                className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 shadow-sm"
              >
                <option value="">Auto</option>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
              </select>
            </div>
            {isTranslating && (
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                Translating...
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 text-gray-600 dark:text-gray-300 items-center">
          {/* Search Bar */}
          <div className="relative" ref={searchRef}>
            {showSearch ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="w-64 pl-10 pr-10 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 shadow-sm"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setShowSearch(false);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                {/* Search Results Dropdown */}
                {searchQuery.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 max-h-96 overflow-y-auto z-50">
                    {searchResults.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                        No messages found
                      </div>
                    ) : (
                      <div className="p-2">
                        {searchResults.map((msg) => (
                          <div
                            key={msg._id}
                            className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                            onClick={() => {
                              setShowSearch(false);
                              setSearchQuery("");
                              setSearchResults([]);
                            }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {msg.sender?._id === user.id ? "You" : msg.sender?.name || "Unknown"}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(msg.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p
                              className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2"
                              dangerouslySetInnerHTML={{ __html: msg.highlightedText }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                title="Search messages"
              >
                <Search className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* More Options Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              title="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 z-50">
                <div className="p-2">
                  <button
                    onClick={() => {
                      if (otherUser?._id || otherUser?.id) {
                        window.location.href = `/profile/${otherUser._id || otherUser.id}`;
                      }
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold">
                      {otherUser?.name?.[0] || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{otherUser?.name || "Unknown User"}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">View profile</p>
                    </div>
                    <User className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </button>

                  <button
                    onClick={() => {
                      setMuted(!muted);
                      setShowMenu(false);
                    }}
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

                  {isArchived ? (
                    <button
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                      onClick={() => {
                        onUnarchiveConversation?.();
                        setShowMenu(false);
                      }}
                    >
                      <Archive className="w-5 h-5 text-gray-400" />
                      <span className="flex-1 text-gray-900 dark:text-white">Unarchive Chat</span>
                    </button>
                  ) : (
                    <button
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                      onClick={() => {
                        onArchiveConversation?.();
                        setShowMenu(false);
                      }}
                    >
                      <Archive className="w-5 h-5 text-gray-400" />
                      <span className="flex-1 text-gray-900 dark:text-white">Archive Chat</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this conversation? This action cannot be undone.")) {
                        onDeleteConversation?.();
                        setShowMenu(false);
                      }
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="flex-1 font-medium">Delete Conversation</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <CallButton
            conversationId={conversationId}
            otherUser={otherUser}
            user={user}
            pusherRef={pusherRef}
            onOutgoingCall={onOutgoingCall}
          />
        </div>
      </div>
    </div>
  );
}
