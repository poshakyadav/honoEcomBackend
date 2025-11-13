import { Context } from "hono";
import { Env } from "../types";
import { getDb } from "./db";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// ──────────────────────────────────────────────────────────────────────
// Helper types for Shiprocket responses (taken from the official docs)
// ──────────────────────────────────────────────────────────────────────
interface ShiprocketAuthResponse {
  token: string;
  // … other fields you don’t need
}

interface ShiprocketErrorResponse {
  message: string;
  status_code?: number;
}

interface ServiceabilityResponse {
  available_courier_companies: Array<{
    courier_name: string;
    courier_id: number;
    // ... other fields
  }>;
  // ... other fields
}

const BASE_URL = "https://apiv2.shiprocket.in/v1/"; // Sandbox; change to live
const HEADERS = { "Content-Type": "application/json" };

async function retryFetch(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (res.status >= 500) continue; // Retry server errors
      throw new Error(
        `Shiprocket API Error: ${res.status} - ${await res.text()}`
      );
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i))); // Exponential backoff
    }
  }
  throw new Error("Max retries exceeded");
}

// ────── AUTH ──────
async function getAuthToken(c: Context<Env>): Promise<string> {
  if (c.env.SHIPROCKET_TOKEN) return c.env.SHIPROCKET_TOKEN;

  const res = await retryFetch(`${BASE_URL}external/auth/login`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      email: c.env.SHIPROCKET_EMAIL,
      password: c.env.SHIPROCKET_PASSWORD,
    }),
  });

  if (!res.ok) {
    const err = (await res.json()) as ShiprocketErrorResponse;
    throw new Error(`Shiprocket login failed: ${err.message}`);
  }

  const data = (await res.json()) as ShiprocketAuthResponse;
  // cache for the lifetime of the worker (10-day token)
  c.env.SHIPROCKET_TOKEN = data.token;
  return data.token;
}

// 1. Serviceability Check
export async function checkServiceability(
  c: Context<Env>,
  pickupPin: string,
  deliveryPin: string,
  weight: number,
  cod: boolean,
  weightUnit = "Kg"
): Promise<ServiceabilityResponse> {
  const token = await getAuthToken(c);
  const params = new URLSearchParams({
    pickup_postcode: pickupPin,
    delivery_postcode: deliveryPin,
    weight: weight.toString(),
    cod: cod ? "1" : "0",
    weight_unit: weightUnit,
  });
  const res = await retryFetch(`${BASE_URL}courier/serviceability?${params}`, {
    headers: { Authorization: `Bearer ${token}`, ...HEADERS },
  });
  return (await res.json()) as ServiceabilityResponse;
}

// 2. Create Order (POST /external/orders/create/adhoc)
export async function createShiprocketOrder(
  c: Context<Env>,
  orderData: {
    order_id: string;
    order_date: string;
    pickup_location: string;
    channel_id: string;
    billing_customer_name: string;
    billing_last_name: string;
    billing_address: string;
    billing_city: string;
    billing_pincode: string;
    billing_state: string;
    billing_country: string;
    billing_email: string;
    billing_phone: string;
    shipping_is_billing: boolean;
    shipping_customer_name: string;
    shipping_last_name: string;
    shipping_address: string;
    shipping_city: string;
    shipping_pincode: string;
    shipping_country: string;
    shipping_state: string;
    shipping_email: string;
    shipping_phone: string;
    order_items: Array<{
      name: string;
      sku: string;
      units: number;
      selling_price: number;
    }>;
    payment_method: "Prepaid" | "COD";
    sub_total: number;
    length: number;
    breadth: number;
    height: number;
    weight: number;
  }
) {
  const token = await getAuthToken(c);
  const res = await retryFetch(`${BASE_URL}external/orders/create/adhoc`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...HEADERS },
    body: JSON.stringify(orderData),
  });

  const json = await res.json();
  if (!res.ok) throw new Error((json as any).message ?? "Create order failed");
  return json as {
    order_id: number;
    shipment_id: number;
    awb_code?: string;
    courier_name?: string;
    courier_id?: number;
  };
}

// 3. Update Order Status
export async function updateShiprocketOrder(
  c: Context<Env>,
  shipmentId: string,
  updates: { status: string; sub_status?: string }
) {
  const token = await getAuthToken(c);
  const res = await retryFetch(
    `${BASE_URL}external/orders/update/awb/${shipmentId}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, ...HEADERS },
      body: JSON.stringify(updates),
    }
  );

  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.message ?? "Update failed");
  return data;
}

// 4. Get Order Details (GET /external/orders/show/{id})
export async function getShiprocketOrder(c: Context<Env>, orderId: string) {
  const token = await getAuthToken(c);
  const res = await retryFetch(`${BASE_URL}external/orders/show/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

// 5. Generate AWB (POST /external/courier/assign/awb)
export async function generateAwb(
  c: Context<Env>,
  shipmentId: number, // <-- number, not string
  courierId: number
) {
  const token = await getAuthToken(c);
  const res = await retryFetch(`${BASE_URL}external/courier/assign/awb`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...HEADERS },
    body: JSON.stringify({ shipment_id: shipmentId, courier_id: courierId }),
  });

  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.message ?? "AWB generation failed");
  return data.response?.data ?? data;
}

