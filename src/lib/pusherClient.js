import Pusher from "pusher-js";

export const pusherClient = (user) => {
  // Check if environment variables are set
  if (!process.env.NEXT_PUBLIC_PUSHER_KEY) {
    // NEXT_PUBLIC_PUSHER_KEY is not set
  }
  if (!process.env.NEXT_PUBLIC_PUSHER_CLUSTER) {
    // NEXT_PUBLIC_PUSHER_CLUSTER is not set
  }
  
  const pusher = new Pusher(
    process.env.NEXT_PUBLIC_PUSHER_KEY,
    {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      authEndpoint: "/api/pusher/auth",
             enabledTransports: ['ws', 'wss'], // Enable WebSocket transport
       forceTLS: true,
      auth: {
        params: {
          userId: user.id,
          userName: user.name
        }
      }
    }
  );
  
  return pusher;
};