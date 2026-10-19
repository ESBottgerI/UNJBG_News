import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { ensureMediaDir, sanitizeFilename, getRelativeMediaPath } from "./download";

export type ProcessedImage = {
  originalUrl: string;
  imageUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
};

export async function downloadAndProcessImage(url: string): Promise<ProcessedImage | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "UNJBG-News/1.0" } });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());

    await ensureMediaDir();
    const filename = sanitizeFilename(url);
    const baseName = filename.replace(/\.[^.]+$/, "");
    const ext = path.extname(filename) || ".jpg";

    const imagePath = path.join(process.env.WA_MEDIA_DIR ?? "public/media", `${baseName}${ext}`);
    const thumbPath = path.join(process.env.WA_MEDIA_DIR ?? "public/media", `${baseName}_thumb${ext}`);

    const sharpImg = sharp(buffer);
    const metadata = await sharpImg.metadata();
    const width = metadata.width ?? 1200;
    const height = metadata.height ?? 800;

    await sharpImg
      .jpeg({ quality: 85, progressive: true })
      .resize(width > 1600 ? 1600 : width, undefined, { withoutEnlargement: true })
      .toFile(imagePath);

    const thumb = sharp(buffer).jpeg({ quality: 70 }).resize(320, undefined, { withoutEnlargement: true });
    await thumb.toFile(thumbPath);

    const stats = await fs.stat(imagePath);
    const thumbStats = await fs.stat(thumbPath);

    return {
      originalUrl: url,
      imageUrl: getRelativeMediaPath(`${baseName}${ext}`),
      thumbnailUrl: getRelativeMediaPath(`${baseName}_thumb${ext}`),
      width,
      height,
      sizeBytes: stats.size,
    };
  } catch (err) {
    console.error("Error processing image:", err);
    return null;
  }
}

export async function processImages(urls: string[]): Promise<ProcessedImage[]> {
  const results: ProcessedImage[] = [];
  for (const url of urls) {
    const processed = await downloadAndProcessImage(url);
    if (processed) results.push(processed);
  }
  return results;
}
