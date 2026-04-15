import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

export default async function handler(req, res) {
  if (!["GET", "PUT"].includes(req.method)) {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await connectDB();
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    if (req.method === "GET") {
      const user = await User.findById(userId).select("name email image createdAt").lean();
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.status(200).json(user);
    }

    const { requesterId, image, name } = req.body || {};
    if (!requesterId || String(requesterId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const update = {};
    if (typeof image === "string") update.image = image;
    if (typeof name === "string" && name.trim()) update.name = name.trim();

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "No valid fields provided" });
    }

    const updated = await User.findByIdAndUpdate(userId, update, { new: true })
      .select("name email image createdAt")
      .lean();
    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}

