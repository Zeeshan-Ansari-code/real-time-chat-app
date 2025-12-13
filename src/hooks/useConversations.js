import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { pusherClient } from "@/lib/pusherClient";

export function useConversations(user, pusherRef, selectedConv, setOnlineUsers) {
  const [conversations, setConversations] = useState([]);
  const conversationChannelsRef = useRef({});

  // Load conversations
  useEffect(() => {
    if (!user) return;
    axios
      .get(`/api/conversations?userId=${user.id}`)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        const map = new Map(list.map((c) => [c._id, c]));
        setConversations(Array.from(map.values()));
      });
  }, [user]);

  // Subscribe to conversation channels
  useEffect(() => {
    if (!user) return;
    if (!pusherRef?.current) return;
    if (!Array.isArray(conversations)) return;

    const waitForPusherConnection = () => {
      if (pusherRef.current.connection.state === 'connected') {
        setupConversationChannels();
      } else {
        setTimeout(waitForPusherConnection, 100);
      }
    };

    waitForPusherConnection();

    function setupConversationChannels() {
      const pusher = pusherRef.current;
      const existing = conversationChannelsRef.current;
      const activeIds = new Set(conversations.map((c) => c._id));

      // Unsubscribe channels no longer needed
      Object.keys(existing).forEach((convId) => {
        if (!activeIds.has(convId)) {
          try {
            if (existing[convId].channel) {
              existing[convId].channel.unbind_all();
              pusher.unsubscribe(existing[convId].channel.name);
            }
            if (existing[convId].presenceChannel) {
              existing[convId].presenceChannel.unbind_all();
              pusher.unsubscribe(existing[convId].presenceChannel.name);
            }
          } catch (_) {}
          delete existing[convId];
        }
      });

      // Subscribe/bind for each conversation
      conversations.forEach((conv) => {
        const convId = conv._id;
        if (existing[convId]) return;

        const channel = pusher.subscribe(`conversation-${convId}`);
        const presenceChannel = pusher.subscribe(`presence-conversation-${convId}`);

        // Bind video call events to presence channel
        presenceChannel.bind("call:offer", (payload) => {
          if (String(payload.from?.id) === String(user.id)) return;
          // Handle incoming call - this will be passed via callback
        });

        channel.bind("new-message", (msg) => {
          const messageConvId = (msg.conversation?._id || msg.conversation);
          if (messageConvId !== convId) return;
          setConversations((prev) =>
            prev.map((c) => {
              if (c._id !== convId) return c;
              const isFromMe = (msg.sender?._id || msg.sender) === user.id;
              const isActive = selectedConv === convId;
              return {
                ...c,
                lastMessage: msg,
                unreadCount: isFromMe || isActive ? 0 : (c.unreadCount || 0) + 1,
              };
            })
          );
        });

        channel.bind("messages-seen", ({ userId }) => {
          if (userId === user.id) {
            setConversations((prev) =>
              prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c))
            );
          }
        });

        existing[convId] = { channel, presenceChannel };
      });
    }
  }, [conversations, user, selectedConv, pusherRef]);

  // Subscribe to per-user events
  useEffect(() => {
    if (!user) return;
    if (!pusherRef?.current) return;

    const pusher = pusherRef.current;
    const channel = pusher.subscribe(`user-${user.id}`);

    const handleUpsert = async ({ conversationId }) => {
      try {
        const res = await axios.get(`/api/conversations?userId=${user.id}`);
        const newList = Array.isArray(res.data) ? res.data : [];
        const newMap = new Map(newList.map((c) => [c._id, c]));
        setConversations(Array.from(newMap.values()));
      } catch (_) {}
    };

    channel.bind("conversation-upsert", handleUpsert);

    return () => {
      try { channel.unbind("conversation-upsert", handleUpsert); } catch (_) {}
      try { pusher.unsubscribe(`user-${user.id}`); } catch (_) {}
    };
  }, [user, pusherRef]);

  return { conversations, setConversations, conversationChannelsRef };
}

