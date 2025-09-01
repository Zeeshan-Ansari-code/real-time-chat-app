import Pusher from "pusher-js";

export const pusherClient = (user) => {
  console.log("🔗 Pusher client config:", {
    key: process.env.NEXT_PUBLIC_PUSHER_KEY,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    user: user
  });
  
  // Check if environment variables are set
  if (!process.env.NEXT_PUBLIC_PUSHER_KEY) {
    console.error("❌ NEXT_PUBLIC_PUSHER_KEY is not set!");
  }
  if (!process.env.NEXT_PUBLIC_PUSHER_CLUSTER) {
    console.error("❌ NEXT_PUBLIC_PUSHER_CLUSTER is not set!");
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
  
  console.log("🔗 Pusher instance created:", pusher);
  return pusher;
};