// /pages/api/calls/answer.js
import { pusher } from "@/lib/pusher";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  
  const { conversationId, from, to, sdp } = req.body;
  
  // Validate required fields
  if (!conversationId) {
    return res.status(400).json({ error: "conversationId is required" });
  }
  
  if (!from) {
    return res.status(400).json({ error: "from field is required" });
  }
  
  if (!sdp) {
    return res.status(400).json({ error: "sdp field is required" });
  }
  
  if (!sdp.sdp) {
    return res.status(400).json({ error: "Invalid sdp format" });
  }

  try {
    await pusher.trigger(`presence-conversation-${conversationId}`, "call:answer", {
      from,
      to,
      sdp,
      ts: Date.now(),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "failed to send answer" });
  }
}
