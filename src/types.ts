import { Context } from "hono";
import { D1Database } from "@cloudflare/workers-types";

export interface Env {
  Bindings: {
    DB: D1Database;
    ACCESS_SECRET: string;
    REFRESH_SECRET: string;
    ISSUER: string;
    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
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

export interface ProductCategory {
  id: number;
  name: string;
  description: string | null;
  active: number;  // 1 true, 0 false (SQLite boolean)
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

// Product Related Interfaces
export interface Product {
  id: number;
  brand: string;
  category_id: number;
  default_variant_id: number | null;
  active: number;
  average_rating: number;  // e.g., 4.3 as real
  total_ratings: number;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  name: string;
  description: string | null;
  sku: string;
  hsn_code: string | null;
  active: number;
  color_id: number;
  length: number;  // cm, real
  breadth: number;
  height: number;
  weight: number;  // kg, real
  is_new_arrival: number;
  is_trendy: number;
  is_recommended: number;
  view_count: number;
  sales_count: number;
  created_at: string;
  updated_at: string;
}

export interface SizePrice {
  id: number;
  variant_id: number;
  size: string;
  base_price: number;  // integer
  discount_percent: number;  // 0-100
  discount_amount: number;
  discounted_price: number;
  total_price: number;  // == discounted_price
  stock: number;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface VariantColor {
  id: number;
  name: string;
  hex_code: string | null;
}

// Helper interfaces if needed for queries