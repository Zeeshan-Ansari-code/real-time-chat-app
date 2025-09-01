import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String, // hashed password
    image: String,
    // Per-sender language preference for received messages
    langPrefs: { type: Map, of: String, default: {} },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
