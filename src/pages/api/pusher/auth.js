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

    const auth = pusher.authenticate(socket_id, channel_name, presenceData);
    res.send(auth);
  } 
  // Check if this is a private channel
  else if (channel_name.startsWith('private-')) {
    try {
      // Private channels don't need user data, just authenticate the socket
      const auth = pusher.authenticate(socket_id, channel_name);
      res.send(auth);
    } catch (error) {
      res.status(500).json({ error: "Authentication failed", details: error.message });
    }
  } 
  else {
    // Public channels don't need authentication
    res.status(400).json({ error: "Channel type not supported" });
  }
}
