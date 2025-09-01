import { connectDB } from "@/lib/mongoose";
import Message from "@/models/Message";
import Conversation from "@/models/Conversation";
import { pusher } from "@/lib/pusher";
import mongoose from "mongoose";

export default async function handler(req, res) {
  const { conversationId } = req.query;

  // Validate ObjectId before queries
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return res.status(400).json({ error: "Invalid conversationId" });
  }

  try {
    await connectDB();
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    return res.status(500).json({ error: "DB connection failed" });
  }

  if (req.method === "GET") {
    try {
      const messages = await Message.find({ conversation: conversationId })
        .populate("sender", "name email")
        .populate("seenBy", "name email")
        .sort({ createdAt: 1 });

      return res.status(200).json(messages);
    } catch (err) {
      console.error("❌ Error fetching messages:", err);
      return res.status(500).json({ error: "Server error while fetching messages" });
    }
  }

  if (req.method === "POST") {
    try {
      const { senderId, text, lang, fileType, fileUrl, fileName, fileSize } = req.body;

      if (!senderId || (!text && !fileUrl)) {
        return res.status(400).json({ error: "senderId and either text or fileUrl are required" });
      }

      const newMessage = await Message.create({
        conversation: conversationId,
        sender: senderId,
        text: text || "",
        lang: lang || null,
        seenBy: [senderId], // sender has seen their own message
        fileType: fileType || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileSize: fileSize || null,
      });

      await newMessage.populate("sender", "name email");

      // 🔔 Notify via Pusher
      await pusher.trigger(`conversation-${conversationId}`, "new-message", newMessage);

      // Notify participants to upsert conversation in their sidebar
      try {
        const conv = await Conversation.findById(conversationId).lean();
        if (conv && Array.isArray(conv.participants)) {
          for (const participantId of conv.participants) {
            await pusher.trigger(`user-${participantId}`, "conversation-upsert", {
              conversationId,
            });
          }
        }
      } catch (_) {}

      return res.status(201).json(newMessage);
    } catch (err) {
      console.error("❌ Error creating message:", err);
      return res.status(500).json({ error: "Server error while creating message" });
    }
  }

  if (req.method === "PUT") {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      await Message.updateMany(
        { conversation: conversationId, seenBy: { $ne: userId } },
        { $addToSet: { seenBy: userId } }
      );

      await pusher.trigger(`conversation-${conversationId}`, "messages-seen", { userId });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("❌ Error marking seen:", err);
      return res.status(500).json({ error: "Server error while marking seen" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
