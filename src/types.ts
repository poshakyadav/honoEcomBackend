import { Context } from "hono";
import { D1Database } from "@cloudflare/workers-types";

export interface Env {
  Bindings: {
    DB: D1Database;
    ACCESS_SECRET: string;
    REFRESH_SECRET: string;
    ISSUER: string;
  };
}

// Match Drizzle's inferred types exactly
export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  phone: string | null;        // ← was `? string`
  address: string | null;      // ← was `? string`
  role: "user" | "admin" | null; // ← was `"user" | "admin"`
  created_at: string | null;   // ← was `string`
}

export interface TokenPayload extends Record<string, unknown> {
  sub: string;
  email: string;
  role: "user" | "admin";
  exp: number;
  iat: number;
  nbf: number;
  iss: string;
}

export interface RefreshToken {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  created_at: string | null;   // ← was `string`
}

declare module "hono" {
  interface ContextVariableMap {
    user: TokenPayload;
  }
}