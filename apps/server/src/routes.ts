import { Router, type Response } from "express";
import argon2 from "argon2";
import { Types } from "mongoose";
import { conversationSchema, loginSchema, registerSchema } from "@secure-chat/shared";
import { cookieOptions, requireAuth, signToken, type AuthRequest } from "./auth.js";
import { Conversation, Message, User } from "./models.js";
import { conversationDto, messageDto, userDto } from "./serializers.js";

// Helper for Zod request validation
const parse = <T>(schema: { safeParse: (value: unknown) => any }, value: unknown, res: Response): T | undefined => {
  const result = schema.safeParse(value);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request payload", details: result.error.flatten() });
    return undefined;
  }
  return result.data as T;
};

// Verifies that a conversation exists and the requesting user is a participant (Authorization check)
const ownConversation = async (id: string, userId: string) => {
  if (!Types.ObjectId.isValid(id)) return null;
  return Conversation.findOne({ _id: id, participants: userId });
};

// ==========================================
// Authentication Routes (/api/auth)
// ==========================================
export const authRouter = Router();

// Register new user
authRouter.post("/register", async (req, res, next) => {
  try {
    const data = parse<any>(registerSchema, req.body, res);
    if (!data) return;

    const exists = await User.exists({
      $or: [{ email: data.email }, { username: data.username }]
    });
    if (exists) {
      return res.status(409).json({ error: "Email or username is already in use" });
    }

    const passwordHash = await argon2.hash(data.password);
    const user = await User.create({
      name: data.name,
      username: data.username,
      email: data.email,
      passwordHash
    });

    const token = signToken(String(user._id));
    res.cookie("token", token, cookieOptions).status(201).json({ user: userDto(user) });
  } catch (err) {
    next(err);
  }
});

// Login existing user
authRouter.post("/login", async (req, res, next) => {
  try {
    const data = parse<any>(loginSchema, req.body, res);
    if (!data) return;

    const user = await User.findOne({ email: data.email }).select("+passwordHash");
    if (!user || !(await argon2.verify(user.passwordHash, data.password))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(String(user._id));
    res.cookie("token", token, cookieOptions).json({ user: userDto(user) });
  } catch (err) {
    next(err);
  }
});

// Logout user and clear session cookie
authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token", { path: "/" }).status(204).send();
});

// ==========================================
// Protected Application API Routes (/api)
// ==========================================
export const apiRouter = Router();
apiRouter.use(requireAuth);

// Get current user profile
apiRouter.get("/me", async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: userDto(user) });
  } catch (err) {
    next(err);
  }
});

// Search users by name or username (excludes current user)
apiRouter.get("/users", async (req: AuthRequest, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.json({ users: [] });

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const users = await User.find({
      _id: { $ne: req.userId },
      $or: [
        { name: { $regex: escaped, $options: "i" } },
        { username: { $regex: escaped, $options: "i" } }
      ]
    }).limit(20);

    res.json({ users: users.map(userDto) });
  } catch (err) {
    next(err);
  }
});

// List conversations for the authenticated user
apiRouter.get("/conversations", async (req: AuthRequest, res, next) => {
  try {
    const items = await Conversation.find({ participants: req.userId })
      .populate("participants")
      .populate("lastMessage")
      .sort({ lastMessageAt: -1, updatedAt: -1 });

    res.json({ conversations: items.map(conversationDto) });
  } catch (err) {
    next(err);
  }
});

// Start or get existing one-to-one conversation
apiRouter.post("/conversations", async (req: AuthRequest, res, next) => {
  try {
    const data = parse<any>(conversationSchema, req.body, res);
    if (!data) return;

    if (data.userId === req.userId) {
      return res.status(400).json({ error: "Cannot create a conversation with yourself" });
    }

    const recipient = await User.findById(data.userId);
    if (!recipient) {
      return res.status(404).json({ error: "Recipient user not found" });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [req.userId, data.userId], $size: 2 }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.userId, data.userId]
      });
    }

    await conversation.populate("participants");
    res.status(201).json({ conversation: conversationDto(conversation) });
  } catch (err) {
    next(err);
  }
});

// Get messages for a specific conversation (Strict Authorization check)
apiRouter.get("/conversations/:id/messages", async (req: AuthRequest, res, next) => {
  try {
    const conversation = await ownConversation(String(req.params.id), req.userId!);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found or access denied" });
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 })
      .limit(200);

    // Mark unread messages sent by others as read
    await Message.updateMany(
      { conversationId: conversation._id, senderId: { $ne: req.userId }, status: { $ne: "read" } },
      { status: "read" }
    );

    res.json({ messages: messages.map((m) => messageDto(m)) });
  } catch (err) {
    next(err);
  }
});
