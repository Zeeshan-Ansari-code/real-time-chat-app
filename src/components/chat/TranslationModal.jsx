"use client";

import { useState } from "react";

export default function TranslationModal({ message, onTranslate, onClose, isTranslating = false }) {
  const [selectedLang, setSelectedLang] = useState("");
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Translate Message</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          &quot;{message.text}&quot;
        </p>
        <div className="space-y-3">
          <select
            value={selectedLang}
            disabled={isTranslating}
            onChange={async (e) => {
              const nextLang = e.target.value;
              setSelectedLang(nextLang);
              if (nextLang) {
                await onTranslate(message._id, nextLang);
                onClose();
              }
            }}
            className="w-full p-2 border dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select language...</option>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="zh">Chinese</option>
            <option value="ar">Arabic</option>
          </select>
          {isTranslating && (
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-300">
              <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
              Translating message...
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={isTranslating}
            className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

