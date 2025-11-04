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

export interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  phone?: string;
  address?: string;
  role: "user" | "admin";
  created_at: string;
}

export interface TokenPayload extends Record<string, unknown> {  // Add extends Record<string, unknown>
  sub: string; // user.id
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
  created_at: string;
}

// Extend Context for user
declare module "hono" {
  interface ContextVariableMap {
    user: TokenPayload;
  }
}
