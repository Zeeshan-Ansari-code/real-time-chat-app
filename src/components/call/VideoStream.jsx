"use client";

export default function VideoStream({ videoRef, stream, label, isLocal = false, videoUtils }) {
  return (
    <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 shadow-lg">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${isLocal ? 'bg-blue-500' : 'bg-green-500'}`}></span>
        {label}
      </p>
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          className="w-full h-64 lg:h-80 object-cover rounded-lg bg-gray-300 dark:bg-gray-600 shadow-inner"
        />
        {!stream && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-300 dark:bg-gray-600 rounded-lg">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">{isLocal ? 'No local video' : 'Waiting for remote video...'}</p>
            </div>
          </div>
        )}
        {stream && !isLocal && (
          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
            Connected
          </div>
        )}
      </div>
    </div>
  );
}

