import axios from "axios";
import { connectDB } from "@/lib/mongoose";
import Message from "@/models/Message";
import Conversation from "@/models/Conversation";
import User from "@/models/User";
import mongoose from "mongoose";

/** HF Inference Router — models must have inference providers; DeepSeek-V3.2 has none on Router. */
const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_ROUTER_MODEL = "openai/gpt-oss-20b";

function uniqueModels(primary) {
  const list = [primary || DEFAULT_ROUTER_MODEL, DEFAULT_ROUTER_MODEL].filter(Boolean);
  return [...new Set(list)];
}

function stringifyHfError(err) {
  const d = err?.response?.data;
  if (typeof d === "string") return d.slice(0, 400);
  if (d && typeof d === "object") {
    try {
      return JSON.stringify(d).slice(0, 400);
    } catch (_) {
      return err?.message || "Unknown error";
    }
  }
  return err?.message || "Unknown error";
}

/**
 * Stream chat completion; throws if HTTP fails or stream signals error.
 * @returns {Promise<string>} full assistant text
 */
async function streamChatCompletion(apiKey, model, messages, onChunk) {
  const response = await axios.post(
    HF_ROUTER_URL,
    {
      model,
      messages,
      max_tokens: 1000,
      temperature: 0.7,
      stream: true,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      responseType: "stream",
      timeout: 120000,
    }
  );

  let fullResponse = "";
  let buffer = "";

  await new Promise((resolve, reject) => {
    response.data.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
            return;
          }
          const content = parsed.choices?.[0]?.delta?.content || "";
          if (content) {
            fullResponse += content;
            onChunk(content);
          }
        } catch (_) {
          // skip malformed lines
        }
      }
    });

    response.data.on("end", () => resolve());
    response.data.on("error", (err) => reject(err));
  });

  return fullResponse;
}

async function nonStreamChat(apiKey, model, messages) {
  const r = await axios.post(
    HF_ROUTER_URL,
    {
      model,
      messages,
      max_tokens: 1000,
      temperature: 0.7,
      stream: false,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 120000,
    }
  );
  const errObj = r.data?.error;
  if (errObj) {
    throw new Error(errObj.message || JSON.stringify(errObj));
  }
  return (r.data?.choices?.[0]?.message?.content || "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await connectDB();
    const { conversationId, message, userId } = req.body;

    if (!message || !userId) {
      return res.status(400).json({ error: "message and userId are required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const sendSSE = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let aiUser = await User.findOne({ email: "ai@assistant.com" }).lean();
    if (!aiUser) {
      aiUser = await User.create({
        name: "AI Assistant",
        email: "ai@assistant.com",
        password: "ai-assistant-no-password",
      });
    }

    let conversation;
    if (conversationId && conversationId !== "ai-chat" && mongoose.Types.ObjectId.isValid(conversationId)) {
      conversation = await Conversation.findById(conversationId).lean();
      if (!conversation) {
        sendSSE({ type: "error", error: "Conversation not found" });
        return res.end();
      }
    } else {
      const userIdObj = mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId;

      conversation = await Conversation.findOne({
        participants: { $all: [userIdObj, aiUser._id] },
      }).lean();

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [userIdObj, aiUser._id],
        });
      }
    }

    const userMessage = await Message.create({
      conversation: conversation._id,
      sender: userId,
      text: message,
      lang: null,
      seenBy: [userId],
    });

    await userMessage.populate("sender", "name email");
    sendSSE({ type: "user-message", message: userMessage });

    const recentMessages = await Message.find({
      conversation: conversation._id,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("sender", "name email")
      .lean();

    const messageHistory = recentMessages.reverse().map((msg) => ({
      role:
        msg?.sender?._id?.toString() === userId || msg?.sender?.toString() === userId
          ? "user"
          : "assistant",
      content: msg?.text || "",
    }));

    messageHistory.push({
      role: "user",
      content: message,
    });

    const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
    const envModel = process.env.HUGGINGFACE_MODEL;

    if (!huggingFaceApiKey) {
      sendSSE({ type: "error", error: "Hugging Face API key not configured" });
      return res.end();
    }

    const messages = messageHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    sendSSE({ type: "start" });

    const models = uniqueModels(envModel);
    let fullResponse = "";
    let lastErr = null;

    for (const model of models) {
      try {
        fullResponse = await streamChatCompletion(
          huggingFaceApiKey,
          model,
          messages,
          (content) => sendSSE({ type: "chunk", content })
        );
        if (fullResponse.trim()) break;
      } catch (e) {
        lastErr = e;
        console.error(`[chat-stream] HF stream failed (${model}):`, stringifyHfError(e));
      }

      try {
        const text = await nonStreamChat(huggingFaceApiKey, model, messages);
        if (text) {
          fullResponse = text;
          sendSSE({ type: "chunk", content: text });
          break;
        }
      } catch (e) {
        lastErr = e;
        console.error(`[chat-stream] HF non-stream failed (${model}):`, stringifyHfError(e));
      }
    }

    if (!fullResponse.trim()) {
      const hint =
        lastErr != null
          ? ` (${stringifyHfError(lastErr)})`
          : "";
      fullResponse =
        "I'm sorry, the AI could not respond right now." +
        (hint.length < 250 ? hint : "");
    }

    const aiMessage = await Message.create({
      conversation: conversation._id,
      sender: aiUser._id,
      text: fullResponse,
      lang: null,
      seenBy: [userId],
    });

    await aiMessage.populate("sender", "name email");

    await Conversation.findByIdAndUpdate(conversation._id, {
      updatedAt: new Date(),
    });

    sendSSE({ type: "complete", message: aiMessage });
    res.end();
  } catch (error) {
    console.error("AI Chat Stream Error:", error);
    res.write(
      `data: ${JSON.stringify({ type: "error", error: "Server error", details: error.message })}\n\n`
    );
    res.end();
  }
}
