import "dotenv/config";
const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`Missing required environment variable: ${name}`); return value; };
const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");

const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

export const config = { port, mongoUri: required("MONGODB_URI"), jwtSecret, clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173", isProduction: process.env.NODE_ENV === "production" };
