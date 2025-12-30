import { connectDB } from "@/lib/mongoose";
import Conversation from "@/models/Conversation";
import Archive from "@/models/Archive";
import mongoose from "mongoose";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await connectDB();
    const { conversationId } = req.query;
    const { userId } = req.body;

    if (!conversationId || !userId) {
      return res.status(400).json({ error: "conversationId and userId are required" });
    }

    // Convert IDs to ObjectId
    const conversationIdObj = mongoose.Types.ObjectId.isValid(conversationId)
      ? new mongoose.Types.ObjectId(conversationId)
      : conversationId;
    const userIdObj = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : userId;

    // Verify conversation exists
    const conversation = await Conversation.findById(conversationIdObj);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Check if user is a participant
    const isParticipant = conversation?.participants?.some(
      (p) => {
        const pId = p?._id ? p._id.toString() : p?.toString();
        return pId === userId?.toString();
      }
    );
    if (!isParticipant) {
      return res.status(403).json({ error: "User is not a participant in this conversation" });
    }

    if (req.method === "POST") {
      // Archive conversation - create Archive document
      // The unique index will prevent duplicates
      try {
        await Archive.create({
          conversation: conversationIdObj,
          user: userIdObj
        });
        return res.status(200).json({ message: "Conversation archived", archived: true });
      } catch (err) {
        // If duplicate (already archived), return success
        if (err.code === 11000) {
          return res.status(200).json({ message: "Conversation already archived", archived: true });
        }
        throw err;
      }
    } else if (req.method === "DELETE") {
      // Unarchive conversation - delete Archive document
      const result = await Archive.deleteOne({
        conversation: conversationIdObj,
        user: userIdObj
      });
      
      return res.status(200).json({ 
        message: "Conversation unarchived", 
        archived: false,
        deleted: result.deletedCount > 0
      });
    }
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}

