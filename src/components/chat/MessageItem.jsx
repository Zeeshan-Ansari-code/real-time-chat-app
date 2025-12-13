"use client";
import { File, Image as ImageIcon, Video, Music, FileText, AlertCircle } from "lucide-react";
import { useState } from "react";

export default function MessageItem({
  message,
  isOwnMessage,
  isSelected,
  onSelect,
  onTranslate,
  onDelete,
  formatFileSize,
  otherUserId,
  isTranslatingMessage,
  isDeletingMessage
}) {
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [audioError, setAudioError] = useState(false);
  return (
    <div
      className={`message-item-wrapper flex flex-col items-end space-y-1 relative ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2' : ''
      }`}
    >
      <div
        data-message-bubble
        className={`max-w-[85%] sm:max-w-sm lg:max-w-md px-4 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-lg relative transition-all duration-200 hover:shadow-xl ${
          isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
        } ${
          isOwnMessage
            ? "ml-auto bg-gradient-to-r from-blue-500 to-purple-600 text-white"
            : "mr-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
        }`}
        onClick={(e) => {
          e.stopPropagation(); // Prevent event from bubbling to document
          onSelect(message._id);
        }}
        style={{ cursor: 'pointer' }}
      >
        {/* File attachment */}
        {message.fileUrl && (
          <div className="mb-2">
            {message.fileType === 'image' && (
              <div onClick={(e) => e.stopPropagation()}>
                {!imageError ? (
                  <a
                    href={message.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={message.fileUrl}
                      alt={message.fileName || 'Image'}
                      className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ maxHeight: '200px' }}
                      onError={() => setImageError(true)}
                    />
                  </a>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 min-h-[150px]">
                    <ImageIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      Image not found
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-center">
                      {message.fileName || 'File may have been deleted'}
                    </p>
                    <a
                      href={message.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-xs text-blue-500 hover:text-blue-600 underline"
                    >
                      Try opening link
                    </a>
                  </div>
                )}
              </div>
            )}
            {message.fileType === 'video' && (
              <div onClick={(e) => e.stopPropagation()}>
                {!videoError ? (
                  <>
                    <video
                      src={message.fileUrl}
                      controls
                      className="max-w-full h-auto rounded-lg"
                      style={{ maxHeight: '200px' }}
                      onError={() => setVideoError(true)}
                    />
                    <a
                      href={message.fileUrl}
                      download={message.fileName}
                      className="text-xs text-white/70 hover:text-white mt-1 inline-block"
                    >
                      Download video
                    </a>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 min-h-[150px]">
                    <Video className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      Video not found
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-center">
                      {message.fileName || 'File may have been deleted'}
                    </p>
                    <a
                      href={message.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-xs text-blue-500 hover:text-blue-600 underline"
                    >
                      Try opening link
                    </a>
                  </div>
                )}
              </div>
            )}
            {message.fileType === 'audio' && (
              <div onClick={(e) => e.stopPropagation()}>
                {!audioError ? (
                  <>
                    <audio
                      src={message.fileUrl}
                      controls
                      className="w-full"
                      onError={() => setAudioError(true)}
                    />
                    <a
                      href={message.fileUrl}
                      download={message.fileName}
                      className="text-xs text-white/70 hover:text-white mt-1 inline-block"
                    >
                      Download audio
                    </a>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                    <Music className="w-10 h-10 text-gray-400 dark:text-gray-500 mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      Audio file not found
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-center">
                      {message.fileName || 'File may have been deleted'}
                    </p>
                    <a
                      href={message.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-xs text-blue-500 hover:text-blue-600 underline"
                    >
                      Try opening link
                    </a>
                  </div>
                )}
              </div>
            )}
            {(message.fileType === 'document' || message.fileType === 'other') && (
              <a
                href={message.fileUrl}
                download={message.fileName}
                className="flex items-center gap-2 p-2 bg-white/20 rounded hover:bg-white/30 transition-colors cursor-pointer"
                onClick={async (e) => {
                  e.stopPropagation();
                  // Check if file exists before downloading
                  try {
                    const response = await fetch(message.fileUrl, { method: 'HEAD' });
                    if (!response.ok) {
                      e.preventDefault();
                      alert('File not found. It may have been deleted.');
                    }
                  } catch (error) {
                    e.preventDefault();
                    alert('File not found. It may have been deleted.');
                  }
                }}
              >
                <File className="w-4 h-4" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{message.fileName}</p>
                  <p className="text-xs opacity-70">{formatFileSize(message.fileSize)}</p>
                </div>
                <span className="text-xs opacity-70">↓</span>
              </a>
            )}
          </div>
        )}

        {/* Message text */}
        {message.text && (
          <p>
            {message.translatedText || message.text}
            {message.lang && (
              <span className="ml-2 text-[10px] opacity-70">[{message.lang}]</span>
            )}
          </p>
        )}

        {/* Message actions for selected messages */}
        {isSelected && (
          <div className="message-actions absolute top-0 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 p-2 z-20 min-w-[120px]">
            <div className="flex flex-col gap-1">
              {message.text && typeof message.text === 'string' && message.text.trim().length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTranslate(message);
                  }}
                  disabled={isTranslatingMessage}
                  className="text-xs px-3 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {isTranslatingMessage ? (
                    <>
                      <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                      Translating...
                    </>
                  ) : (
                    <>
                      <span>🌐</span>
                      <span>Translate</span>
                    </>
                  )}
                </button>
              )}
              {isOwnMessage && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(message);
                  }}
                  disabled={isDeletingMessage}
                  className="text-xs px-3 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  {isDeletingMessage ? (
                    <>
                      <div className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <span>🗑️</span>
                      <span>Delete</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {isOwnMessage && (
        <span className="text-[10px] text-gray-400 mr-2">
          {Array.isArray(message.seenBy) && otherUserId && message.seenBy.some((s) => (s?._id || s) === otherUserId)
            ? "Seen"
            : "Sent"}
        </span>
      )}
    </div>
  );
}

