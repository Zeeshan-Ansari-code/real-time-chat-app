import { connectDB } from "@/lib/mongoose";
import Message from "@/models/Message";
import mongoose from "mongoose";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await connectDB();
    const { conversationId, q, limit = 20, skip = 0 } = req.query;

    if (!conversationId || !q) {
      return res.status(400).json({ error: "conversationId and q are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ error: "Invalid conversationId" });
    }

    const searchQuery = q.trim();
    const searchRegex = new RegExp(searchQuery, "i");

    // Search messages with pagination
    const messages = await Message.find({
      conversation: conversationId,
      text: { $regex: searchRegex }
    })
      .populate("sender", "name email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    const totalCount = await Message.countDocuments({
      conversation: conversationId,
      text: { $regex: searchRegex }
    });

    return res.status(200).json({
      messages: messages.reverse(), // Return in chronological order
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: parseInt(skip) + parseInt(limit) < totalCount,
      },
    });
  } catch (err) {
    console.error("Search error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

