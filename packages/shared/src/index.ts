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

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/webm"] as const;
export const ALLOWED_MEDIA_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
export type AllowedVideoMimeType = (typeof ALLOWED_VIDEO_MIME_TYPES)[number];
export type AllowedMediaMimeType = (typeof ALLOWED_MEDIA_MIME_TYPES)[number];

export type PublicUser = { id: string; name: string; username: string; avatarUrl?: string; online: boolean; lastSeen?: string };
export type AccountUser = PublicUser & { email: string };

export type MediaAssetDto = {
  id: string;
  uploaderId: string;
  conversationId: string;
  mimeType: string;
  size: number;
  originalName: string;
  mediaKind: "image" | "video";
  width?: number;
  height?: number;
  duration?: number;
  createdAt: string;
};

export type MessageType = "text" | "image" | "video";

export type MessageDto = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  type: MessageType;
  mediaAssetId?: string;
  media?: MediaAssetDto;
  status: "sent" | "delivered" | "read";
  createdAt: string;
};

export type ConversationDto = { id: string; participants: PublicUser[]; lastMessage?: MessageDto; lastMessageAt?: string; updatedAt: string };
