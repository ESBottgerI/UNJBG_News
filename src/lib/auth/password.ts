import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const KEYLEN = 64;

// Hash de contrasenas con scrypt (built-in de Node, sin dependencias extra).
// Formato: scrypt:salt:hashHex
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, KEYLEN);
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [scheme, salt, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hashHex) return false;
  const derived = await scrypt(password, salt, KEYLEN);
  const expected = Buffer.from(hashHex, "hex");
  return (
    derived.length === expected.length && timingSafeEqual(derived, expected)
  );
}