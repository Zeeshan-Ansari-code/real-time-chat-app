import { useRef } from "react";
import axios from "axios";

const CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export function useWebRTC(conversationId, user, otherUser, setStatus = null) {
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  const videoUtils = {
    async playVideo(videoElement, streamType) {
      if (!videoElement || !videoElement.srcObject) return false;
      try {
        await videoElement.play();
        return true;
      } catch (error) {
        return false;
      }
    },

    setupVideoElement(videoElement, stream, streamType) {
      if (!videoElement || !stream) return;

      videoElement.srcObject = stream;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = streamType === "Local";
      
      videoElement.onloadedmetadata = null;
      videoElement.oncanplay = null;
      videoElement.onplaying = null;
      videoElement.onerror = null;

      videoElement.onloadedmetadata = () => {
        if (!videoElement || !videoElement.srcObject) return;
        if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
          videoUtils.playVideo(videoElement, streamType);
        }
      };

      videoElement.oncanplay = () => {
        if (!videoElement || !videoElement.srcObject) return;
        videoUtils.playVideo(videoElement, streamType);
      };

      videoElement.onplaying = () => {
        if (!videoElement || !videoElement.srcObject) return;
      };

      videoElement.onerror = () => {};
    }
  };

  async function startLocalStream(facingMode = "user", deviceId = null, isVoiceCall = false) {
    if (localStreamRef.current) return localStreamRef.current;

    try {
      // For voice calls, only request audio
      const mediaConstraints = isVoiceCall
        ? {
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: { ideal: 48000, min: 22050 }
            }
          }
        : {
            // Prefer deviceId if provided (more reliable on mobile)
            video: deviceId
              ? {
                  deviceId: { ideal: deviceId },
                  width: { ideal: 1280, min: 640 },
                  height: { ideal: 720, min: 480 },
                  frameRate: { ideal: 30, min: 15 }
                }
              : {
                  facingMode: { ideal: facingMode },
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
          };

      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      throw error;
    }
  }

  function cleanup(localVideoRef, remoteVideoRef) {
    try {
      if (localVideoRef?.current) {
        localVideoRef.current.onloadedmetadata = null;
        localVideoRef.current.oncanplay = null;
        localVideoRef.current.onplaying = null;
        localVideoRef.current.onerror = null;
        localVideoRef.current.srcObject = null;
      }
       
      if (remoteVideoRef?.current) {
        remoteVideoRef.current.onloadedmetadata = null;
        remoteVideoRef.current.oncanplay = null;
        remoteVideoRef.current.onplaying = null;
        remoteVideoRef.current.onerror = null;
        remoteVideoRef.current.srcObject = null;
      }
       
      if (pcRef.current?.rtc) {
        pcRef.current.rtc.close();
      }
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      
      if (window.currentRemoteStream) {
        window.currentRemoteStream = null;
      }
    } catch (error) {}
    
    pcRef.current = null;
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
  }

  async function createPeerConnectionAndAttach(localVideoRef, remoteVideoRef, onRemoteStream, setStatus, facingMode = "user", deviceId = null, isVoiceCall = false) {
    try {
      const rtc = new RTCPeerConnection(CONFIG);

      rtc.onconnectionstatechange = () => {
        if (rtc.connectionState === 'connected') {
          if (setStatus) {
            setStatus("in-call");
          }
        } else if (rtc.connectionState === 'failed') {
          cleanup(localVideoRef, remoteVideoRef);
        } else if (rtc.connectionState === 'connecting') {
          if (setStatus) setStatus("connecting");
        }
      };

      rtc.onsignalingstatechange = () => {};
      rtc.oniceconnectionstatechange = () => {};

      const localStream = await startLocalStream(facingMode, deviceId, isVoiceCall);
      const tracks = localStream.getTracks();

      tracks.forEach((track) => {
        try {
          rtc.addTrack(track, localStream);
        } catch (error) {}
      });

      // Only setup video element for video calls
      if (!isVoiceCall && localVideoRef?.current) {
        videoUtils.setupVideoElement(localVideoRef.current, localStream, "Local");
      }

      let remoteStream = null;

      rtc.ontrack = (evt) => {
        if (!remoteStream) {
          remoteStream = new MediaStream();
        }
         
        const existingTrack = remoteStream.getTracks().find(t => t.id === evt.track.id);
        if (existingTrack) {
          return;
        }
         
        remoteStream.addTrack(evt.track);
        window.currentRemoteStream = remoteStream;

        // Only setup video element if it's a video call and we have a video track
        const hasVideoTrack = remoteStream.getVideoTracks().length > 0;
        if (hasVideoTrack && remoteVideoRef?.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.autoplay = true;
          remoteVideoRef.current.playsInline = true;
          remoteVideoRef.current.muted = false;
           
          remoteVideoRef.current.onloadedmetadata = () => {
            if (!remoteVideoRef.current) return;
            if (remoteVideoRef.current.videoWidth > 0 && remoteVideoRef.current.videoHeight > 0) {
              remoteVideoRef.current.play().catch(e => {});
            }
          };
           
          remoteVideoRef.current.oncanplay = () => {
            if (!remoteVideoRef.current) return;
          };
           
          remoteVideoRef.current.onplaying = () => {
            if (!remoteVideoRef.current) return;
          };
           
          remoteVideoRef.current.onerror = () => {
            if (!remoteVideoRef.current) return;
          };
           
          setTimeout(() => {
            if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
              remoteVideoRef.current.play().catch(e => {});
            }
          }, 100);
        }

        if (onRemoteStream) {
          onRemoteStream(remoteStream);
        }
      };

      rtc.onicecandidate = (evt) => {
        if (evt.candidate) {
          axios.post("/api/calls/candidate", {
            conversationId,
            from: user,
            to: otherUser,
            candidate: evt.candidate,
          }).catch((err) => {});
        }
      };

      pcRef.current = { ...pcRef.current, rtc };
      return rtc;
    } catch (error) {
      throw error;
    }
  }

  return {
    pcRef,
    localStreamRef,
    pendingCandidatesRef,
    videoUtils,
    startLocalStream,
    cleanup,
    createPeerConnectionAndAttach
  };
}

