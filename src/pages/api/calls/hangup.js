// /pages/api/calls/hangup.js
import { pusher } from "@/lib/pusher";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { conversationId, from, to, reason } = req.body;
  if (!conversationId || !from) {
    return res.status(400).json({ error: "conversationId and from required" });
  }

  try {
    await pusher.trigger(`presence-conversation-${conversationId}`, "call:hangup", {
      from,
      to,
      reason: reason || "hangup",
      ts: Date.now(),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("hangup api error", err);
    return res.status(500).json({ error: "failed to send hangup" });
  }
}
