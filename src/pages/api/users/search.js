import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import mongoose from "mongoose";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await connectDB();
    const { q = "", userId } = req.query;

    if (!q || typeof q !== "string" || q.trim().length === 0) {
      return res.status(200).json([]);
    }

    const searchQuery = q.trim();
    const userIdObj = userId ? new mongoose.Types.ObjectId(userId) : null;

    // Try text search first (faster if text index exists)
    let users = [];
    try {
      const textFilter = userIdObj
        ? { $text: { $search: searchQuery }, _id: { $ne: userIdObj } }
        : { $text: { $search: searchQuery } };
      
      users = await User.find(textFilter)
        .select("name email")
        .limit(10)
        .lean();
    } catch (textSearchError) {
      // Fallback to regex if text index doesn't exist
      const regex = new RegExp(searchQuery, "i");
      const filter = userIdObj
        ? { _id: { $ne: userIdObj }, $or: [{ name: regex }, { email: regex }] }
        : { $or: [{ name: regex }, { email: regex }] };

      users = await User.find(filter)
        .select("name email")
        .limit(10)
        .lean();
    }

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
}


