import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, index: true },
    password: String, // hashed password
    image: String,
    // Per-sender language preference for received messages
    langPrefs: { type: Map, of: String, default: {} },
  },
  { timestamps: true }
);

// Text index for faster search on name and email
UserSchema.index({ name: "text", email: "text" });
// Regular index for name searches
UserSchema.index({ name: 1 });

export default mongoose.models.User || mongoose.model("User", UserSchema);
