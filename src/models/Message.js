import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: String,
    lang: { type: String, default: null },
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // File attachment fields
    fileType: { type: String, enum: ['image', 'video', 'audio', 'document', 'other'], default: null },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    fileSize: { type: Number, default: null }, // in bytes
  },
  { timestamps: true }
);

export default mongoose.models.Message ||
  mongoose.model("Message", MessageSchema);
