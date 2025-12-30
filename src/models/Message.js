import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
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

// Compound indexes for common queries
MessageSchema.index({ conversation: 1, createdAt: -1 });
MessageSchema.index({ conversation: 1, sender: 1, seenBy: 1 });

export default mongoose.models.Message ||
  mongoose.model("Message", MessageSchema);
