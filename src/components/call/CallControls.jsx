"use client";

export default function CallControls({ status, isMuted, onMute, onHangup, onStartCall, isIncoming, onAccept, onReject, otherUser }) {
  if (status === "incoming" && isIncoming) {
    return (
      <div className="text-center py-8">
        {/* Animated Avatar Circle */}
        <div className="relative mb-8 flex justify-center">
          <div className="relative">
            {/* Pulsing rings animation */}
            <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping"></div>
            <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" style={{ animationDelay: '0.5s' }}></div>
            <div className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping" style={{ animationDelay: '1s' }}></div>
            
            {/* Avatar */}
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-5xl font-bold text-white shadow-2xl border-4 border-white">
              {otherUser?.name?.[0]?.toUpperCase() || "?"}
            </div>
          </div>
        </div>

        {/* Caller Name */}
        <h2 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">
          {otherUser?.name || "Unknown"}
        </h2>
        
        {/* Call Status */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <p className="text-lg text-gray-600 dark:text-gray-400 font-medium">
            Incoming Video Call
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-md mx-auto">
          {/* Accept Button */}
          <button
            onClick={onAccept}
            className="group relative px-10 py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl hover:from-green-600 hover:to-emerald-700 text-lg font-bold shadow-2xl hover:shadow-green-500/50 transition-all duration-300 transform hover:scale-110 flex items-center justify-center gap-3 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
            <svg className="w-6 h-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="relative z-10">Accept</span>
          </button>

          {/* Decline Button */}
          <button
            onClick={onReject}
            className="group relative px-10 py-5 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-2xl hover:from-red-600 hover:to-pink-700 text-lg font-bold shadow-2xl hover:shadow-red-500/50 transition-all duration-300 transform hover:scale-110 flex items-center justify-center gap-3 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
            <svg className="w-6 h-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="relative z-10">Decline</span>
          </button>
        </div>
      </div>
    );
  }

  if (status === "idle" && !isIncoming) {
    return (
      <button 
        onClick={onStartCall} 
        className="px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Start Video Call
      </button>
    );
  }

  if (status === "ringing") {
    return (
      <button 
        onClick={onHangup} 
        className="px-8 py-4 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        Cancel Call
      </button>
    );
  }

  if (status === "connecting") {
    return (
      <div className="flex items-center gap-3 px-8 py-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
        <div className="w-6 h-6 border-3 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
        <span className="text-blue-600 dark:text-blue-400 font-medium">Connecting...</span>
      </div>
    );
  }

  if (status === "in-call") {
    return (
      <div className="flex flex-col sm:flex-row gap-4">
        <button 
          onClick={onMute} 
          className={`px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2 ${
            isMuted 
              ? 'bg-gray-500 hover:bg-gray-600 text-white' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isMuted ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
              Unmute
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              Mute
            </>
          )}
        </button>
        <button 
          onClick={onHangup} 
          className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          End Call
        </button>
      </div>
    );
  }

  return null;
}

