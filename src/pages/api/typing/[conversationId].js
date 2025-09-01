import { pusher } from "@/lib/pusher";

export default async function handler(req, res) {
  const { conversationId } = req.query;

  if (req.method === "POST") {
    const { userId, name } = req.body;

    try {
      await pusher.trigger(`conversation-${conversationId}`, "typing", {
        userId,
        name,
      });
      res.status(200).json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Pusher trigger failed" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