// 6. Generate Label (POST /external/courier/generate/label)
export async function generateLabel(c: Context<Env>, shipmentIds: number[]) {
  const token = await getAuthToken(c);
  const res = await retryFetch(`${BASE_URL}external/courier/generate/label`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...HEADERS },
    body: JSON.stringify({ shipment_id: shipmentIds }),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.message ?? "Label failed");
  return data; // { label_url: string }
}

// 7. Generate Manifest (POST /external/courier/generate/manifest)
export async function generateManifest(c: Context<Env>, shipmentIds: number[]) {
  const token = await getAuthToken(c);
  const res = await retryFetch(
    `${BASE_URL}external/courier/generate/manifest`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, ...HEADERS },
      body: JSON.stringify({ shipment_id: shipmentIds }),
    }
  );
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.message ?? "Manifest failed");
  return data;
}

// 8. Request Pickup (POST /external/courier/generate/pickup)
export async function requestPickup(
  c: Context<Env>,
  shipmentIds: number[],
  pickupDate: string
) {
  const token = await getAuthToken(c);
  const res = await retryFetch(`${BASE_URL}external/courier/generate/pickup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...HEADERS },
    body: JSON.stringify({ shipment_id: shipmentIds, pickup_date: pickupDate }),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.message ?? "Pickup failed");
  return data;
}

// 9. Reschedule Pickup (POST /external/courier/pickup/reschedule)
export async function reschedulePickup(
  c: Context<Env>,
  awbCodes: string[],
  pickupDate: string
) {
  const token = await getAuthToken(c);
  const res = await retryFetch(
    `${BASE_URL}external/courier/pickup/reschedule`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ awbs: awbCodes, rescheduled_date: pickupDate }),
    }
  );
  return res.json(); // { status }
}

// 10. Track Shipment (GET /external/courier/track)
export async function trackShipment(c: Context<Env>, shipmentId: string) {
  const token = await getAuthToken(c);
  const res = await retryFetch(
    `${BASE_URL}external/courier/track/shipment/${shipmentId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return res.json(); // Tracking data
}

// 11. Cancel Order (POST /external/orders/cancel)
// Never use cancelShiprocketOrder for shipments — use cancelShipment with AWB list.
export async function cancelShiprocketOrder(
  c: Context<Env>,
  orderIds: number[]
) {
  const token = await getAuthToken(c);
  const res = await retryFetch(`${BASE_URL}external/orders/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...HEADERS },
    body: JSON.stringify({ ids: orderIds }),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.message ?? "Cancel order failed");
  return data;
}

// 12. Cancel Shipment (POST /external/orders/cancel/shipment/awbs)
export async function cancelShipment(c: Context<Env>, awbs: string[]) {
  const token = await getAuthToken(c);
  const res = await retryFetch(
    `${BASE_URL}external/orders/cancel/shipment/awbs`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, ...HEADERS },
      body: JSON.stringify({ awbs }),
    }
  );
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.message ?? "Cancel failed");
  return data;
}

// 13. NDR Actions (GET /external/ndr, POST /external/ndr/awb)
export async function getNdr(c: Context<Env>) {
  const token = await getAuthToken(c);
  const res = await retryFetch(`${BASE_URL}external/ndr`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json(); // List of NDR
}

export async function updateNdr(
  c: Context<Env>,
  awb: string,
  action: "REDELIVER" | "RTO",
  newDate?: string
) {
  const token = await getAuthToken(c);
  const body: Record<string, string> = { awb, action };
  if (action === "REDELIVER" && newDate) body.deliver_by_date = newDate;

  const res = await retryFetch(`${BASE_URL}external/ndr/awb`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, ...HEADERS },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data.message ?? "NDR update failed");
  return data;
}

// 14. Webhook Handler (call from route)
export async function handleShiprocketWebhook(
  c: Context<Env>,
  payload: any,
  signature: string
) {
  // Verify HMAC (use crypto.subtle)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(c.env.SHIPROCKET_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(JSON.stringify(payload))
  );
  const expectedSig = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  if (signature !== expectedSig) throw new Error("Invalid webhook signature");

  // Update DB based on payload (e.g., { shipment_id, status, tracking_url })
  const db = getDb(c.env); // Import from db.ts
  const shipment = await db.query.shipments.findFirst({
    where: eq(schema.shipments.shiprocket_shipment_id, payload.shipment_id),
  });
  if (!shipment) return { success: false };

  await db
    .update(schema.shipments)
    .set({
      status: payload.status,
      tracking_url: payload.tracking_url,
      sub_status: payload.sub_status,
      updated_at: new Date().toISOString(),
    })
    .where(eq(schema.shipments.id, shipment.id));

  // Update parent order status
  await db
    .update(schema.orders)
    .set({ status: payload.status })
    .where(eq(schema.orders.id, shipment.order_id));

  return { success: true };
}
