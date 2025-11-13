import { Context } from "hono";
import { D1Database } from "@cloudflare/workers-types";
import { OrderSelect } from "./db/schema";

export interface Env {
  Bindings: {
    DB: D1Database;
    ACCESS_SECRET: string;
    REFRESH_SECRET: string;
    ISSUER: string;
    // Clodinary related
    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
    // Shiprocket related
    SHIPROCKET_EMAIL: string;  // For auth
    SHIPROCKET_PASSWORD: string;
    SHIPROCKET_TOKEN?: string;  // Optional, auto-fetch
    // Webhook secret for verification
    SHIPROCKET_WEBHOOK_SECRET: string;
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
  addresses?: Address[];  // Optional for queries
  pickupAddresses?: PickupAddress[];  // For admins
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

// Shipment Related Interfaces
export interface Shipment {
  id: number;
  order_id: number;
  shiprocket_shipment_id: string;
  awb_code: string;
  courier_name: string;
  courier_partner_id: number | null;
  pickup_eta: string | null;
  delivery_eta: string | null;
  status: 'pending' | 'ready_to_ship' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'rto' | 'cancelled';
  tracking_url: string | null;
  label_url: string | null;
  sub_status: string | null;
  created_at: string;
  updated_at: string;
}

// Extend Order type
export interface Order extends Omit<OrderSelect, 'shipments'> {  // Assume OrderSelect from schema
  shipments: Shipment[];
}


export interface Address {
  id: number;
  user_id: number;
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  phone: string;
  is_default: number;  // boolean 0/1
  is_serviceable: number;
  created_at: string;
  updated_at: string;
}

export interface PickupAddress {
  id: number;
  admin_id: number;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

// Helper interfaces if needed for queries