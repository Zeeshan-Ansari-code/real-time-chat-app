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

    // Get or create AI user
    let aiUser = await User.findOne({ email: "ai@assistant.com" });
    if (!aiUser) {
      aiUser = await User.create({
        name: "AI Assistant",
        email: "ai@assistant.com",
        password: "ai-assistant-no-password", // Dummy password, won't be used
      });
    }
    const aiUserId = aiUser._id.toString();

    // Get or create AI conversation
    let conversation;
    if (conversationId && conversationId !== "ai-chat" && mongoose.Types.ObjectId.isValid(conversationId)) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
    } else {
      // Create or find AI conversation for this user
      const userIdObj = mongoose.Types.ObjectId.isValid(userId) 
        ? new mongoose.Types.ObjectId(userId) 
        : userId;
      
      conversation = await Conversation.findOne({
        participants: { $all: [userIdObj, aiUser._id] },
      });

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

    // Get conversation history for context (last 10 messages)
    const recentMessages = await Message.find({
      conversation: conversation._id,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("sender", "name email")
      .lean();

    // Reverse to get chronological order
    const messageHistory = recentMessages.reverse().map((msg) => ({
      role: msg.sender._id === userId || msg.sender === userId ? "user" : "assistant",
      content: msg.text || "",
    }));

    // Add current user message
    messageHistory.push({
      role: "user",
      content: message,
    });

    // Call Hugging Face API
    const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY;
    const huggingFaceModel = process.env.HUGGINGFACE_MODEL || "deepseek-ai/DeepSeek-V3.2";

    if (!huggingFaceApiKey) {
      return res.status(500).json({ error: "Hugging Face API key not configured" });
    }

    try {
      // Format messages for Hugging Face API
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
        },
        {
          headers: {
            Authorization: `Bearer ${huggingFaceApiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000, // 30 seconds timeout
        }
      );

      const aiResponse = response.data?.choices?.[0]?.message?.content || 
                        response.data?.generated_text || 
                        "I'm sorry, I couldn't generate a response. Please try again.";

      // Save AI response as message
      const aiMessage = await Message.create({
        conversation: conversation._id,
        sender: aiUser._id,
        text: aiResponse,
        lang: null,
        seenBy: [userId],
      });

      await aiMessage.populate("sender", "name email");

      // Update conversation last message
      await Conversation.findByIdAndUpdate(conversation._id, {
        updatedAt: new Date(),
      });

      return res.status(200).json({
        userMessage,
        aiMessage,
        conversationId: conversation._id,
      });
    } catch (hfError) {
      console.error("Hugging Face API Error:", hfError.response?.data || hfError.message);
      
      // Fallback response if API fails
      const fallbackResponse = "I'm currently experiencing technical difficulties. Please try again in a moment.";
      
      const aiMessage = await Message.create({
        conversation: conversation._id,
        sender: aiUser._id,
        text: fallbackResponse,
        lang: null,
        seenBy: [userId],
      });

      await aiMessage.populate("sender", "name email");

      return res.status(200).json({
        userMessage,
        aiMessage,
        conversationId: conversation._id,
        error: "AI service temporarily unavailable",
      });
    }
  } catch (error) {
    console.error("AI Chat Error:", error);
    return res.status(500).json({ 
      error: "Server error", 
      details: error.message 
    });
  }
}

