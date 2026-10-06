import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import { config } from "./config.js";
import { apiRouter, authRouter } from "./routes.js";
import { configureSockets } from "./socket.js";

await mongoose.connect(config.mongoUri);
const app = express(); app.use(cors({ origin: config.clientOrigin, credentials: true })); app.use(express.json({ limit: "100kb" })); app.use(cookieParser());
app.get("/health", (_req, res) => res.json({ ok: true })); app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }), authRouter); app.use("/api", apiRouter);
app.use((err: any, _req: any, res: any, _next: any) => { console.error(err); res.status(500).json({ error: "Unexpected server error" }); });
const server = http.createServer(app); const io = new Server(server, { cors: { origin: config.clientOrigin, credentials: true } }); configureSockets(io);
server.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));
