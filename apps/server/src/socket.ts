import type { Server, Socket } from "socket.io";
import { messageSchema, typingSchema } from "@secure-chat/shared";
import { verifyToken } from "./auth.js";
import { Conversation, Message, User } from "./models.js";
import { messageDto } from "./serializers.js";

type SocketAck = (response: { ok?: boolean; error?: string; details?: unknown; message?: ReturnType<typeof messageDto> }) => void;

const withSocketErrorHandling = <Args extends unknown[]>(
  eventName: string,
  handler: (...args: Args) => Promise<void>
) => (...args: Args) => {
  void handler(...args).catch((error: unknown) => {
    console.error(`Socket event '${eventName}' failed`, error);
    const ack = args[args.length - 1];
    if (typeof ack === "function") {
      (ack as SocketAck)({ error: "Unable to process socket event" });
    }
  });
};

let ioInstance: Server | null = null;
export const getIO = (): Server | null => ioInstance;

export const configureSockets = (io: Server) => {
  ioInstance = io;
  // Authenticate socket connection via cookie or handshake auth
  io.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie;
      const cookieToken = cookieHeader?.match(/(?:^|; )token=([^;]+)/)?.[1];
      const token = socket.handshake.auth?.token ?? cookieToken;
      if (!token) return next(new Error("Unauthorized: missing token"));
      socket.data.userId = verifyToken(decodeURIComponent(token));
      next();
    } catch {
      next(new Error("Unauthorized: invalid token"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    // Update presence to online
    try {
      await User.findByIdAndUpdate(userId, { online: true });
      io.emit("presence:update", { userId, online: true });
    } catch (error) {
      console.error("Socket presence update failed", error);
    }

    // Join a conversation room (with participant authorization check)
    socket.on("conversation:join", withSocketErrorHandling("conversation:join", async (conversationId: string, ack?: SocketAck) => {
      const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
      if (!conversation) return ack?.({ error: "Conversation not found or unauthorized" });
      socket.join(`conversation:${conversationId}`);
      ack?.({ ok: true });
    }));

    // Send message (authenticated, validated, persisted to MongoDB)
    socket.on("message:send", withSocketErrorHandling("message:send", async (payload: unknown, ack?: SocketAck) => {
      const parsed = messageSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ error: "Invalid message payload", details: parsed.error.flatten() });

      const conversation = await Conversation.findOne({ _id: parsed.data.conversationId, participants: userId });
      if (!conversation) return ack?.({ error: "Conversation not found or unauthorized" });

      const message = await Message.create({
        conversationId: conversation._id,
        senderId: userId,
        text: parsed.data.text,
        type: "text",
        status: "sent"
      });

      conversation.lastMessage = message._id;
      conversation.lastMessageAt = message.createdAt;
      await conversation.save();

      const dto = messageDto(message);

      // Emit to each participant room once to prevent duplicates
      for (const participant of conversation.participants) {
        io.to(`user:${participant}`).emit("message:new", dto);
      }

      ack?.({ message: dto });
    }));

    // Mark messages as read in conversation
    socket.on("messages:read", withSocketErrorHandling("messages:read", async (conversationId: string) => {
      const conversation = await Conversation.findOne({ _id: conversationId, participants: userId });
      if (!conversation) return;

      await Message.updateMany(
        { conversationId, senderId: { $ne: userId }, status: { $ne: "read" } },
        { status: "read" }
      );

      for (const participant of conversation.participants) {
        if (String(participant) !== userId) {
          io.to(`user:${participant}`).emit("messages:read", { conversationId, readerId: userId });
        }
      }
    }));

    // Typing indicators
    socket.on("typing", withSocketErrorHandling("typing", async (payload: unknown) => {
      const parsed = typingSchema.safeParse(payload);
      if (!parsed.success) return;

      const exists = await Conversation.exists({ _id: parsed.data.conversationId, participants: userId });
      if (exists) {
        socket.to(`conversation:${parsed.data.conversationId}`).emit("typing:update", {
          ...parsed.data,
          userId
        });
      }
    }));

    // Disconnect and presence handling
    socket.on("disconnect", withSocketErrorHandling("disconnect", async () => {
      const userSockets = await io.in(`user:${userId}`).fetchSockets();
      if (!userSockets.length) {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, { online: false, lastSeen });
        io.emit("presence:update", {
          userId,
          online: false,
          lastSeen: lastSeen.toISOString()
        });
      }
    }));
  });
};
