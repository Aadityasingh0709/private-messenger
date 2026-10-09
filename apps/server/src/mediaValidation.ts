import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
  ALLOWED_MEDIA_MIME_TYPES,
  type AllowedImageMimeType,
  type AllowedVideoMimeType,
  type AllowedMediaMimeType
} from "@secure-chat/shared";

export interface MediaValidationResult {
  valid: boolean;
  error?: string;
  mediaKind?: "image" | "video";
  mimeType?: AllowedMediaMimeType;
  extension?: string;
  sanitizedFilename?: string;
  processedBuffer?: Buffer;
  width?: number;
  height?: number;
}

/**
 * Detect actual file signature / MIME type from raw magic numbers.
 */
export function detectSignature(buffer: Buffer): { mimeType: AllowedMediaMimeType; ext: string; kind: "image" | "video" } | null {
  if (buffer.length < 12) return null;

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: "image/jpeg", ext: "jpg", kind: "image" };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: "image/png", ext: "png", kind: "image" };
  }

  // 3. WebP: RIFF .... WEBP
  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { mimeType: "image/webp", ext: "webp", kind: "image" };
  }

  // 4. MP4: offset 4 ftyp
  if (buffer.length >= 8 && buffer.toString("ascii", 4, 8) === "ftyp") {
    return { mimeType: "video/mp4", ext: "mp4", kind: "video" };
  }

  // 5. WebM: 1A 45 DF A3 (EBML Header)
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return { mimeType: "video/webm", ext: "webm", kind: "video" };
  }

  return null;
}

/**
 * Sanitize filename for safe storage and display
 */
export function sanitizeFilename(originalName: string, fallbackExt: string): string {
  if (!originalName || typeof originalName !== "string") {
    return `media-${Date.now()}.${fallbackExt}`;
  }

  // Remove path separators and control characters
  let clean = originalName
    .replace(/[/\\]+/g, "")
    .replace(/[\x00-\x1f\x7f-\x9f]/g, "")
    .trim();

  // Strip leading dots to prevent hidden files
  clean = clean.replace(/^\.+/, "");

  if (!clean) {
    return `media-${Date.now()}.${fallbackExt}`;
  }

  // Limit length
  if (clean.length > 100) {
    const ext = clean.includes(".") ? clean.slice(clean.lastIndexOf(".")) : `.${fallbackExt}`;
    clean = clean.slice(0, 100 - ext.length) + ext;
  }

  return clean;
}

/**
 * Extract image dimensions from JPEG, PNG, or WebP
 */
export function extractImageDimensions(buffer: Buffer, mime: AllowedImageMimeType): { width?: number; height?: number } {
  try {
    if (mime === "image/png" && buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    if (mime === "image/jpeg" && buffer.length >= 4) {
      let offset = 2; // skip SOI
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buffer[offset + 1];
        // SOF markers (SOF0 to SOF15 except DHT/JPG/DAC)
        const isSOF =
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf);

        if (isSOF) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }

        // SOS or EOI means no more headers
        if (marker === 0xda || marker === 0xd9) break;

        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    }

    if (mime === "image/webp" && buffer.length >= 30) {
      const chunkType = buffer.toString("ascii", 12, 16);
      if (chunkType === "VP8 " && buffer.length >= 30) {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      } else if (chunkType === "VP8L" && buffer.length >= 25) {
        const b1 = buffer[21];
        const b2 = buffer[22];
        const b3 = buffer[23];
        const b4 = buffer[24];
        const width = 1 + (((b2 & 0x3f) << 8) | b1);
        const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
        return { width, height };
      } else if (chunkType === "VP8X" && buffer.length >= 30) {
        const width = 1 + buffer.readUIntLE(24, 3);
        const height = 1 + buffer.readUIntLE(27, 3);
        return { width, height };
      }
    }
  } catch {
    // If dimension parsing fails, proceed without dimension metadata
  }
  return {};
}

/**
 * Strip EXIF location and camera metadata from JPEG images
 */
