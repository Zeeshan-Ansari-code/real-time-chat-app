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
 */
export default function CallButton({ conversationId, otherUser, user, pusherRef, onOutgoingCall }) {
  const [open, setOpen] = useState(false);

  const localUser = user || (typeof window !== "undefined" && JSON.parse(localStorage.getItem("user")));

  if (!conversationId || !otherUser || !localUser) return null;

  return (
    <>
      <button
        onClick={() => {
          console.log("📞 CallButton: Opening call modal for conversation:", conversationId);
          console.log("📞 CallButton: Other user:", otherUser);
          console.log("📞 CallButton: Current user:", localUser);
          setOpen(true);
          // Notify parent that outgoing call is being initiated
          onOutgoingCall?.(true);
        }}
        title="Start Video Call"
        className="p-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 hover:rotate-12"
      >
        <Video size={20} />
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
        />
      )}
    </>
  );
}
