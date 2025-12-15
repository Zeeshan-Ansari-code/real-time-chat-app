"use client";
import { Sun, Moon, Search, Archive, X } from "lucide-react";
import { useState } from "react";

export default function Sidebar({
  dark,
  toggleDark,
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearching,
  onStartConversation,
  conversations,
  archivedConversations,
  user,
  onlineUsers,
  selectedConv,
  onSelectConversation,
  onUnarchiveConversation,
  onLogout,
  isLoggingOut,
  isLoadingChats
}) {
  const [showArchived, setShowArchived] = useState(false);
  return (
    <div className="w-full lg:w-80 xl:w-96 min-h-screen bg-gradient-to-b from-white via-blue-50/50 to-blue-100/60 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 shadow-sm relative">
      {/* Modern Header */}
      <div className="p-6 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Chats</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`relative p-2.5 rounded-lg transition-all duration-200 ${
                showArchived 
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
              title="Archives"
            >
              <Archive className="w-5 h-5" />
              {archivedConversations && archivedConversations.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md">
                  {archivedConversations.length}
                </span>
              )}
            </button>
            <button
              onClick={toggleDark}
              className="p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-all duration-200"
            >
              {dark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
        {/* Modern Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search people by name..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border-0 bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white dark:focus:bg-gray-800 transition-all duration-200 shadow-sm"
          />
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        </div>
      </div>
      <div className="px-4 pb-2 border-b border-gray-100 dark:border-gray-800">
        {searchQuery.trim().length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5 rounded-lg bg-white dark:bg-gray-900 p-2 shadow-sm border border-gray-100 dark:border-gray-800">
            {isSearching && (
              <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2">Searching...</div>
            )}
            {!isSearching && searchResults.length === 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2">No users found</div>
            )}
            {!isSearching && searchResults.map((u) => (
              <button
                key={u._id}
                onClick={() => onStartConversation(u._id)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/10 flex items-center justify-between transition-all duration-200 group"
              >
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">{u.name}</span>
                <span className="text-xs px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">Start chat</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Conversations List */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-2 py-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 120px)" }}
      >
        {isLoadingChats ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-white/60 dark:bg-gray-900/40 border border-gray-100/70 dark:border-gray-800 shadow-sm animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-200 dark:bg-gray-800 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-0">
            {conversations.length === 0 && archivedConversations?.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 p-6">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <Search className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                </div>
                <p className="text-center text-sm font-medium">No conversations yet</p>
                <p className="text-center text-xs mt-1 text-gray-400 dark:text-gray-600">Search for users to start chatting!</p>
              </div>
            )}
            {conversations.map((c) => {
              if (!c.participants || c.participants.length === 0) return null;
              const otherUser = c.participants.find((p) => p._id !== user.id);
              const isOnline = otherUser ? onlineUsers.some((u) => u.id === otherUser._id) : false;

              return (
                <li
                  key={c._id}
                  className={`mb-2 p-3 rounded-xl cursor-pointer transition-all duration-200 group shadow-sm border border-transparent ${
                    selectedConv === c._id 
                      ? "bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 border-blue-200/50 dark:border-blue-800/50" 
                      : "bg-white/60 dark:bg-gray-900/40 border-gray-100/70 dark:border-gray-800 hover:border-blue-200 hover:bg-blue-50/40 dark:hover:bg-blue-900/10"
                  }`}
                  onClick={() => onSelectConversation(c._id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md ${
                        selectedConv === c._id 
                          ? "bg-gradient-to-br from-blue-500 to-blue-600" 
                          : "bg-gradient-to-br from-blue-500 to-blue-600 opacity-80 group-hover:opacity-100"
                      } transition-all duration-200`}>
                        {otherUser?.name?.[0] || "?"}
                      </div>
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 shadow-md" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`font-semibold text-sm truncate ${
                            selectedConv === c._id 
                              ? "text-blue-900 dark:text-blue-100" 
                              : "text-gray-900 dark:text-white"
                          }`}>
                          {otherUser?.name || "Unknown User"}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-blue-500 text-white text-xs font-bold shadow-sm">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs leading-5 ${
                        selectedConv === c._id 
                          ? "text-blue-700 dark:text-blue-300" 
                          : "text-gray-600 dark:text-gray-400"
                      } line-clamp-1`}>
                        {c.lastMessage?.text || "No messages yet"}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      
      {/* Archived Chats Section */}
      {showArchived && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
          <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Archived Chats</span>
              {archivedConversations && archivedConversations.length > 0 && (
                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                  {archivedConversations.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowArchived(false)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors font-medium"
            >
              Close
            </button>
          </div>
          {archivedConversations && archivedConversations.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto px-2 py-2">
              {archivedConversations.map((c) => {
                if (!c.participants || c.participants.length === 0) return null;
                const otherUser = c.participants.find((p) => {
                  const pId = p._id || p;
                  return pId.toString() !== user.id.toString();
                });
                const otherUserId = otherUser?._id || otherUser;
                const isOnline = otherUserId ? onlineUsers.some((u) => u.id === otherUserId.toString()) : false;

                return (
                  <li
                    key={c._id}
                    className={`mb-1.5 p-3 rounded-xl transition-all duration-200 group ${
                      selectedConv === c._id 
                        ? "bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20" 
                        : "hover:bg-white dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                        onClick={() => onSelectConversation(c._id)}
                      >
                        <div className="relative w-10 h-10 flex-shrink-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white font-bold text-sm shadow-md opacity-75">
                            {otherUser?.name?.[0] || "?"}
                          </div>
                          {isOnline && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 shadow-md" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{otherUser?.name || "Unknown User"}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {c.lastMessage?.text || "No messages yet"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onUnarchiveConversation) {
                            onUnarchiveConversation(c._id);
                          }
                        }}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200 flex-shrink-0"
                        title="Remove from archive"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                <Archive className="w-6 h-6 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No archived chats</p>
            </div>
          )}
        </div>
      )}
      
      {/* User Profile & Logout */}
      <div
        className="sticky bottom-0 z-20 p-4 border-t border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur mt-auto pb-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-md">
            {user?.name?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.name || "User"}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || ""}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="w-full text-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-2.5 rounded-lg font-medium shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoggingOut ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Logging out...
            </>
          ) : (
            "Logout"
          )}
        </button>
      </div>
    </div>
  );
}

