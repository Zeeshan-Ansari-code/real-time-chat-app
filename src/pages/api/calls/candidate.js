// /pages/api/calls/candidate.js
import { pusher } from "@/lib/pusher";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { conversationId, from, to, candidate } = req.body;
  if (!conversationId || !from || !candidate) {
    return res.status(400).json({ error: "conversationId, from and candidate required" });
  }

  try {
    await pusher.trigger(`presence-conversation-${conversationId}`, "call:ice", {
      from,
      to,
      candidate,
      ts: Date.now(),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "failed to send candidate" });
  }
}
