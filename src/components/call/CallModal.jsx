"use client";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { pusherClient } from "@/lib/pusherClient";

export default function CallModal({ conversationId, otherUser, user, onClose, pusherRef: existingPusherRef, isIncoming = false, incomingOffer = null, isOutgoingCall = false }) {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const [status, setStatus] = useState(isIncoming ? "incoming" : "idle");
  const [pusher, setPusher] = useState(existingPusherRef || null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasProcessedAnswer, setHasProcessedAnswer] = useState(false);

  const pendingCandidatesRef = useRef([]);

  const CONFIG = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

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

  useEffect(() => {
    if (!pusher) {
      const client = pusherClient(user);
      setPusher(client);
    }
  }, [user, pusher]);

  useEffect(() => {
    if (!pusher) return;

    const timer = setTimeout(() => {
      const channelName = `presence-conversation-${conversationId}`;

      let channel;
      try {
        channel = pusher.subscribe(channelName);

        channel.bind("pusher:subscription_error", (error) => {});
        channel.bind("pusher:subscription_succeeded", () => {});

    const onOffer = (payload) => {
          if (!payload || !payload.from) {
            return;
          }

          if (String(payload.from.id) === String(user.id)) {
            return;
          }

          setStatus("incoming");
          pcRef.current = {
            incomingOffer: payload.sdp,
            from: payload.from
          };
        };

    const onRing = (payload) => {
      if (String(payload.from?.id) === String(user.id)) return;
      setStatus("ringing");
    };

    const onAnswer = async (payload) => {
      if (!payload?.sdp) return;

      if (hasProcessedAnswer) return;

      if (status === "in-call") return;

      if (!pcRef.current?.rtc) {
        if (status === "connecting") {
          let attempts = 0;
          const maxAttempts = 5;
          const checkConnection = () => {
            attempts++;
            if (pcRef.current?.rtc) {
              onAnswer(payload);
            } else if (attempts < maxAttempts) {
              setTimeout(checkConnection, attempts * 200);
            }
          };
          setTimeout(checkConnection, 200);
        }
        return;
      }

      const rtc = pcRef.current.rtc;

      if (hasProcessedAnswer) return;

      if (status === "in-call") return;

      if (rtc.connectionState === 'closed' || rtc.connectionState === 'failed') return;

      if (rtc.signalingState !== 'have-local-offer') return;

      if (rtc.remoteDescription) {
        setHasProcessedAnswer(true);
        setStatus("in-call");
        return;
      }

      if (rtc.signalingState === 'stable') {
        setHasProcessedAnswer(true);
        setStatus("in-call");
        return;
      }

      try {
        await rtc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        setHasProcessedAnswer(true);

        for (const cand of pendingCandidatesRef.current) {
          try {
            await rtc.addIceCandidate(cand);
          } catch (err) {}
        }
        pendingCandidatesRef.current = [];
        setStatus("in-call");
      } catch (error) {
        if (error.message.includes('stable')) return;
      }
    };

    const onIce = async (payload) => {
      if (!payload?.candidate) return;
      const candidate = new RTCIceCandidate(payload.candidate);

      if (pcRef.current?.rtc && pcRef.current.rtc.remoteDescription) {
        try {
          if (pcRef.current.rtc.connectionState === 'closed' || pcRef.current.rtc.connectionState === 'failed') return;

          await pcRef.current.rtc.addIceCandidate(candidate);
        } catch (e) {}
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const onHangup = () => {
      cleanup();
      onClose?.();
    };

        channel.bind("call:offer", onOffer);
        channel.bind("call:ring", onRing);
        channel.bind("call:answer", onAnswer);
        channel.bind("call:ice", onIce);
        channel.bind("call:hangup", onHangup);

        const cleanupChannel = () => {
          try {
            channel.unbind("call:offer", onOffer);
            channel.unbind("call:ring", onRing);
            channel.unbind("call:answer", onAnswer);
            channel.unbind("call:ice", onIce);
            channel.bind("call:hangup", onHangup);
            pusher.unsubscribe(channelName);
          } catch (error) {}
        };

        return cleanupChannel;

      } catch (error) {}
    }, 300); // 300ms delay for better cross-device synchronization

    // Cleanup timer on unmount
    return () => clearTimeout(timer);
  }, [pusher, conversationId, user, onClose]);

  useEffect(() => {
    if (isIncoming && incomingOffer) {
      pcRef.current = { incomingOffer, from: otherUser };
      setStatus("incoming");
    }
  }, [isIncoming, incomingOffer, otherUser]);

  useEffect(() => {
    if (status === "ringing" || status === "connecting") {}
  }, [status]);

  useEffect(() => {
    if (status === "in-call") {}
  }, [status]);

  useEffect(() => () => cleanup(), []);

  async function startLocalStream() {
    if (localStreamRef.current) return localStreamRef.current;

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

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        videoUtils.setupVideoElement(localVideoRef.current, stream, "Local");
      }

      return stream;
    } catch (error) {
      throw error;
    }
  }

  function cleanup() {
    try {
      if (localVideoRef.current) {
        localVideoRef.current.onloadedmetadata = null;
        localVideoRef.current.oncanplay = null;
        localVideoRef.current.onplaying = null;
        localVideoRef.current.onerror = null;
        localVideoRef.current.srcObject = null;
      }
       
      if (remoteVideoRef.current) {
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
    setStatus("idle");
    setHasProcessedAnswer(false);
  }

  async function createPeerConnectionAndAttach() {
    try {
      const rtc = new RTCPeerConnection(CONFIG);

      rtc.onconnectionstatechange = () => {
        if (rtc.connectionState === 'connected') {
        } else if (rtc.connectionState === 'failed') {
          cleanup();
        } else if (rtc.connectionState === 'closed') {
        } else if (rtc.connectionState === 'connecting') {
        } else if (rtc.connectionState === 'disconnected') {
        }
      };

      rtc.onsignalingstatechange = () => {};
      rtc.oniceconnectionstatechange = () => {};

      const localStream = await startLocalStream();
      const tracks = localStream.getTracks();

      tracks.forEach((track) => {
        try {
          rtc.addTrack(track, localStream);
        } catch (error) {}
      });

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

        if (remoteVideoRef.current) {
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

  async function initiateCall() {
     if (status === "connecting" || status === "ringing") {
       return;
     }

     setHasProcessedAnswer(false);
     setStatus("connecting");
     
     try {
       const rtc = await createPeerConnectionAndAttach();

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
      const rtc = await createPeerConnectionAndAttach();
       
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
              {status === "incoming" && !isOutgoingCall ? `📞 Incoming Call from ${otherUser.name}` : `${otherUser.name}`}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {status === "idle" && !isIncoming && "Click to start a video call"}
              {status === "incoming" && "Someone is calling you..."}
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

        {/* Content */}
        <div className="p-6">
          {status === "incoming" && !isOutgoingCall ? (
            <div className="text-center py-12">
              <div className="text-8xl mb-6 animate-pulse">📞</div>
              <h4 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
                {otherUser.name} is calling you
              </h4>
              <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
                You have an incoming video call
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button
                  onClick={acceptCall}
                  className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  Accept Call
                </button>
                <button
                  onClick={rejectCall}
                  className="px-8 py-4 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  Decline Call
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Local Video */}
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 shadow-lg">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  You (Local)
                </p>
                <div className="relative">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-64 lg:h-80 object-cover rounded-lg bg-gray-300 dark:bg-gray-600 shadow-inner"
                  />
                  {!localStreamRef.current && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-300 dark:bg-gray-600 rounded-lg">
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">No local video</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Remote Video */}
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 shadow-lg">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Remote
                </p>
                <div className="relative">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-64 lg:h-80 object-cover rounded-lg bg-gray-300 dark:bg-gray-600 shadow-inner"
                  />
                  {!remoteVideoRef.current?.srcObject && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-300 dark:bg-gray-600 rounded-lg">
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">Waiting for remote video...</p>
                      </div>
                    </div>
                  )}
                  {remoteVideoRef.current?.srcObject && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                      Connected
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {status === "idle" && !isIncoming && (
              <button 
                onClick={initiateCall} 
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Start Video Call
              </button>
            )}

            {status === "ringing" && (
              <button 
                onClick={leaveCall} 
                className="px-8 py-4 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel Call
              </button>
            )}

            {status === "connecting" && (
              <div className="flex items-center gap-3 px-8 py-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <div className="w-6 h-6 border-3 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-blue-600 dark:text-blue-400 font-medium">Connecting...</span>
              </div>
            )}

            {status === "in-call" && (
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={toggleMute} 
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
                  onClick={leaveCall} 
                  className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  End Call
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
