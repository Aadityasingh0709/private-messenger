import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";

export interface StorageAdapter {
  save(key: string, data: Buffer): Promise<void>;
  createReadStream(key: string, range?: { start: number; end: number }): fs.ReadStream;
  getSize(key: string): Promise<number>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class LocalStorageAdapter implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir: string = config.mediaStorageDir) {
    this.baseDir = path.resolve(baseDir);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolveSafePath(key: string): string {
    const safeKey = path.basename(key);
    const resolved = path.resolve(this.baseDir, safeKey);
    if (!resolved.startsWith(this.baseDir)) {
      throw new Error("Invalid storage key path traversal detected");
    }
    return resolved;
  }

  async save(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolveSafePath(key);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, data);
  }

  createReadStream(key: string, range?: { start: number; end: number }): fs.ReadStream {
    const filePath = this.resolveSafePath(key);
    if (range) {
      return fs.createReadStream(filePath, { start: range.start, end: range.end });
    }
    return fs.createReadStream(filePath);
  }

  async getSize(key: string): Promise<number> {
    const filePath = this.resolveSafePath(key);
    const stat = await fs.promises.stat(filePath);
    return stat.size;
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.resolveSafePath(key);
      await fs.promises.unlink(filePath);
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        throw err;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolveSafePath(key);
      await fs.promises.access(filePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }
}

export const generateStorageKey = (mediaKind: "image" | "video", ext: string): string => {
  const cleanExt = ext.replace(/^\./, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const randomHex = crypto.randomBytes(16).toString("hex");
  return `${mediaKind}-${randomHex}${cleanExt ? `.${cleanExt}` : ""}`;
};

export const storage: StorageAdapter = new LocalStorageAdapter();
