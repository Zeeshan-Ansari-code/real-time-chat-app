import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

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

    const regex = new RegExp(q.trim(), "i");
    const filter = userId
      ? { _id: { $ne: userId }, name: regex }
      : { name: regex };

    const users = await User.find(filter)
      .select("name email")
      .limit(10)
      .lean();

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
}


