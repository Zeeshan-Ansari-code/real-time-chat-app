import { connectDB } from "@/lib/mongoose";
import Conversation from "@/models/Conversation";
import Archive from "@/models/Archive";
import User from "@/models/User";
import Message from "@/models/Message";
import mongoose from "mongoose";

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      await connectDB();
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      // Convert userId to ObjectId for proper query
      const userIdObj = mongoose.Types.ObjectId.isValid(userId) 
        ? new mongoose.Types.ObjectId(userId) 
        : userId;

      const { includeArchived } = req.query;
      
      let conversations;
      
      if (includeArchived === "true") {
        // Optimized: Use aggregation to join Archive and Conversation in one query
        conversations = await Conversation.aggregate([
          {
            $lookup: {
              from: "archives",
              let: { convId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$conversation", "$$convId"] },
                        { $eq: ["$user", userIdObj] }
                      ]
                    }
                  }
                }
              ],
              as: "archiveInfo"
            }
          },
          {
            $match: {
              participants: userIdObj,
              archiveInfo: { $ne: [] } // Only archived conversations
            }
          },
          {
            $lookup: {
              from: "users",
              localField: "participants",
              foreignField: "_id",
              as: "participants"
            }
          },
          {
            $project: {
              participants: {
                _id: 1,
                name: 1,
                email: 1
              },
              createdAt: 1,
              updatedAt: 1
            }
          }
        ]);
      } else {
        // Optimized: Use aggregation to exclude archived conversations efficiently
        const archivedIds = await Archive.find({ user: userIdObj })
          .select("conversation")
          .lean()
          .then(archives => archives?.map(a => a?.conversation) || []);
        
        const query = { participants: userIdObj };
        if (archivedIds.length > 0) {
          query._id = { $nin: archivedIds };
        }
        
        conversations = await Conversation.find(query)
          .populate("participants", "name email")
          .lean();
      }

      // Optimize: Use aggregation pipeline for better performance
      const conversationIds = conversations.map(c => c._id);
      
      // Get last messages for all conversations in one query
      const lastMessagesMap = new Map();
      if (conversationIds.length > 0) {
        const lastMessages = await Message.aggregate([
          { $match: { conversation: { $in: conversationIds } } },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: "$conversation",
              lastMessage: { $first: "$$ROOT" },
            },
          },
        ]);

        // Populate sender for last messages
        const populatedLastMessages = await Message.populate(lastMessages, {
          path: "lastMessage.sender",
          select: "name email",
        });

        populatedLastMessages.forEach((item) => {
          if (item?._id) {
            lastMessagesMap.set(item._id.toString(), item?.lastMessage);
          }
        });
      }

      // Get unread counts for all conversations in one query
      const unreadCountsMap = new Map();
      if (conversationIds.length > 0) {
        const unreadCounts = await Message.aggregate([
          {
            $match: {
              conversation: { $in: conversationIds },
              sender: { $ne: userIdObj },
            },
          },
          {
            $group: {
              _id: "$conversation",
              unreadCount: {
                $sum: {
                  $cond: [
                    { $not: { $in: [userIdObj, "$seenBy"] } },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]);

        unreadCounts.forEach((item) => {
          if (item?._id) {
            unreadCountsMap.set(item._id.toString(), item?.unreadCount || 0);
          }
        });
      }

      // Combine results
      const decorated = conversations.map((conv) => ({
        ...conv,
        lastMessage: lastMessagesMap.get(conv?._id?.toString()) || null,
        unreadCount: unreadCountsMap.get(conv?._id?.toString()) || 0,
      }));

      return res.status(200).json(decorated);
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  }

  if (req.method === "POST") {
    try {
      await connectDB();
      const { userId, otherUserId } = req.body;
      if (!userId || !otherUserId) {
        return res.status(400).json({ error: "userId and otherUserId are required" });
      }

      let conv = await Conversation.findOne({
        participants: { $all: [userId, otherUserId] },
      });

      if (!conv) {
        conv = await Conversation.create({ participants: [userId, otherUserId] });
      }

      return res.status(200).json({ conversationId: conv._id });
    } catch (err) {
      return res.status(500).json({ error: "Server error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
