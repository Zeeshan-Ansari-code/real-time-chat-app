import { connectDB } from "@/lib/mongoose";
import Message from "@/models/Message";
import { pusher } from "@/lib/pusher";
import mongoose from "mongoose";

export default async function handler(req, res) {
  const { conversationId, messageId } = req.query;

  // Validate ObjectIds
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ error: "Invalid messageId" });
  }
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return res.status(400).json({ error: "Invalid conversationId" });
  }

  try {
    await connectDB();
  } catch (err) {
    return res.status(500).json({ error: "DB connection failed" });
  }

  if (req.method === "POST") {
    // Add reaction
    try {
      const { userId, emoji } = req.body;

      if (!userId || !emoji) {
        return res.status(400).json({ error: "userId and emoji are required" });
      }

      const message = await Message.findOne({ 
        _id: messageId, 
        conversation: conversationId 
      });
      
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Check if user already reacted with this emoji
      const existingReaction = message.reactions?.find(
        (r) => r.emoji === emoji && String(r.userId) === String(userId)
      );

      if (existingReaction) {
        await message.populate("reactions.userId", "name email");
        return res.status(200).json(message);
      }

      // Add reaction
      if (!message.reactions) {
        message.reactions = [];
      }
      message.reactions.push({
        emoji,
        userId,
        createdAt: new Date(),
      });

      await message.save();
      await message.populate("reactions.userId", "name email");

      // Notify via Pusher
      await pusher.trigger(`conversation-${conversationId}`, "message-reaction-added", {
        messageId: message._id,
        reaction: message.reactions[message.reactions.length - 1],
      });

      return res.status(200).json(message);
    } catch (err) {
      console.error("Error adding reaction:", err);
      return res.status(500).json({ error: "Server error while adding reaction" });
    }
  }

  if (req.method === "DELETE") {
    // Remove reaction
    try {
      const { userId, emoji } = req.body;

      if (!userId || !emoji) {
        return res.status(400).json({ error: "userId and emoji are required" });
      }

      const message = await Message.findOne({ 
        _id: messageId, 
        conversation: conversationId 
      });
      
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }

      // Remove reaction
      if (message.reactions && Array.isArray(message.reactions)) {
        message.reactions = message.reactions.filter(
          (r) => !(r.emoji === emoji && String(r.userId) === String(userId))
        );
        await message.save();
        await message.populate("reactions.userId", "name email");

        // Notify via Pusher
        await pusher.trigger(`conversation-${conversationId}`, "message-reaction-removed", {
          messageId: message._id,
          emoji,
          userId,
        });

        return res.status(200).json(message);
      }

      await message.populate("reactions.userId", "name email");
      return res.status(200).json(message);
    } catch (err) {
      console.error("Error removing reaction:", err);
      return res.status(500).json({ error: "Server error while removing reaction" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

