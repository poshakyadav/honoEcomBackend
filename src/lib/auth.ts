// src/lib/auth.ts   (replace the whole file)
import { sign, verify } from "hono/jwt";
import { Context } from "hono";
import { Env, TokenPayload } from "../types";

/* ---------- PASSWORD ---------- */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256
  );
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${saltHex}:${hash}`;
}

export async function verifyPassword(
  stored: string,
  provided: string
): Promise<boolean> {
  const [saltHex, storedHash] = stored.split(":");
  const salt = Uint8Array.from(
    saltHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
  );
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(provided),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256
  );
  const providedHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return providedHash === storedHash;
}

/* ---------- TOKEN HASH ---------- */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ---------- CREATE TOKENS ---------- */
type TokenInput = Omit<
  TokenPayload,
  "exp" | "iat" | "nbf" | "iss"
>;

export async function createAccessToken(
  c: Context<Env>,
  payload: TokenInput
): Promise<string> {
  if (!c.env.ACCESS_SECRET) {
    throw new Error("ACCESS_SECRET is not configured");
  }
  const now = Math.floor(Date.now() / 1000);
  const full: TokenPayload = {
    sub: payload.sub as string,
    email: payload.email as string,
    role: payload.role as "user" | "admin",
    exp: now + 60 * 15, // 15 min
    iat: now,
    nbf: now,
    iss: c.env.ISSUER,
  };
  return await sign(full, c.env.ACCESS_SECRET);
}

export async function createRefreshToken(
  c: Context<Env>,
  payload: TokenInput
): Promise<string> {
  if (!c.env.REFRESH_SECRET) {
    throw new Error("REFRESH_SECRET is not configured");
  }
  const now = Math.floor(Date.now() / 1000);
  const full: TokenPayload = {
    sub: payload.sub as string,
    email: payload.email as string,
    role: payload.role as "user" | "admin",
    exp: now + 60 * 60 * 24 * 30, // 30 days
    iat: now,
    nbf: now,
    iss: c.env.ISSUER,
  };
  return await sign(full, c.env.REFRESH_SECRET);
}

/* ---------- VERIFY TOKENS ---------- */
export async function verifyAccessToken(
  c: Context<Env>,
  token: string
): Promise<TokenPayload> {
  const payload = await verify(token, c.env.ACCESS_SECRET, "HS256");
  return payload as unknown as TokenPayload;
}

export async function verifyRefreshToken(
  c: Context<Env>,
  token: string
): Promise<TokenPayload> {
  const payload = await verify(token, c.env.REFRESH_SECRET, "HS256");
  return payload as unknown as TokenPayload;
}