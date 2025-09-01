import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (_) {
    return res.status(500).json({ error: "DB error" });
  }

  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "userId required" });

  if (req.method === "GET") {
    const user = await User.findById(userId).select("langPrefs").lean();
    return res.status(200).json(user?.langPrefs || {});
  }

  if (req.method === "PUT") {
    const { targetUserId, targetLang } = req.body || {};
    if (!targetUserId || !targetLang) {
      return res.status(400).json({ error: "targetUserId and targetLang required" });
    }
    const update = {};
    update["langPrefs." + targetUserId] = targetLang;
    await User.updateOne({ _id: userId }, { $set: update });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}


