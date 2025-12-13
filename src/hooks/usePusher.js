import { useEffect, useRef } from "react";
import { pusherClient } from "@/lib/pusherClient";

export function usePusher(user) {
  const pusherRef = useRef(null);
  const presenceRef = useRef(null);
  const conversationChannelsRef = useRef({});

  useEffect(() => {
    if (!user) return;

    // Cleanup old connections
    if (presenceRef.current) {
      try {
        presenceRef.current.unbind_all();
        const oldName = presenceRef.current.name;
        pusherRef.current?.unsubscribe(oldName);
      } catch (e) {}
      presenceRef.current = null;
    }
    if (pusherRef.current) {
      try {
        pusherRef.current.disconnect();
      } catch (e) {}
      pusherRef.current = null;
    }

    // Create new Pusher client
    pusherRef.current = pusherClient(user);
    const pusher = pusherRef.current;

    // Bind connection events
    pusher.connection.bind('connecting', () => {});

    pusher.connection.bind('connected', () => {
      setupPresenceChannel();
    });

    pusher.connection.bind('disconnected', () => {});

    pusher.connection.bind('error', (error) => {});

    if (pusher.connection.state === 'connected') {
      setupPresenceChannel();
    }

    function setupPresenceChannel() {
      if (presenceRef.current) {
        return;
      }

      presenceRef.current = pusher.subscribe("presence-online-users");
      const presenceChannel = presenceRef.current;

      presenceChannel.bind("pusher:subscription_succeeded", (members) => {
        const online = [];
        members.each((member) => {
          let userId = member.id || member.user_id || member.userId;
          let userName = member.info?.name || member.name || 'Unknown';
          if (userId !== user.id) {
            online.push({ id: userId, name: userName });
          }
        });
        // Return online users via callback if needed
      });

      presenceChannel.bind("pusher:subscription_error", (error) => {});

      presenceChannel.bind("pusher:member_added", (member) => {
        let userId = member.id || member.user_id || member.userId;
        let userName = member.info?.name || member.name || 'Unknown';
        if (userId !== user.id) {
          // Handle member added
        }
      });

      presenceChannel.bind("pusher:member_removed", (member) => {
        // Handle member removed
      });
    }

    return () => {
      try {
        presenceRef.current?.unbind_all();
        if (presenceRef.current) {
          pusherRef.current?.unsubscribe(presenceRef.current.name);
        }
        pusherRef.current?.disconnect();
      } catch (e) {}
    };
  }, [user]);

  // Cleanup on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        presenceRef.current?.unbind_all();
        if (presenceRef.current) {
          pusherRef.current?.unsubscribe(presenceRef.current.name);
        }
        pusherRef.current?.disconnect();
      } catch (e) {}
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return { pusherRef, presenceRef, conversationChannelsRef };
}

