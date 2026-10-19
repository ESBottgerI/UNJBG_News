import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}

export function getMediaDir(): string {
  const dir = process.env.WA_MEDIA_DIR ?? "public/media";
  return path.resolve(dir);
}

export async function ensureMediaDir(): Promise<void> {
  await fs.mkdir(getMediaDir(), { recursive: true });
}

export function sanitizeFilename(url: string): string {
  const ext = path.extname(new URL(url).pathname) || ".jpg";
  const safe = ext.replace(/[^.a-zA-Z0-9]/g, "").slice(0, 6);
  const hash = hashUrl(url).slice(0, 10);
  return `${Date.now()}-${hash}${safe || ".jpg"}`;
}

export function getRelativeMediaPath(filename: string): string {
  const dir = process.env.WA_MEDIA_DIR ?? "public/media";
  const normalized = dir.replace(/^public\//, "/").replace(/^\.\/public\//, "/");
  if (normalized.startsWith("/")) {
    return `${normalized.replace(/\/$/, "")}/${filename}`;
  }
  return `/${normalized.replace(/\/$/, "")}/${filename}`;
}
