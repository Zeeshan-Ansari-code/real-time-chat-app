import { connectDB } from "@/lib/mongoose";
import Conversation from "@/models/Conversation";
import Archive from "@/models/Archive";
import User from "@/models/User";
import Message from "@/models/Message";
import mongoose from "mongoose";

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      await connectDB();
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      // Convert userId to ObjectId for proper query
      const userIdObj = mongoose.Types.ObjectId.isValid(userId) 
        ? new mongoose.Types.ObjectId(userId) 
        : userId;

      const { includeArchived } = req.query;
      
      let conversations;
      
      if (includeArchived === "true") {
        // Get archived conversations: Find all Archive documents for this user, then get the conversations
        const archives = await Archive.find({ user: userIdObj })
          .select("conversation")
          .lean();
        
        const archivedConversationIds = archives.map(a => a.conversation);
        
        if (archivedConversationIds.length === 0) {
          conversations = [];
        } else {
          conversations = await Conversation.find({
            _id: { $in: archivedConversationIds },
            participants: userIdObj
          })
            .populate("participants", "name email")
            .lean();
        }
      } else {
        // Get non-archived conversations: Get all conversations for user, exclude archived ones
        const archives = await Archive.find({ user: userIdObj })
          .select("conversation")
          .lean();
        
        const archivedConversationIds = archives.map(a => a.conversation);
        
        const query = { participants: userIdObj };
        if (archivedConversationIds.length > 0) {
          query._id = { $nin: archivedConversationIds };
        }
        
        conversations = await Conversation.find(query)
          .populate("participants", "name email")
          .lean();
      }

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
      return res.status(500).json({ error: "Server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
