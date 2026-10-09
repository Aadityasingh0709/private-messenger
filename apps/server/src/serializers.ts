import type { AccountUser, ConversationDto, MediaAssetDto, MessageDto, MessageType, PublicUser } from "@secure-chat/shared";

export const userDto = (u: any): PublicUser => ({
  id: String(u._id),
  name: u.name,
  username: u.username,
  ...(u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}),
  online: Boolean(u.online),
  ...(u.lastSeen ? { lastSeen: new Date(u.lastSeen).toISOString() } : {})
});

export const accountDto = (u: any): AccountUser => ({
  ...userDto(u),
  email: u.email
});

export const mediaAssetDto = (asset: any): MediaAssetDto => ({
  id: String(asset._id),
  uploaderId: String(asset.uploaderId),
  conversationId: String(asset.conversationId),
  mimeType: asset.mimeType,
  size: asset.size,
  originalName: asset.originalName,
  mediaKind: asset.mediaKind,
  ...(asset.width ? { width: asset.width } : {}),
  ...(asset.height ? { height: asset.height } : {}),
  ...(asset.duration ? { duration: asset.duration } : {}),
  createdAt: new Date(asset.createdAt).toISOString()
});

export const messageDto = (m: any): MessageDto => {
  const type: MessageType = (m.type === "image" || m.type === "video") ? m.type : "text";
  const mediaObj = m.mediaAsset || (m.mediaAssetId && typeof m.mediaAssetId === "object" ? m.mediaAssetId : undefined);
  return {
    id: String(m._id),
    conversationId: String(m.conversationId),
    senderId: String(m.senderId),
    text: m.text ?? "",
    type,
    ...(m.mediaAssetId ? { mediaAssetId: String(m.mediaAssetId._id ?? m.mediaAssetId) } : {}),
    ...(mediaObj ? { media: mediaAssetDto(mediaObj) } : {}),
    status: m.status,
    createdAt: new Date(m.createdAt).toISOString()
  };
};

export const conversationDto = (c: any): ConversationDto => ({
  id: String(c._id),
  participants: c.participants.map(userDto),
  ...(c.lastMessage ? { lastMessage: messageDto(c.lastMessage) } : {}),
  ...(c.lastMessageAt ? { lastMessageAt: new Date(c.lastMessageAt).toISOString() } : {}),
  updatedAt: new Date(c.updatedAt).toISOString()
});
