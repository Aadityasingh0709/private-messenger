import "dotenv/config";
const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`Missing required environment variable: ${name}`); return value; };
export const config = { port: Number(process.env.PORT ?? 4000), mongoUri: required("MONGODB_URI"), jwtSecret: required("JWT_SECRET"), clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173", isProduction: process.env.NODE_ENV === "production" };
