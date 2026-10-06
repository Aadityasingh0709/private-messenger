import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128)
});
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });
export const messageSchema = z.object({ conversationId: z.string().regex(/^[a-f\d]{24}$/i), text: z.string().trim().min(1).max(4000) });
export const conversationSchema = z.object({ userId: z.string().regex(/^[a-f\d]{24}$/i) });
export const typingSchema = z.object({ conversationId: z.string().regex(/^[a-f\d]{24}$/i), isTyping: z.boolean() });

export type PublicUser = { id: string; name: string; username: string; email: string; avatarUrl?: string; online: boolean; lastSeen?: string };
export type MessageDto = { id: string; conversationId: string; senderId: string; text: string; type: "text"; status: "sent" | "delivered" | "read"; createdAt: string };
export type ConversationDto = { id: string; participants: PublicUser[]; lastMessage?: MessageDto; lastMessageAt?: string; updatedAt: string };
