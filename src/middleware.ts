import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { Context, Next } from "hono";
import { Env } from "./types";
import { verifyAccessToken } from "./lib/auth";

// DTO Schemas (Zod)
export const RegisterDTO = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  role: z.enum(["user", "admin"]).default("user"),
});

export const LoginDTO = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const RefreshDTO = z.object({
  refreshToken: z.string(),
});

// Auth Middleware (for protected routes)
export const authMiddleware = async (c: Context<Env>, next: Next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }
  const token = auth.slice(7);
  try {
    const payload = await verifyAccessToken(c, token);
    c.set("user", payload);
    await next();
  } catch (err: any) {
    return c.json({ error: `Invalid token: ${err.message}` }, 401);
  }
};

// Admin Middleware (after auth)
export const adminMiddleware = async (c: Context<Env>, next: Next) => {
  const user = c.get("user");
  if (user.role !== "admin") {
    return c.json({ error: "Admin access required" }, 403);
  }
  await next();
};

// Validators (export for routes)
export const registerValidator = zValidator("json", RegisterDTO);
export const loginValidator = zValidator("json", LoginDTO);
export const refreshValidator = zValidator("json", RefreshDTO);
