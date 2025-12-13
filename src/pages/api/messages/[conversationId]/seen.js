import { connectDB } from "@/lib/mongoose";
import Message from "@/models/Message";
import { pusher } from "@/lib/pusher";

export default async function handler(req, res) {
  const { conversationId } = req.query;

  if (req.method === "PUT") {
    const { userId } = req.body;

    try {
      await connectDB();

      // ✅ Mark all unseen messages in this conversation as seen by this user
      const updated = await Message.updateMany(
        { conversation: conversationId, "seenBy": { $ne: userId } },
        { $addToSet: { seenBy: userId } }
      );

      // ✅ Trigger Pusher so other clients know messages were seen
      await pusher.trigger(`conversation-${conversationId}`, "message-seen", {
        userId,
        conversationId,
      });

      res.status(200).json({ success: true, updated: updated.modifiedCount });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
