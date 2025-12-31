// /pages/api/calls/offer.js
import { pusher } from "@/lib/pusher";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { conversationId, from, to, sdp, callType } = req.body;
  if (!conversationId || !from || !sdp) {
    return res.status(400).json({ error: "conversationId, from and sdp required" });
  }

  try {
    // send the offer to the conversation channel
    await pusher.trigger(`presence-conversation-${conversationId}`, "call:offer", {
      from,
      to,
      sdp,
      callType: callType || "video", // Default to video for backward compatibility
      ts: Date.now(),
    });

    // optional: notify caller that ring was emitted
    await pusher.trigger(`presence-conversation-${conversationId}`, "call:ring", {
      from,
      to,
      ts: Date.now(),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "failed to send offer" });
  }
}
