import axios from "axios";
import { connectDB } from "@/lib/mongoose";
import Message from "@/models/Message";
import Conversation from "@/models/Conversation";
import User from "@/models/User";
import mongoose from "mongoose";

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

    // Set up Server-Sent Events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Helper function to send SSE data
    const sendSSE = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Get or create AI user
    let aiUser = await User.findOne({ email: "ai@assistant.com" }).lean();
    if (!aiUser) {
      aiUser = await User.create({
        name: "AI Assistant",
        email: "ai@assistant.com",
        password: "ai-assistant-no-password",
      });
    }
    const aiUserId = aiUser._id.toString();

    // Get or create AI conversation
    let conversation;
    if (conversationId && conversationId !== "ai-chat" && mongoose.Types.ObjectId.isValid(conversationId)) {
      conversation = await Conversation.findById(conversationId).lean();
      if (!conversation) {
        sendSSE({ type: "error", message: "Conversation not found" });
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

    // Save user message
    const userMessage = await Message.create({
      conversation: conversation._id,
      sender: userId,
      text: message,
      lang: null,
      seenBy: [userId],
    });

    await userMessage.populate("sender", "name email");
    sendSSE({ type: "user-message", message: userMessage });

    // Get conversation history for context (last 10 messages) - optimized
    const recentMessages = await Message.find({
      conversation: conversation._id,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("sender", "name email")
      .lean();

    const messageHistory = recentMessages.reverse().map((msg) => ({
      role: msg?.sender?._id?.toString() === userId || msg?.sender?.toString() === userId ? "user" : "assistant",
      content: msg?.text || "",
    }));

    messageHistory.push({
      role: "user",
      content: message,
    });

    // Call Hugging Face API with streaming
    const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
    const huggingFaceModel = process.env.HUGGINGFACE_MODEL || "deepseek-ai/DeepSeek-V3.2";

    if (!huggingFaceApiKey) {
      sendSSE({ type: "error", message: "Hugging Face API key not configured" });
      return res.end();
    }

    try {
      sendSSE({ type: "start" });

      // Use streaming endpoint if available, otherwise fallback to regular
      const messages = messageHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await axios.post(
        `https://router.huggingface.co/v1/chat/completions`,
        {
          model: huggingFaceModel,
          messages: messages,
          max_tokens: 1000,
          temperature: 0.7,
          stream: true, // Enable streaming
        },
        {
          headers: {
            Authorization: `Bearer ${huggingFaceApiKey}`,
            "Content-Type": "application/json",
          },
          responseType: "stream",
          timeout: 60000, // 60 seconds for streaming
        }
      );

      let fullResponse = "";
      let buffer = "";

      response.data.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || "";
              if (content) {
                fullResponse += content;
                sendSSE({ type: "chunk", content });
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      });

      response.data.on("end", async () => {
        // Save complete AI response
        if (!fullResponse.trim()) {
          fullResponse = "I'm sorry, I couldn't generate a response. Please try again.";
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
      });

      response.data.on("error", async (error) => {
        console.error("Streaming error:", error);
        const fallbackResponse = "I'm currently experiencing technical difficulties. Please try again in a moment.";
        
        const aiMessage = await Message.create({
          conversation: conversation._id,
          sender: aiUser._id,
          text: fallbackResponse,
          lang: null,
          seenBy: [userId],
        });

        await aiMessage.populate("sender", "name email");
        sendSSE({ type: "error", message: aiMessage, error: "Stream error" });
        res.end();
      });
    } catch (hfError) {
      console.error("Hugging Face API Error:", hfError.response?.data || hfError.message);
      
      // Fallback response
      const fallbackResponse = "I'm currently experiencing technical difficulties. Please try again in a moment.";
      
      const aiMessage = await Message.create({
        conversation: conversation._id,
        sender: aiUser._id,
        text: fallbackResponse,
        lang: null,
        seenBy: [userId],
      });

      await aiMessage.populate("sender", "name email");
      sendSSE({ type: "error", message: aiMessage, error: "API error" });
      res.end();
    }
  } catch (error) {
    console.error("AI Chat Stream Error:", error);
    res.write(`data: ${JSON.stringify({ type: "error", message: "Server error", details: error.message })}\n\n`);
    res.end();
  }
}

