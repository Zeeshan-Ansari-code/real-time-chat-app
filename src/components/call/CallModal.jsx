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
  const [localStreamState, setLocalStreamState] = useState(null);
  const [facingMode, setFacingMode] = useState("user"); // "user" = front, "environment" = back
  const [availableCameras, setAvailableCameras] = useState([]);
  const [currentCameraId, setCurrentCameraId] = useState(null);

  const {
    pcRef,
    localStreamRef,
    pendingCandidatesRef,
    videoUtils,
    cleanup: cleanupWebRTC,
    createPeerConnectionAndAttach
  } = useWebRTC(conversationId, user, otherUser, setStatus);

  // Prevent background scroll while modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

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

  // Enumerate cameras on mount
  useEffect(() => {
    const enumerateCameras = async () => {
      try {
        // Request permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setAvailableCameras(videoDevices);
        if (videoDevices.length > 0 && !currentCameraId) {
          setCurrentCameraId(videoDevices[0].deviceId);
        }
      } catch (error) {
        console.error("Error enumerating cameras:", error);
      }
    };
    enumerateCameras();
  }, []);

  // Start local stream when modal opens in idle state
  useEffect(() => {
    if (status === "idle" && !isIncoming && !localStreamRef.current) {
      let cancelled = false;
      const startPreview = async () => {
        try {
          // Try to use deviceId if available, otherwise use facingMode
          const videoConstraints = currentCameraId && availableCameras.length > 0
            ? {
                deviceId: { ideal: currentCameraId },
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
                frameRate: { ideal: 30, min: 15 }
              }
            : {
                facingMode: { ideal: facingMode },
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
                frameRate: { ideal: 30, min: 15 }
              };

          const stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints,
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
          
          // Store current camera ID from the track
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const settings = videoTrack.getSettings();
            if (settings.deviceId) {
              setCurrentCameraId(settings.deviceId);
            }
          }
          
          if (localVideoRef.current) {
            videoUtils.setupVideoElement(localVideoRef.current, stream, "Local");
          }
        } catch (error) {
          console.error("Error starting preview:", error);
          setLocalStreamState(null);
        }
      };
      startPreview();
      return () => {
        cancelled = true;
        setLocalStreamState(null);
      };
    }
  }, [status, isIncoming, facingMode, currentCameraId, availableCameras.length]); // videoUtils is stable, no need to include

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
      const rtc = await createPeerConnectionAndAttach(localVideoRef, remoteVideoRef, null, setStatus, facingMode);

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
      const rtc = await createPeerConnectionAndAttach(localVideoRef, remoteVideoRef, null, setStatus, facingMode);
       
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
      to: pcRef.current?.from || otherUser || null,
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
    
    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn("No audio tracks found");
      return;
    }
    
    // Get current state from the first audio track
    const currentlyEnabled = audioTracks[0].enabled;
    const newMutedState = !currentlyEnabled;
    
    // Toggle all audio tracks
    audioTracks.forEach((t) => {
      t.enabled = newMutedState;
      console.log(`Audio track ${t.id} enabled: ${newMutedState}`);
    });
    
    // Update state - if tracks are enabled, we're NOT muted
    setIsMuted(!newMutedState);
    
    // Also update peer connection senders if in call
    if (pcRef.current?.rtc) {
      const senders = pcRef.current.rtc.getSenders();
      senders.forEach(sender => {
        if (sender.track && sender.track.kind === 'audio') {
          // The track replacement is handled automatically when we change enabled state
          // But we can also replace the track if needed
          if (sender.track !== audioTracks[0]) {
            sender.replaceTrack(audioTracks[0]).catch(err => {
              console.error("Error replacing audio track in peer connection:", err);
            });
          }
        }
      });
    }
  }

  async function switchCamera() {
    if (!localStreamRef.current) return;
    
    try {
      // First try using facingMode (more reliable on mobile)
      const newFacingMode = facingMode === "user" ? "environment" : "user";
      
      // Get new video stream with the selected camera
      // Use facingMode as string (not object) for better mobile compatibility
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
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

      // Get the old and new video tracks
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (!newVideoTrack) {
        throw new Error("Failed to get new video track");
      }

      // If peer connection exists (during call), replace the track FIRST
      if (pcRef.current?.rtc) {
        const sender = pcRef.current.rtc.getSenders().find(s => 
          s.track && s.track.kind === "video"
        );
        
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      // Update local stream - replace the track
      if (oldVideoTrack) {
        localStreamRef.current.removeTrack(oldVideoTrack);
      }
      localStreamRef.current.addTrack(newVideoTrack);

      // Update video element with the new stream
      if (localVideoRef.current) {
        videoUtils.setupVideoElement(localVideoRef.current, localStreamRef.current, "Local");
      }

      // Stop old video track after everything is set up
      if (oldVideoTrack) {
        oldVideoTrack.stop();
      }

      // Update state
      setFacingMode(newFacingMode);
      setLocalStreamState(localStreamRef.current);
      
      // Store current camera ID from the new track
      const settings = newVideoTrack.getSettings();
      if (settings.deviceId) {
        setCurrentCameraId(settings.deviceId);
      }

      // Stop other tracks from new stream (we only need the video track)
      newStream.getAudioTracks().forEach(t => t.stop());
    } catch (error) {
      console.error("Error switching camera with facingMode:", error);
      
      // Fallback: Try device enumeration approach
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length < 2) {
          console.warn("Only one camera available");
          return;
        }

        // Get current video track to find current camera
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        const currentSettings = currentVideoTrack?.getSettings();
        const currentDeviceId = currentSettings?.deviceId;

        // Find the other camera
        const targetDevice = videoDevices.find(device => device.deviceId !== currentDeviceId);
        
        if (!targetDevice) {
          console.warn("Could not find alternative camera");
          return;
        }

        // Get new stream with deviceId
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { ideal: targetDevice.deviceId },
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

        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        const newVideoTrack = newStream.getVideoTracks()[0];

        // Replace in peer connection if in call
        if (pcRef.current?.rtc) {
          const sender = pcRef.current.rtc.getSenders().find(s => 
            s.track && s.track.kind === "video"
          );
          if (sender) {
            await sender.replaceTrack(newVideoTrack);
          }
        }

        // Update local stream
        if (oldVideoTrack) {
          localStreamRef.current.removeTrack(oldVideoTrack);
        }
        localStreamRef.current.addTrack(newVideoTrack);

        // Update video element
        if (localVideoRef.current) {
          videoUtils.setupVideoElement(localVideoRef.current, localStreamRef.current, "Local");
        }

        // Stop old video track after everything is set up
        if (oldVideoTrack) {
          oldVideoTrack.stop();
        }

        setLocalStreamState(localStreamRef.current);
        setCurrentCameraId(targetDevice.deviceId);
        
        // Update facing mode based on device label
        const deviceLabel = targetDevice.label?.toLowerCase() || '';
        if (deviceLabel.includes('back') || deviceLabel.includes('rear') || deviceLabel.includes('environment')) {
          setFacingMode("environment");
        } else {
          setFacingMode("user");
        }

        newStream.getAudioTracks().forEach(t => t.stop());
      } catch (fallbackError) {
        console.error("Fallback camera switch also failed:", fallbackError);
      }
    }
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
              onSwitchCamera={switchCamera}
              canSwitchCamera={status === "in-call" && pcRef.current?.rtc !== null && availableCameras.length >= 2}
            />
          </div>
        </div>
      </div>
    );
  }

  // Incoming call or idle state - use modal
  const isIncomingCallModal = status === "incoming" && !isOutgoingCall;
  
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-6 overflow-y-auto">
      <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto border border-gray-200 dark:border-gray-700 ${isIncomingCallModal ? 'animate-pulse' : ''}`}>
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
                  onSwitchCamera={switchCamera}
                  canSwitchCamera={status === "idle" && localStreamRef.current !== null && availableCameras.length >= 2}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
