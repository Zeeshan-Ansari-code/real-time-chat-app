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
  isLoggingOut
}) {
  const [showArchived, setShowArchived] = useState(false);
  return (
    <div className="w-full lg:w-80 xl:w-96 border-r dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl flex flex-col transition-all duration-300">
      <div className="p-4 lg:p-6 flex justify-between items-center border-b dark:border-gray-700">
        <h3 className="text-lg lg:text-xl font-bold dark:text-white">Chats</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 ${
              showArchived ? 'bg-gray-100 dark:bg-gray-800' : ''
            }`}
            title="Archives"
          >
            <Archive className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            {archivedConversations && archivedConversations.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {archivedConversations.length}
              </span>
            )}
          </button>
          <button
            onClick={toggleDark}
            className="p-2 lg:p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>
      <div className="p-4 border-b dark:border-gray-700">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search people by name..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
        {searchQuery.trim().length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
            {isSearching && (
              <div className="text-xs text-gray-500 dark:text-gray-400">Searching...</div>
            )}
            {!isSearching && searchResults.length === 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">No users found</div>
            )}
            {!isSearching && searchResults.map((u) => (
              <button
                key={u._id}
                onClick={() => onStartConversation(u._id)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 flex items-center justify-between transition-all duration-200 border border-transparent hover:border-blue-200 dark:hover:border-blue-700"
              >
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{u.name}</span>
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">Start chat</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <ul className="flex-1 overflow-y-auto">
        {conversations.length === 0 && archivedConversations?.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 p-4">
            <p className="text-center text-sm">No conversations yet.<br />Search for users to start chatting!</p>
          </div>
        )}
        {conversations.map((c) => {
          if (!c.participants || c.participants.length === 0) return null;
          const otherUser = c.participants.find((p) => p._id !== user.id);
          const isOnline = otherUser ? onlineUsers.some((u) => u.id === otherUser._id) : false;

          return (
            <li
              key={c._id}
              className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 dark:hover:from-gray-800 dark:hover:to-blue-900/20 transition-all duration-200 ${
                selectedConv === c._id ? "bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 border-r-4 border-blue-500" : ""
              }`}
              onClick={() => onSelectConversation(c._id)}
            >
              <div className="relative w-12 h-12">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {otherUser?.name?.[0] || "?"}
                </div>
                {isOnline && (
                  <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-3 border-white dark:border-gray-900 shadow-lg" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold dark:text-white">{otherUser?.name || "Unknown User"}</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[11rem]">
                    {c.lastMessage?.text || "No messages yet"}
                  </p>
                  {c.unreadCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-bold shadow-md">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      
      {/* Archived Chats Section - Always visible when showArchived is true */}
      {showArchived && (
        <div className="border-t dark:border-gray-700">
          <div className="p-3 flex items-center justify-between border-b dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Archived Chats</span>
              {archivedConversations && archivedConversations.length > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">({archivedConversations.length})</span>
              )}
            </div>
            <button
              onClick={() => setShowArchived(false)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
          {archivedConversations && archivedConversations.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto">
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
                    className={`p-3 flex items-center gap-3 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 dark:hover:from-gray-800 dark:hover:to-blue-900/20 transition-all duration-200 ${
                      selectedConv === c._id ? "bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 border-r-4 border-blue-500" : ""
                    }`}
                  >
                    <div 
                      className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
                      onClick={() => onSelectConversation(c._id)}
                    >
                      <div className="relative w-10 h-10 flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-gray-400 to-gray-600 flex items-center justify-center text-white font-bold text-sm shadow-lg opacity-75">
                          {otherUser?.name?.[0] || "?"}
                        </div>
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900 shadow-lg" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm dark:text-white truncate">{otherUser?.name || "Unknown User"}</p>
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
                      className="p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors flex-shrink-0"
                      title="Remove from archive"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              <Archive className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No archived chats</p>
            </div>
          )}
        </div>
      )}
      
      <div className="p-3 border-t dark:border-gray-700">
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="w-full text-sm bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
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