export function stripExifFromJpeg(buffer: Buffer): Buffer {
  try {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
      return buffer;
    }

    const chunks: Buffer[] = [buffer.subarray(0, 2)]; // Keep SOI
    let offset = 2;
    let modified = false;

    while (offset < buffer.length - 4) {
      if (buffer[offset] !== 0xff) {
        chunks.push(buffer.subarray(offset));
        break;
      }

      const marker = buffer[offset + 1];
      if (marker === 0xda || marker === 0xd9) {
        // SOS or EOI: copy the rest verbatim
        chunks.push(buffer.subarray(offset));
        break;
      }

      const length = buffer.readUInt16BE(offset + 2);
      const segmentEnd = offset + 2 + length;
      if (segmentEnd > buffer.length) {
        chunks.push(buffer.subarray(offset));
        break;
      }

      // APP1 marker (0xE1) with Exif header: strip it
      if (marker === 0xe1 && length >= 8) {
        const header = buffer.toString("ascii", offset + 4, offset + 8);
        if (header === "Exif") {
          // Skip this segment
          modified = true;
          offset = segmentEnd;
          continue;
        }
      }

      chunks.push(buffer.subarray(offset, segmentEnd));
      offset = segmentEnd;
    }

    return modified ? Buffer.concat(chunks) : buffer;
  } catch {
    return buffer;
  }
}

/**
 * Strip eXIf chunk from PNG images
 */
export function stripExifFromPng(buffer: Buffer): Buffer {
  try {
    if (buffer.length < 8) return buffer;
    // Check PNG signature
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!buffer.subarray(0, 8).equals(sig)) return buffer;

    const chunks: Buffer[] = [buffer.subarray(0, 8)];
    let offset = 8;
    let modified = false;

    while (offset < buffer.length - 8) {
      const length = buffer.readUInt32BE(offset);
      const chunkType = buffer.toString("ascii", offset + 4, offset + 8);
      const totalChunkLen = 4 + 4 + length + 4; // length + type + data + crc
      if (offset + totalChunkLen > buffer.length) {
        chunks.push(buffer.subarray(offset));
        break;
      }

      if (chunkType === "eXIf") {
        modified = true;
        offset += totalChunkLen;
        continue;
      }

      chunks.push(buffer.subarray(offset, offset + totalChunkLen));
      offset += totalChunkLen;
    }

    return modified ? Buffer.concat(chunks) : buffer;
  } catch {
    return buffer;
  }
}

/**
 * Validate upload buffer, file type, file size and strip EXIF
 */
export function validateMediaUpload(
  buffer: Buffer,
  clientReportedMime: string,
  originalFilename: string,
  maxImageSize: number,
  maxVideoSize: number
): MediaValidationResult {
  const detected = detectSignature(buffer);
  if (!detected) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload a valid JPEG, PNG, WebP image or MP4, WebM video."
    };
  }

  const { mimeType, ext, kind } = detected;

  // Check against strict allowlist
  if (!ALLOWED_MEDIA_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Media type ${mimeType} is not permitted.`
    };
  }

  // Check size limit
  const limit = kind === "image" ? maxImageSize : maxVideoSize;
  if (buffer.length > limit) {
    const limitMb = Math.round(limit / (1024 * 1024));
    return {
      valid: false,
      error: `File size exceeds the maximum allowed limit of ${limitMb}MB for ${kind}s.`
    };
  }

  // Process image buffers (strip EXIF)
  let processedBuffer = buffer;
  if (mimeType === "image/jpeg") {
    processedBuffer = stripExifFromJpeg(buffer);
  } else if (mimeType === "image/png") {
    processedBuffer = stripExifFromPng(buffer);
  }

  // Extract dimensions for images
  let width: number | undefined;
  let height: number | undefined;
  if (kind === "image") {
    const dims = extractImageDimensions(processedBuffer, mimeType as AllowedImageMimeType);
    width = dims.width;
    height = dims.height;
  }

  const sanitized = sanitizeFilename(originalFilename, ext);

  return {
    valid: true,
    mediaKind: kind,
    mimeType,
    extension: ext,
    sanitizedFilename: sanitized,
    processedBuffer,
    width,
    height
  };
}
