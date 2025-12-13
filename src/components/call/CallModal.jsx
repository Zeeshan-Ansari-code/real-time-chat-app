"use client";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { pusherClient } from "@/lib/pusherClient";
import VideoStream from "./VideoStream";
import CallControls from "./CallControls";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useCallEvents } from "@/hooks/useCallEvents";

export default function CallModal({ conversationId, otherUser, user, onClose, pusherRef: existingPusherRef, isIncoming = false, incomingOffer = null, isOutgoingCall = false }) {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const [status, setStatus] = useState(isIncoming ? "incoming" : "idle");
  const [pusher, setPusher] = useState(existingPusherRef || null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasProcessedAnswer, setHasProcessedAnswer] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [localStreamState, setLocalStreamState] = useState(null);

  const {
    pcRef,
    localStreamRef,
    pendingCandidatesRef,
    videoUtils,
    cleanup: cleanupWebRTC,
    createPeerConnectionAndAttach
  } = useWebRTC(conversationId, user, otherUser, setStatus);

  useEffect(() => {
    if (!pusher && user) {
      const client = pusherClient(user);
      setPusher(client);
    }
  }, [user]); // Remove pusher from deps to avoid infinite loop

  // Use refs for callbacks to prevent infinite loops
  const onCloseRef = useRef(onClose);
  const cleanupRef = useRef(cleanup);
  
  useEffect(() => {
    onCloseRef.current = onClose;
    cleanupRef.current = cleanup;
  }, [onClose]);

  useCallEvents(
    pusher,
    conversationId,
    user,
    status,
    setStatus,
    pcRef,
    pendingCandidatesRef,
    setHasProcessedAnswer,
    hasProcessedAnswer,
    () => {
      cleanupRef.current();
      onCloseRef.current?.();
    }
  );

  useEffect(() => {
    if (isIncoming && incomingOffer) {
      pcRef.current = { incomingOffer, from: otherUser };
      // Only set to "incoming" if we're not already in a call state
      if (status === "idle" || status === "incoming") {
        setStatus("incoming");
      }
    }
  }, [isIncoming, incomingOffer, otherUser]);

  // Start local stream when modal opens in idle state
  useEffect(() => {
    if (status === "idle" && !isIncoming && !localStreamRef.current) {
      let cancelled = false;
      const startPreview = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              frameRate: { ideal: 30, min: 15 }
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: { ideal: 48000, min: 22050 }
            }
          });
          if (cancelled) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          localStreamRef.current = stream;
          setLocalStreamState(stream); // Trigger re-render with stream
          if (localVideoRef.current) {
            videoUtils.setupVideoElement(localVideoRef.current, stream, "Local");
          }
        } catch (error) {
          setLocalStreamState(null);
        }
      };
      startPreview();
      return () => {
        cancelled = true;
        setLocalStreamState(null);
      };
    }
  }, [status, isIncoming]); // videoUtils is stable, no need to include

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    cleanupWebRTC(localVideoRef, remoteVideoRef);
    setStatus("idle");
    setHasProcessedAnswer(false);
    setLocalStreamState(null);
  }

  async function initiateCall() {
    if (status === "connecting" || status === "ringing") {
      return;
    }

    setHasProcessedAnswer(false);
    setStatus("connecting");
    
    try {
      const rtc = await createPeerConnectionAndAttach(localVideoRef, remoteVideoRef, null, setStatus);

      if (!pcRef.current?.rtc) {
        throw new Error("Peer connection not properly stored");
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      const offer = await rtc.createOffer();
      await rtc.setLocalDescription(offer);

      await new Promise(resolve => setTimeout(resolve, 200));

      await axios.post("/api/calls/offer", {
        conversationId,
        from: user,
        to: otherUser,
        sdp: rtc.localDescription,
      });

      setStatus("ringing");
    } catch (error) {
      setStatus("idle");
      cleanup();
    }
  }

  async function acceptCall() {
    if (status === "connecting" || status === "in-call") {
      return;
    }

    setStatus("connecting");
    try {
      const rtc = await createPeerConnectionAndAttach(localVideoRef, remoteVideoRef, null, setStatus);
       
      await new Promise(resolve => setTimeout(resolve, 300));
       
      const incoming = pcRef.current?.incomingOffer;

      if (!incoming) {
        setStatus("incoming");
        return;
      }

      if (rtc.connectionState === 'closed' || rtc.connectionState === 'failed') {
        cleanup();
        return;
      }

      if (rtc.remoteDescription) {
        setStatus("in-call");
        return;
      }

      try {
        await rtc.setRemoteDescription(new RTCSessionDescription(incoming));
      } catch (error) {
        if (error.message.includes('stable')) {
          setStatus("in-call");
          return;
        }
        cleanup();
        return;
      }

      for (const cand of pendingCandidatesRef.current) {
        try {
          await rtc.addIceCandidate(cand);
        } catch (err) {}
      }
      pendingCandidatesRef.current = [];

      const answer = await rtc.createAnswer();
      await rtc.setLocalDescription(answer);

      const sender = pcRef.current.from || otherUser;

      if (!rtc.localDescription || !rtc.localDescription.sdp) {
        throw new Error("Invalid local description");
      }

      const answerPayload = {
        conversationId,
        from: user,
        to: sender,
        sdp: rtc.localDescription,
      };

      await axios.post("/api/calls/answer", answerPayload);

      setStatus("in-call");
    } catch (err) {
      cleanup();
    }
  }

  async function rejectCall() {
    await axios.post("/api/calls/hangup", {
      conversationId,
      from: user,
      to: pcRef.current?.from || otherUser,
      reason: "rejected",
    }).catch(() => { });
    cleanup();
    onClose?.();
  }

  async function leaveCall() {
    await axios.post("/api/calls/hangup", {
      conversationId,
      from: user,
      to: otherUser,
      reason: "left",
    }).catch(() => { });
    cleanup();
    onClose?.();
  }

  function toggleMute() {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setIsMuted((m) => !m);
  }

  // Full screen call UI
  if (status === "in-call" || status === "connecting" || status === "ringing") {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ padding: '16px', boxSizing: 'border-box' }}>
        {/* Remote Video - Full Screen with padding */}
        <div className="flex-1 relative bg-black rounded-lg overflow-hidden min-h-0" style={{ marginBottom: '16px' }}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {!remoteVideoRef.current?.srcObject && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center text-white">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold mb-4 mx-auto">
                  {otherUser?.name?.[0] || "?"}
                </div>
                <p className="text-xl font-semibold">{otherUser?.name || "Unknown"}</p>
                <p className="text-gray-400 mt-2">
                  {status === "connecting" && "Connecting..."}
                  {status === "ringing" && "Ringing..."}
                  {status === "in-call" && !remoteVideoRef.current?.srcObject && "Waiting for video..."}
                </p>
              </div>
            </div>
          )}

          {/* Local Video - Small in corner with padding from edges */}
          <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20 bg-black z-10">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {!localStreamRef.current && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="text-white text-xs">You</div>
              </div>
            )}
          </div>

          {/* Status indicator */}
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full z-10">
            <div className={`w-2 h-2 rounded-full ${status === "in-call" ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></div>
            <span className="text-white text-sm font-medium">
              {status === "connecting" && "Connecting..."}
              {status === "ringing" && "Ringing..."}
              {status === "in-call" && "Connected"}
            </span>
          </div>

          {/* Close button */}
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 backdrop-blur-sm hover:bg-black/70 transition-colors text-white z-10"
            onClick={() => { cleanup(); onClose?.(); }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Controls at bottom - Always visible with proper padding */}
        <div className="flex-shrink-0 bg-gradient-to-t from-black/95 via-black/90 to-transparent p-4 sm:p-6 rounded-lg">
          <div className="flex items-center justify-center gap-4 max-w-4xl mx-auto">
            <CallControls
              status={status}
              isMuted={isMuted}
              onMute={toggleMute}
              onHangup={leaveCall}
              onStartCall={initiateCall}
              isIncoming={isIncoming}
              onAccept={acceptCall}
              onReject={rejectCall}
            />
          </div>
        </div>
      </div>
    );
  }

  // Incoming call or idle state - use modal
  const isIncomingCallModal = status === "incoming" && !isOutgoingCall;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700 ${isIncomingCallModal ? 'animate-pulse' : ''}`}>
        {/* Header - Only show for non-incoming calls */}
        {!isIncomingCallModal && (
          <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {otherUser.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {status === "idle" && !isIncoming && "Click to start a video call"}
                {status === "ringing" && "Calling..."}
                {status === "connecting" && "Establishing connection..."}
                {status === "in-call" && "Connected"}
              </p>
            </div>
            <button
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
              onClick={() => { cleanup(); onClose?.(); }}
            >
              <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div className={isIncomingCallModal ? "p-8" : "p-6"}>
          {isIncomingCallModal ? (
            <CallControls
              status={status}
              isIncoming={true}
              onAccept={acceptCall}
              onReject={rejectCall}
              otherUser={otherUser}
            />
          ) : (
            <>
              {/* Show only local video preview in idle state */}
              <div className="flex justify-center">
                <div className="w-full max-w-2xl">
                  <VideoStream
                    videoRef={localVideoRef}
                    stream={localStreamState || localStreamRef.current}
                    label="You (Local)"
                    isLocal={true}
                    videoUtils={videoUtils}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <CallControls
                  status={status}
                  isMuted={isMuted}
                  onMute={toggleMute}
                  onHangup={leaveCall}
                  onStartCall={initiateCall}
                  isIncoming={isIncoming}
                  onAccept={acceptCall}
                  onReject={rejectCall}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
