import { Router, type Request, type Response } from "express";
import argon2 from "argon2";
import multer from "multer";
import { Types } from "mongoose";
import { conversationSchema, loginSchema, registerSchema } from "@secure-chat/shared";
import { cookieOptions, requireAuth, signToken, type AuthRequest } from "./auth.js";
import { config } from "./config.js";
import { Conversation, MediaAsset, Message, User } from "./models.js";
import { accountDto, conversationDto, messageDto, userDto } from "./serializers.js";
import { generateStorageKey, storage } from "./storage.js";
import { validateMediaUpload } from "./mediaValidation.js";
import { getIO } from "./socket.js";

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

const conversationKey = (firstUserId: string, secondUserId: string) =>
  [firstUserId, secondUserId].sort().join(":");

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === 11000;

// Configure multer for memory buffer storage and size bounds
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxVideoSizeBytes }
});

const uploadMiddleware = (req: any, res: any, next: any) => {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: `File size exceeds the maximum allowed limit (${Math.round(config.maxVideoSizeBytes / (1024 * 1024))}MB)`
        });
      }
      return res.status(400).json({ error: err.message || "Failed to process media upload" });
    }
    next();
  });
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
    res.cookie("token", token, cookieOptions).status(201).json({ user: accountDto(user) });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({ error: "Email or username is already in use" });
    }
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
    res.cookie("token", token, cookieOptions).json({ user: accountDto(user) });
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
    res.json({ user: accountDto(user) });
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
      .populate({
        path: "lastMessage",
        populate: { path: "mediaAsset" }
      })
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

    const participantKey = conversationKey(req.userId!, data.userId);
    let conversation = await Conversation.findOne({ participantKey });

    if (!conversation) {
      conversation = await Conversation.findOne({
        participants: { $all: [req.userId, data.userId], $size: 2 }
      });

      if (conversation) {
        try {
          conversation.participantKey = participantKey;
          await conversation.save();
        } catch (err) {
          if (!isDuplicateKeyError(err)) throw err;
          conversation = await Conversation.findOne({ participantKey });
        }
      } else {
        try {
          conversation = await Conversation.create({
            participants: [req.userId, data.userId],
            participantKey
          });
        } catch (err) {
          if (!isDuplicateKeyError(err)) throw err;
          conversation = await Conversation.findOne({ participantKey });
        }
      }
    }

    if (!conversation) throw new Error("Conversation creation did not produce a conversation");
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
      .populate("mediaAsset")
      .sort({ createdAt: -1, _id: -1 })
      .limit(200);
    messages.reverse();

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

// Upload a media message to a conversation
apiRouter.post("/conversations/:id/media", uploadMiddleware, async (req: AuthRequest, res: Response, next) => {
  let savedStorageKey: string | null = null;
  try {
    const conversation = await ownConversation(String(req.params.id), req.userId!);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found or access denied" });
    }

    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ error: "No media file was uploaded" });
    }

    const validation = validateMediaUpload(
      file.buffer,
      file.mimetype,
      file.originalname,
      config.maxImageSizeBytes,
      config.maxVideoSizeBytes
    );

    if (!validation.valid || !validation.processedBuffer || !validation.mediaKind) {
      return res.status(400).json({ error: validation.error ?? "Invalid media upload" });
    }

    const storageKey = generateStorageKey(validation.mediaKind, validation.extension ?? "bin");
    await storage.save(storageKey, validation.processedBuffer);
    savedStorageKey = storageKey;

    const asset = await MediaAsset.create({
      uploaderId: req.userId,
      conversationId: conversation._id,
      storageKey,
      mimeType: validation.mimeType,
      size: validation.processedBuffer.length,
      originalName: validation.sanitizedFilename,
      mediaKind: validation.mediaKind,
      ...(validation.width ? { width: validation.width } : {}),
      ...(validation.height ? { height: validation.height } : {})
    });

    const caption = typeof req.body.caption === "string" ? req.body.caption.trim().slice(0, 4000) : "";
    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.userId,
      text: caption,
      type: validation.mediaKind,
      mediaAssetId: asset._id,
      status: "sent"
    });

    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();

    // Persisted successfully: clear savedStorageKey so cleanup will not delete it
    savedStorageKey = null;

    (message as any).mediaAsset = asset;
    const dto = messageDto(message);

    // Broadcast new message in real time to conversation participants
    const io = getIO();
    if (io) {
      for (const participant of conversation.participants) {
        io.to(`user:${participant}`).emit("message:new", dto);
      }
    }

    res.status(201).json({ message: dto });
  } catch (err) {
    if (savedStorageKey) {
      await storage.delete(savedStorageKey).catch(() => {});
    }
    next(err);
  }
});

