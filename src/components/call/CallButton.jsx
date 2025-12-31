"use client";
import { useState } from "react";
import CallModal from "./CallModal";
import { Phone, Video } from "lucide-react";

/**
 * Props:
 * - conversationId
 * - otherUser (object with _id, name)
 * - user (object with id, name) — if not passed will attempt localStorage 'user'
 * - pusherRef (optional) — if you already have pusher client instance
 * - callType: "video" | "voice" (default: "video")
 */
export default function CallButton({ conversationId, otherUser, user, pusherRef, onOutgoingCall, callType = "video" }) {
  const [open, setOpen] = useState(false);

  const localUser = user || (typeof window !== "undefined" && JSON.parse(localStorage.getItem("user")));

  if (!conversationId || !otherUser || !localUser) return null;

  const isVoiceCall = callType === "voice";

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          onOutgoingCall?.(true);
        }}
        title={isVoiceCall ? "Start Voice Call" : "Start Video Call"}
        className={`p-3 rounded-full text-white hover:shadow-xl transition-all duration-200 transform hover:scale-105 ${
          isVoiceCall
            ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
        } shadow-lg hover:rotate-12`}
      >
        {isVoiceCall ? <Phone size={20} /> : <Video size={20} />}
      </button>

      {open && (
        <CallModal
          conversationId={conversationId}
          otherUser={otherUser}
          user={localUser}
          onClose={() => {
            setOpen(false);
            // Notify parent that outgoing call is finished
            onOutgoingCall?.(false);
          }}
          pusherRef={pusherRef}
          callType={callType}
        />
      )}
    </>
  );
}
