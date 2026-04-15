// /pages/api/calls/hangup.js
import { pusher } from "@/lib/pusher";
import { connectDB } from "@/lib/mongoose";
import Message from "@/models/Message";
import Conversation from "@/models/Conversation";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { conversationId, from, to, reason, callType, durationSec } = req.body;
  if (!conversationId || !from) {
    return res.status(400).json({ error: "conversationId and from required" });
  }

  try {
    const senderId = from?.id || from?._id || null;
    await connectDB();

    if (senderId) {
      const callLabel = callType === "voice" ? "Voice" : "Video";
      let text = `📴 ${callLabel} call ended`;
      if (reason === "rejected") {
        text = `❌ ${callLabel} call declined`;
      } else if (Number(durationSec) > 0) {
        const total = Number(durationSec);
        const mins = Math.floor(total / 60);
        const secs = total % 60;
        text = `📴 ${callLabel} call ended (${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")})`;
      }

      const callMessage = await Message.create({
        conversation: conversationId,
        sender: senderId,
        text,
        lang: null,
        seenBy: [senderId],
      });
      await callMessage.populate("sender", "name email image");
      await pusher.trigger(`conversation-${conversationId}`, "new-message", callMessage);

      const conv = await Conversation.findById(conversationId).lean();
      if (conv?.participants?.length) {
        for (const participantId of conv.participants) {
          await pusher.trigger(`user-${participantId}`, "conversation-upsert", { conversationId });
        }
      }
    }

    await pusher.trigger(`presence-conversation-${conversationId}`, "call:hangup", {
      from,
      to,
      reason: reason || "hangup",
      durationSec: Number(durationSec) || 0,
      ts: Date.now(),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "failed to send hangup" });
  }
}
