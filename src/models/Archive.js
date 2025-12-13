import mongoose from "mongoose";

const ArchiveSchema = new mongoose.Schema(
  {
    conversation: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Conversation",
      required: true,
      index: true // Index for faster queries
    },
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true // Index for faster queries
    },
  },
  { 
    timestamps: true,
    // Compound index to ensure one user can only archive a conversation once
    // and to speed up queries for "get all archived conversations for a user"
  }
);

// Compound index: one user can only archive a conversation once
ArchiveSchema.index({ conversation: 1, user: 1 }, { unique: true });

export default mongoose.models.Archive ||
  mongoose.model("Archive", ArchiveSchema);

