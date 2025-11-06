// src/routes/auth.ts
import { Hono } from "hono";
import { Context } from "hono";
import { Env, User } from "../types";
import {
  getUserByEmail,
  createUser,
  storeRefreshToken,
  getRefreshTokenHash,
  deleteRefreshToken,
} from "../lib/db";
import {
  hashPassword,
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  hashToken,
  verifyPassword,
} from "../lib/auth";
import {
  registerValidator,
  loginValidator,
  refreshValidator,
  RegisterDTO,
  LoginDTO,
  RefreshDTO,
} from "../middleware";
import { z } from "zod";

const auth = new Hono<Env>();

/* ---------- REGISTER ---------- */
auth.post("/register", registerValidator, async (c) => {
  const data = c.req.valid("json") as z.infer<typeof RegisterDTO>;

  // 1. Check duplicate email
  const existing = await getUserByEmail(c, data.email);
  if (existing) return c.json({ error: "Email already exists" }, 400);

  // 2. Hash password
  const password_hash = await hashPassword(data.password);

  // 3. Convert undefined → null for DB
  const userInput: Omit<User, "id" | "created_at"> = {
    email: data.email,
    password_hash,
    name: data.name,
    phone: data.phone ?? null,
    address: data.address ?? null,
    role: data.role ?? "user", // Zod default is "user"
  };

  const userId = await createUser(c, userInput);
  return c.json({ message: "User registered successfully", userId }, 201);
});

/* ---------- LOGIN ---------- */
auth.post("/login", loginValidator, async (c) => {
  const { email, password } = c.req.valid("json") as z.infer<typeof LoginDTO>;
  const user = await getUserByEmail(c, email);

  // 1. Validate user + password
  if (
    !user ||
    user.role === null ||
    !(await verifyPassword(user.password_hash, password))
  ) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  // 2. Build JWT payload (role is guaranteed non-null)
  const payload = {
    sub: user.id.toString(),
    email: user.email,
    role: user.role,
  };

  const accessToken = await createAccessToken(c, payload);
  const refreshToken = await createRefreshToken(c, payload);
  const tokenHash = await hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await storeRefreshToken(c, user.id, tokenHash, expiresAt);

  c.header(
    "Set-Cookie",
    `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 3600}`
  );

  return c.json({
    message: "Login successful",
    accessToken,
    user: {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

/* ---------- REFRESH ---------- */
auth.post("/refresh", refreshValidator, async (c) => {
  const { refreshToken } = c.req.valid("json") as z.infer<typeof RefreshDTO>;

  try {
    const payload = await verifyRefreshToken(c, refreshToken);

    // 1. Validate payload
    if (!payload.sub || !payload.role) {
      return c.json({ error: "Invalid token payload" }, 401);
    }

    const tokenHash = await hashToken(refreshToken);
    const stored = await getRefreshTokenHash(c, tokenHash);

    if (!stored || new Date(stored.expires_at) < new Date()) {
      return c.json({ error: "Invalid or expired refresh token" }, 401);
    }

    // 2. Rotate
    await deleteRefreshToken(c, tokenHash);

    const newRefresh = await createRefreshToken(c, {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    });
    const newHash = await hashToken(newRefresh);
    const newExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await storeRefreshToken(c, parseInt(payload.sub), newHash, newExpires);

    const newAccess = await createAccessToken(c, {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    });

    c.header(
      "Set-Cookie",
      `refreshToken=${newRefresh}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 3600}`
    );

    return c.json({ accessToken: newAccess });
  } catch (e: any) {
    return c.json({ error: `Refresh failed: ${e.message}` }, 401);
  }
});

/* ---------- LOGOUT ---------- */
auth.post("/logout", async (c) => {
  const cookie = c.req.header("Cookie") ?? "";
  const refreshToken = cookie
    .split("; ")
    .find((s) => s.startsWith("refreshToken="))
    ?.split("=")[1];

  if (refreshToken) {
    const tokenHash = await hashToken(refreshToken);
    await deleteRefreshToken(c, tokenHash);
  }

  c.header(
    "Set-Cookie",
    "refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"
  );

  return c.json({ message: "Logged out" });
});

export default auth;