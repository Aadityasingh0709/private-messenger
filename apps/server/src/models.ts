import { Schema, model, Types } from "mongoose";

const userSchema = new Schema({ name: { type: String, required: true, trim: true }, username: { type: String, required: true, unique: true, lowercase: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, passwordHash: { type: String, required: true, select: false }, avatarUrl: String, online: { type: Boolean, default: false }, lastSeen: Date }, { timestamps: true });
const conversationSchema = new Schema({ participants: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], validate: [(v: Types.ObjectId[]) => v.length === 2 && String(v[0]) !== String(v[1]), "A conversation needs two distinct participants"] }, lastMessage: { type: Schema.Types.ObjectId, ref: "Message" }, lastMessageAt: Date }, { timestamps: true });
conversationSchema.index({ participants: 1 });
const messageSchema = new Schema({ conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true }, senderId: { type: Schema.Types.ObjectId, ref: "User", required: true }, text: { type: String, required: true, trim: true, maxlength: 4000 }, type: { type: String, enum: ["text"], default: "text" }, status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" } }, { timestamps: true });
messageSchema.index({ conversationId: 1, createdAt: -1 });
export const User = model("User", userSchema);
export const Conversation = model("Conversation", conversationSchema);
export const Message = model("Message", messageSchema);
