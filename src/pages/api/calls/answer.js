// /pages/api/calls/answer.js
import { pusher } from "@/lib/pusher";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  
  console.log("📞 Answer API: Received request body:", req.body);
  
  const { conversationId, from, to, sdp } = req.body;
  
  // Validate required fields
  if (!conversationId) {
    console.error("📞 Answer API: Missing conversationId");
    return res.status(400).json({ error: "conversationId is required" });
  }
  
  if (!from) {
    console.error("📞 Answer API: Missing from field");
    return res.status(400).json({ error: "from field is required" });
  }
  
  if (!sdp) {
    console.error("📞 Answer API: Missing sdp field");
    return res.status(400).json({ error: "sdp field is required" });
  }
  
  if (!sdp.sdp) {
    console.error("📞 Answer API: Invalid sdp format - missing sdp.sdp");
    return res.status(400).json({ error: "Invalid sdp format" });
  }
  
  console.log("📞 Answer API: Validation passed, processing answer...");

  try {
    await pusher.trigger(`presence-conversation-${conversationId}`, "call:answer", {
      from,
      to,
      sdp,
      ts: Date.now(),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("answer api error", err);
    return res.status(500).json({ error: "failed to send answer" });
  }
}