// Helper to serve private media securely with participant check & HTTP byte-range requests
const serveMedia = async (
  mediaId: string,
  userId: string,
  req: Request,
  res: Response,
  expectedConversationId?: string
) => {
  if (!Types.ObjectId.isValid(mediaId)) {
    return res.status(404).json({ error: "Media not found" });
  }

  const asset = await MediaAsset.findById(mediaId).select("+storageKey");
  if (!asset) {
    return res.status(404).json({ error: "Media not found" });
  }

  // Cross-conversation validation: ensure media belongs to requested conversation
  if (expectedConversationId) {
    if (!Types.ObjectId.isValid(expectedConversationId) || String(asset.conversationId) !== expectedConversationId) {
      return res.status(404).json({ error: "Media not found or access denied" });
    }
  }

  // Strict authorization: user must be participant in the conversation
  const isParticipant = await Conversation.exists({
    _id: asset.conversationId,
    participants: userId
  });
  if (!isParticipant) {
    return res.status(404).json({ error: "Media not found or access denied" });
  }

  const fileExists = await storage.exists(asset.storageKey);
  if (!fileExists) {
    return res.status(404).json({ error: "Media file unavailable" });
  }

  const totalSize = asset.size;
  const rangeHeader = req.headers.range;

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (!match) {
      res.status(416).setHeader("Content-Range", `bytes */${totalSize}`).end();
      return;
    }

    let start: number;
    let end: number;

    if (!match[1] && match[2]) {
      // Suffix byte range: e.g. bytes=-50 (last 50 bytes)
      const suffixLength = parseInt(match[2], 10);
      if (isNaN(suffixLength) || suffixLength <= 0) {
        res.status(416).setHeader("Content-Range", `bytes */${totalSize}`).end();
        return;
      }
      start = Math.max(0, totalSize - suffixLength);
      end = totalSize - 1;
    } else {
      start = match[1] ? parseInt(match[1], 10) : 0;
      end = match[2] ? parseInt(match[2], 10) : totalSize - 1;
    }

    if (isNaN(start) || start >= totalSize || isNaN(end) || end < start) {
      res.status(416).setHeader("Content-Range", `bytes */${totalSize}`).end();
      return;
    }
    if (end >= totalSize) {
      end = totalSize - 1;
    }

    const chunkSize = end - start + 1;
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Length", chunkSize);
    res.setHeader("Content-Type", asset.mimeType);
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(asset.originalName)}"`);

    const stream = storage.createReadStream(asset.storageKey, { start, end });
    res.on("close", () => {
      stream.destroy();
    });
    stream.on("error", () => {
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } else {
    res.status(200);
    res.setHeader("Content-Length", totalSize);
    res.setHeader("Content-Type", asset.mimeType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(asset.originalName)}"`);

    const stream = storage.createReadStream(asset.storageKey);
    res.on("close", () => {
      stream.destroy();
    });
    stream.on("error", () => {
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  }
};

// Retrieve media in the context of a conversation
apiRouter.get("/conversations/:id/media/:mediaId", async (req: AuthRequest, res: Response, next) => {
  try {
    await serveMedia(String(req.params.mediaId), req.userId!, req, res, String(req.params.id));
  } catch (err) {
    next(err);
  }
});

// Retrieve media by media ID directly (still strictly authorized by conversation membership)
apiRouter.get("/media/:mediaId", async (req: AuthRequest, res: Response, next) => {
  try {
    await serveMedia(String(req.params.mediaId), req.userId!, req, res);
  } catch (err) {
    next(err);
  }
});
