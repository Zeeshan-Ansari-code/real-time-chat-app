import { useEffect } from "react";
import axios from "axios";
import { pusherClient } from "@/lib/pusherClient";

export function useMessageLoading(
  user,
  selectedConv,
  setMessages,
  setSelectedConv,
  setConversations,
  recvLangRef,
  translateCacheRef,
  translatingCounterRef,
  setIsTranslating,
  setTypingUsers,
  setIncomingCall,
  setShowCallModal,
  scrollToBottom
) {
  useEffect(() => {
    if (!selectedConv || !user) return;

    const loadMessages = async () => {
      const res = await axios.get(`/api/messages/${selectedConv}`);
      setMessages(res.data);
      setTimeout(() => scrollToBottom(), 0);
      setConversations((prev) => prev.map((c) => (c._id === selectedConv ? { ...c, unreadCount: 0 } : c)));

      const pusher = pusherClient(user);
      const channel = pusher.subscribe(`conversation-${selectedConv}`);
      const presenceChannel = pusher.subscribe(`presence-conversation-${selectedConv}`);

      presenceChannel.bind("pusher:subscription_succeeded", () => {});

      presenceChannel.bind("pusher:subscription_error", (error) => {});

      channel.bind("new-message", async (data) => {
        let enriched = data;
        const currentTarget = recvLangRef.current;

        const hasTextContent = data.text && typeof data.text === 'string' && data.text.trim().length > 0;
        const needsTranslate = currentTarget && currentTarget !== (data.lang || "") && hasTextContent;
        if (needsTranslate) {
          translatingCounterRef.current += 1;
          setIsTranslating(true);
          try {
            const key = `${data._id}:${currentTarget}`;
            const cache = translateCacheRef.current;
            if (cache.has(key)) {
              enriched = { ...data, translatedText: cache.get(key) };
            } else {
              const resp = await axios.post('/api/translate', { q: data.text, source: data.lang || 'auto', target: currentTarget });
              const text = resp.data?.translatedText || data.text;
              cache.set(key, text);
              enriched = { ...data, translatedText: text };
            }
          } catch (_) {
            enriched = { ...data, translatedText: data.text };
          } finally {
            translatingCounterRef.current = Math.max(0, translatingCounterRef.current - 1);
            if (translatingCounterRef.current === 0) setIsTranslating(false);
          }
        }
        setMessages((prev) => [...prev, enriched]);
      });

      channel.bind("messages-seen", ({ userId }) =>
        setMessages((prev) =>
          prev.map((msg) =>
            msg.seenBy?.includes(userId)
              ? msg
              : { ...msg, seenBy: [...(msg.seenBy || []), userId] }
          )
        )
      );

      channel.bind("message-deleted", ({ messageId }) => {
        setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
      });

      channel.bind("typing", ({ userId, name }) => {
        if (userId !== user.id) {
          setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
          setTimeout(() => {
            setTypingUsers((prev) => prev.filter((n) => n !== name));
          }, 1500);
        }
      });

      presenceChannel.bind("call:offer", (payload) => {
        if (String(payload.from?.id) === String(user.id)) {
          return;
        }
        setIncomingCall(payload);
        setShowCallModal(true);
      });

      await axios.put(`/api/messages/${selectedConv}`, { userId: user.id });
    };

    loadMessages();
  }, [selectedConv, user]);
}

