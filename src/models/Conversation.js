import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    archivedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Users who archived this conversation
  },
  { timestamps: true }
);

// Index for participant queries
ConversationSchema.index({ participants: 1, updatedAt: -1 });

export default mongoose.models.Conversation ||
  mongoose.model("Conversation", ConversationSchema);
