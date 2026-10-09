import { Schema, model, Types } from "mongoose";

const userSchema = new Schema({ name: { type: String, required: true, trim: true }, username: { type: String, required: true, unique: true, lowercase: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, passwordHash: { type: String, required: true, select: false }, avatarUrl: String, online: { type: Boolean, default: false }, lastSeen: Date }, { timestamps: true });
const conversationSchema = new Schema({ participants: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], validate: [(v: Types.ObjectId[]) => v.length === 2 && String(v[0]) !== String(v[1]), "A conversation needs two distinct participants"] }, participantKey: { type: String, select: false }, lastMessage: { type: Schema.Types.ObjectId, ref: "Message" }, lastMessageAt: Date }, { timestamps: true });
conversationSchema.index({ participants: 1 });
conversationSchema.index({ participantKey: 1 }, { unique: true, sparse: true });
const mediaAssetSchema = new Schema({
  uploaderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
  storageKey: { type: String, required: true, select: false },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  originalName: { type: String, required: true },
  mediaKind: { type: String, enum: ["image", "video"], required: true },
  width: { type: Number },
  height: { type: Number },
  duration: { type: Number }
}, { timestamps: true });
mediaAssetSchema.index({ conversationId: 1, createdAt: -1 });

const messageSchema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, trim: true, maxlength: 4000, default: "" },
  type: { type: String, enum: ["text", "image", "video"], default: "text" },
  mediaAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset" },
  status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" }
}, { timestamps: true });
messageSchema.index({ conversationId: 1, createdAt: -1 });

messageSchema.virtual("mediaAsset", {
  ref: "MediaAsset",
  localField: "mediaAssetId",
  foreignField: "_id",
  justOne: true
});
messageSchema.set("toObject", { virtuals: true });
messageSchema.set("toJSON", { virtuals: true });

export const User = model("User", userSchema);
export const Conversation = model("Conversation", conversationSchema);
export const MediaAsset = model("MediaAsset", mediaAssetSchema);
export const Message = model("Message", messageSchema);
