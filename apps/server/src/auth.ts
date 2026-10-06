import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
export type AuthRequest = Request & { userId?: string };
export const signToken = (userId: string) => jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: "7d" });
export const verifyToken = (token: string) => (jwt.verify(token, config.jwtSecret) as { sub: string }).sub;
export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => { try { const token = req.cookies?.token ?? req.headers.authorization?.replace(/^Bearer\s+/i, ""); if (!token) return res.status(401).json({ error: "Authentication required" }); req.userId = verifyToken(token); next(); } catch { res.status(401).json({ error: "Invalid or expired session" }); } };
export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: config.isProduction, maxAge: 7 * 24 * 60 * 60 * 1000, path: "/" };
