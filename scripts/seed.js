import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "../src/lib/mongoose.js";
import User from "../src/models/User.js";
import Conversation from "../src/models/Conversation.js";
import Message from "../src/models/Message.js";

async function seed() {
  await connectDB();

  // Clear existing data
  await User.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});

  // Create users
  const password = await bcrypt.hash("password123", 10);
  const user1 = await User.create({ name: "Alice", email: "alice@test.com", password });
  const user2 = await User.create({ name: "Bob", email: "bob@test.com", password });

  // Create conversation
  const conversation = await Conversation.create({
    participants: [user1._id, user2._id],
  });

  // Add messages
  await Message.create([
    { conversation: conversation._id, sender: user1._id, text: "Hi Bob!" },
    { conversation: conversation._id, sender: user2._id, text: "Hey Alice! How are you?" },
  ]);

  console.log("✅ Database seeded!");
  mongoose.connection.close();
}

seed().catch((err) => {
  console.error(err);
  mongoose.connection.close();
});
