import mongoose from "mongoose";
import argon2 from "argon2";
import { config } from "./config.js";
import { User, Conversation, Message } from "./models.js";

async function seed() {
  if (config.isProduction) {
    throw new Error("The demo seed script cannot run in production");
  }
  console.log("Connecting to MongoDB");
  await mongoose.connect(config.mongoUri);

  const demoPassword = "Password123!";
  const passwordHash = await argon2.hash(demoPassword);

  // 1. Ensure Alice exists
  let alice = await User.findOne({ email: "alice@example.com" });
  if (!alice) {
    alice = await User.create({
      name: "Alice Smith",
      username: "alice",
      email: "alice@example.com",
      passwordHash
    });
    console.log("✓ Created demo user Alice:", alice.email);
  } else {
    console.log("✓ Alice already exists:", alice.email);
  }

  // 2. Ensure Bob exists
  let bob = await User.findOne({ email: "bob@example.com" });
  if (!bob) {
    bob = await User.create({
      name: "Bob Jones",
      username: "bob",
      email: "bob@example.com",
      passwordHash
    });
    console.log("✓ Created demo user Bob:", bob.email);
  } else {
    console.log("✓ Bob already exists:", bob.email);
  }

  // 3. Ensure a conversation exists between Alice & Bob
  let conv = await Conversation.findOne({
    participants: { $all: [alice._id, bob._id], $size: 2 }
  });

  if (!conv) {
    conv = await Conversation.create({
      participants: [alice._id, bob._id]
    });

    const msg1 = await Message.create({
      conversationId: conv._id,
      senderId: alice._id,
      text: "Hi Bob! Welcome to Private Messenger Phase 1.",
      status: "read"
    });

    const msg2 = await Message.create({
      conversationId: conv._id,
      senderId: bob._id,
      text: "Hey Alice, realtime one-to-one messaging is working perfectly!",
      status: "delivered"
    });

    conv.lastMessage = msg2._id;
    conv.lastMessageAt = msg2.createdAt;
    await conv.save();

    console.log("✓ Created initial conversation & demo messages");
  }

  console.log("\n==========================================");
  console.log(" DEMO ACCOUNTS READY TO USE:");
  console.log("------------------------------------------");
  console.log(" User 1:");
  console.log("   Email:    alice@example.com");
  console.log("   Password: Password123!");
  console.log("   Username: @alice");
  console.log("------------------------------------------");
  console.log(" User 2:");
  console.log("   Email:    bob@example.com");
  console.log("   Password: Password123!");
  console.log("   Username: @bob");
  console.log("==========================================\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
