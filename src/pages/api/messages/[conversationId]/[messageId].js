import { connectDB } from "@/lib/mongoose";
import Message from "@/models/Message";
import { pusher } from "@/lib/pusher";
import mongoose from "mongoose";

export default async function handler(req, res) {
  const { conversationId, messageId } = req.query;

  // Validate ObjectIds
  if (!mongoose.Types.ObjectId.isValid(conversationId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ error: "Invalid conversationId or messageId" });
  }

  try {
    await connectDB();
  } catch (err) {
    return res.status(500).json({ error: "DB connection failed" });
  }

  if (req.method === "DELETE") {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      // Find the message to check ownership
      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Only allow sender to delete their own message
      if (message.sender.toString() !== userId) {
        return res.status(403).json({ error: "You can only delete your own messages" });
      }

      // Delete the message
      await Message.findByIdAndDelete(messageId);

      // 🔔 Notify via Pusher
      await pusher.trigger(`conversation-${conversationId}`, "message-deleted", { messageId });

      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: "Server error while deleting message" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
