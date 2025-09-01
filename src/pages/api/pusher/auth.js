// /pages/api/pusher/auth.js
import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  useTLS: true,
});

export default function handler(req, res) {
  const { socket_id, channel_name, userId, userName } = req.body;

  console.log("Auth request received:", { socket_id, channel_name, userId, userName });

  if (!userId || !userName) {
    return res.status(400).json({ error: "Missing user information" });
  }

  // Check if this is a presence channel
  if (channel_name.startsWith('presence-')) {
    // Authenticate user for presence channel
    const presenceData = {
      user_id: userId,
      user_info: {
        id: userId,
        name: userName,
      },
    };

    console.log("Authenticating presence channel:", presenceData);
    const auth = pusher.authenticate(socket_id, channel_name, presenceData);
    console.log("Presence auth response:", auth);
    res.send(auth);
  } 
  // Check if this is a private channel
  else if (channel_name.startsWith('private-')) {
    // For private channels, we need to verify the user has access to this conversation
    // Extract conversation ID from channel name (e.g., "private-conversation-123" -> "123")
    const conversationId = channel_name.replace('private-conversation-', '');
    
    // For now, allow access if user is authenticated (you can add more validation later)
    console.log("🔐 Authenticating private channel:", { 
      channel_name, 
      conversationId, 
      userId, 
      socket_id,
      timestamp: new Date().toISOString()
    });
    
    try {
      // Private channels don't need user data, just authenticate the socket
      const auth = pusher.authenticate(socket_id, channel_name);
      console.log("🔐 Private auth successful:", { 
        channel_name, 
        auth: JSON.stringify(auth).substring(0, 100) + "...",
        timestamp: new Date().toISOString()
      });
      res.send(auth);
    } catch (error) {
      console.error("❌ Private auth failed:", { 
        channel_name, 
        error: error.message,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({ error: "Authentication failed", details: error.message });
    }
  } 
  else {
    // Public channels don't need authentication
    console.log("Public channel, no auth needed:", channel_name);
    res.status(400).json({ error: "Channel type not supported" });
  }
}
