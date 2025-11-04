// src/lib/db.ts   (replace the whole file)
import { Context } from "hono";
import { Env, User, RefreshToken } from "../types";

interface D1Row {
  [column: string]: any;
}

/* ---------- GET USER ---------- */
export async function getUserByEmail(
  c: Context<Env>,
  email: string
): Promise<User | null> {
  const stmt = c.env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email);
  const { results } = await stmt.all<D1Row>();
  return (results[0] as User) ?? null;
}

/* ---------- CREATE USER ---------- */
export async function createUser(
  c: Context<Env>,
  user: Omit<User, "id" | "created_at">
): Promise<number> {
  const stmt = c.env.DB.prepare(
    `INSERT INTO users (email, password_hash, name, phone, address, role)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    user.email,
    user.password_hash,
    user.name,
    user.phone ?? null,
    user.address ?? null,
    user.role
  );
  const { meta } = await stmt.run();
  return Number(meta.last_row_id);
}

/* ---------- REFRESH TOKENS ---------- */
export async function storeRefreshToken(
  c: Context<Env>,
  userId: number,
  tokenHash: string,
  expiresAt: string
): Promise<void> {
  await c.env.DB.prepare(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)"
  )
    .bind(userId, tokenHash, expiresAt)
    .run();
}

export async function getRefreshTokenHash(
  c: Context<Env>,
  tokenHash: string
): Promise<RefreshToken | null> {
  const stmt = c.env.DB.prepare(
    "SELECT * FROM refresh_tokens WHERE token_hash = ?"
  ).bind(tokenHash);
  const { results } = await stmt.all<D1Row>();
  return (results[0] as RefreshToken) ?? null;
}

export async function deleteRefreshToken(
  c: Context<Env>,
  tokenHash: string
): Promise<void> {
  await c.env.DB.prepare("DELETE FROM refresh_tokens WHERE token_hash = ?")
    .bind(tokenHash)
    .run();
}