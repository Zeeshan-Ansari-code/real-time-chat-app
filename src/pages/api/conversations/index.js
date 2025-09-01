import { connectDB } from "@/lib/mongoose";
import Conversation from "@/models/Conversation";
import User from "@/models/User";
import Message from "@/models/Message";

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      await connectDB();
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const conversations = await Conversation.find({
        participants: userId,
      })
        .populate("participants", "name email")
        .lean();

      const decorated = await Promise.all(
        conversations.map(async (conv) => {
          const lastMessage = await Message.findOne({ conversation: conv._id })
            .sort({ createdAt: -1 })
            .populate("sender", "name email")
            .lean();

          const unreadCount = await Message.countDocuments({
            conversation: conv._id,
            sender: { $ne: userId },
            seenBy: { $ne: userId },
          });

          return {
            ...conv,
            lastMessage,
            unreadCount,
          };
        })
      );

      return res.status(200).json(decorated);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  }

  if (req.method === "POST") {
    try {
      await connectDB();
      const { userId, otherUserId } = req.body;
      if (!userId || !otherUserId) {
        return res.status(400).json({ error: "userId and otherUserId are required" });
      }

      let conv = await Conversation.findOne({
        participants: { $all: [userId, otherUserId] },
      });

      if (!conv) {
        conv = await Conversation.create({ participants: [userId, otherUserId] });
      }

      return res.status(200).json({ conversationId: conv._id });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
