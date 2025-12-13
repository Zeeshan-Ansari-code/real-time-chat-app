import { useEffect, useRef } from "react";
import axios from "axios";
import { pusherClient } from "@/lib/pusherClient";

export function useCallEvents(
  pusher,
  conversationId,
  user,
  status,
  setStatus,
  pcRef,
  pendingCandidatesRef,
  setHasProcessedAnswer,
  hasProcessedAnswer,
  onHangup
) {
  // Use refs to track values to avoid stale closures and infinite loops
  const statusRef = useRef(status);
  const hasProcessedAnswerRef = useRef(hasProcessedAnswer);
  const onHangupRef = useRef(onHangup);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    hasProcessedAnswerRef.current = hasProcessedAnswer;
  }, [hasProcessedAnswer]);

  useEffect(() => {
    onHangupRef.current = onHangup;
  }, [onHangup]);

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
          
          // Ignore if answer is from self
          if (String(payload.from?.id) === String(user.id)) {
            return;
          }
          
          const currentStatus = statusRef.current;
          const currentHasProcessed = hasProcessedAnswerRef.current;
          
          if (currentHasProcessed) {
            return;
          }
          if (currentStatus === "in-call") {
            return;
          }

          // If peer connection doesn't exist yet, wait for it (for ringing state)
          if (!pcRef.current?.rtc) {
            if (currentStatus === "ringing" || currentStatus === "connecting") {
              setStatus("connecting");
              let attempts = 0;
              const maxAttempts = 10;
              const checkConnection = () => {
                attempts++;
                if (pcRef.current?.rtc) {
                  // Retry processing answer once RTC is ready
                  setTimeout(() => onAnswer(payload), 100);
                } else if (attempts < maxAttempts) {
                  setTimeout(checkConnection, attempts * 200);
                }
              };
              setTimeout(checkConnection, 200);
            }
            return;
          }

          const rtc = pcRef.current.rtc;

          // Check again with refs
          if (hasProcessedAnswerRef.current) return;
          if (statusRef.current === "in-call") return;
          if (rtc.connectionState === 'closed' || rtc.connectionState === 'failed') {
            return;
          }
          
          // Update status to connecting when answer is received (if still ringing)
          if (statusRef.current === "ringing") {
            setStatus("connecting");
          }

          // Check if we already have a remote description
          if (rtc.remoteDescription) {
            setHasProcessedAnswer(true);
            setStatus("in-call");
            return;
          }

          // Accept answer - should be in 'have-local-offer' state when we receive answer
          if (rtc.signalingState !== 'have-local-offer') {
            // Wait a bit and retry if state is not ready
            setTimeout(() => onAnswer(payload), 300);
            return;
          }

          try {
            await rtc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            setHasProcessedAnswer(true);
            setStatus("connecting");

            // Add pending ICE candidates
            for (const cand of pendingCandidatesRef.current) {
              try {
                await rtc.addIceCandidate(cand);
              } catch (err) {}
            }
            pendingCandidatesRef.current = [];
            
            // Check connection state immediately after setting remote description
            // Sometimes the connection is already established
            if (rtc.connectionState === 'connected') {
              setStatus("in-call");
            } else {
              // Status will be updated to "in-call" when connection is established
              // via the connectionstatechange handler in useWebRTC
              
              // Fallback: if connection state doesn't change within 2 seconds, check and update
              setTimeout(() => {
                const currentState = rtc.connectionState;
                if (currentState === 'connected' || currentState === 'connecting') {
                  if (statusRef.current !== "in-call") {
                    setStatus("in-call");
                  }
                }
              }, 2000);
            }
          } catch (error) {
            if (error.message.includes('stable')) {
              setHasProcessedAnswer(true);
              setStatus("in-call");
              return;
            }
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

        const onHangupHandler = () => {
          onHangupRef.current?.();
        };

        channel.bind("call:offer", onOffer);
        channel.bind("call:ring", onRing);
        channel.bind("call:answer", onAnswer);
        channel.bind("call:ice", onIce);
        channel.bind("call:hangup", onHangupHandler);

        return () => {
          try {
            channel.unbind("call:offer", onOffer);
            channel.unbind("call:ring", onRing);
            channel.unbind("call:answer", onAnswer);
            channel.unbind("call:ice", onIce);
            channel.unbind("call:hangup", onHangupHandler);
            pusher.unsubscribe(channelName);
          } catch (error) {}
        };
      } catch (error) {
        return () => {};
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [pusher, conversationId, user, setStatus, pcRef, pendingCandidatesRef, setHasProcessedAnswer]);
}

