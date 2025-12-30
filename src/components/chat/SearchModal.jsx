"use client";
import { Search, X } from "lucide-react";
import { useState, useEffect } from "react";

export default function SearchModal({ isOpen, onClose, messages, user }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (!isOpen || !messages) {
      setSearchResults([]);
      return;
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery?.toLowerCase()?.trim();
    const results = messages
      ?.filter((msg) => {
        if (!msg?.text) return false;
        return msg?.text?.toLowerCase()?.includes(query);
      })
      ?.map((msg) => ({
        ...msg,
        highlightedText: msg?.text?.replace(
          new RegExp(`(${query})`, "gi"),
          "<mark>$1</mark>"
        ),
      })) || [];

    setSearchResults(results);
  }, [searchQuery, messages, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold dark:text-white">Search Messages</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in messages..."
            className="w-full pl-10 pr-4 py-3 border dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {searchQuery.trim() && searchResults.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No messages found
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((msg) => (
                <div
                  key={msg._id}
                  className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {msg.sender?._id === user.id ? "You" : msg.sender?.name || "Unknown"}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p
                    className="text-sm text-gray-900 dark:text-gray-100"
                    dangerouslySetInnerHTML={{ __html: msg.highlightedText }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

