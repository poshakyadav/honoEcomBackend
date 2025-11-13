import { Hono } from "hono";
import { Context } from "hono";
import { Env } from "../types";
import { authMiddleware, adminMiddleware } from "../middleware";
import {
  checkServiceability,
  createShiprocketOrder,
  getShiprocketOrder,
  generateAwb,
  trackShipment,
  updateShiprocketOrder,
  cancelShiprocketOrder,
  handleShiprocketWebhook,
  generateLabel,
  generateManifest,
  requestPickup,
  reschedulePickup,
  cancelShipment,
  getNdr,
  updateNdr,
} from "../lib/shipping";
import {
  createShipment,
  updateShipment,
  getShipment,
  listShipmentsByOrder,
} from "../lib/db";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const shipping = new Hono<Env>();

// Serviceability Check (Public/Admin - pre-order validation)
// ────── SERVICEABILITY ──────
const ServiceabilitySchema = z.object({
  pickup_pin: z.string().length(6),
  delivery_pin: z.string().length(6),
  weight: z.number().positive(),
  cod: z.boolean(),
});
shipping.post(
  "/serviceability",
  zValidator("json", ServiceabilitySchema),
  async (c) => {
    const { pickup_pin, delivery_pin, weight, cod } = c.req.valid("json");
    const result = await checkServiceability(
      c,
      pickup_pin,
      delivery_pin,
      weight,
      cod
    );
    return c.json(result);
  }
);

// Create Shipment (Admin - after order confirm)
// ────── CREATE SHIPMENT (full mapping) ──────
const CreateShipmentSchema = z.object({
  order_id: z.number(),
  pickup_location: z.string(),
  channel_id: z.string(),
  billing_name: z.string(),
  billing_last_name: z.string(),
  billing_address: z.string(),
  billing_city: z.string(),
  billing_pincode: z.string(),
  billing_state: z.string(),
  billing_country: z.string().default("India"),
  billing_email: z.string().email(),
  billing_phone: z.string(),
  shipping_is_billing: z.boolean(),
  shipping_name: z.string(),
  shipping_last_name: z.string(),
  shipping_address: z.string(),
  shipping_city: z.string(),
  shipping_pincode: z.string(),
  shipping_state: z.string(),
  shipping_email: z.string().email(),
  shipping_phone: z.string(),
  items: z.array(
    z.object({
      name: z.string(),
      sku: z.string(),
      units: z.number(),
      selling_price: z.number(),
    })
  ),
  cod: z.boolean(),
  total: z.number(),
  length: z.number(),
  breadth: z.number(),
  height: z.number(),
  weight: z.number(),
});

shipping.post(
  "/shipments",
  authMiddleware,
  adminMiddleware,
  zValidator("json", CreateShipmentSchema),
  async (c) => {
    const data = c.req.valid("json");

    const shiprocketPayload = {
      order_id: `SR_${data.order_id}`,
      order_date: new Date().toISOString().split("T")[0],
      pickup_location: data.pickup_location,
      channel_id: data.channel_id,
      billing_customer_name: data.billing_name,
      billing_last_name: data.billing_last_name,
      billing_address: data.billing_address,
      billing_city: data.billing_city,
      billing_pincode: data.billing_pincode,
      billing_state: data.billing_state,
      billing_country: data.billing_country,
      billing_email: data.billing_email,
      billing_phone: data.billing_phone,
      shipping_is_billing: data.shipping_is_billing,
      shipping_customer_name: data.shipping_name,
      shipping_last_name: data.shipping_last_name,
      shipping_address: data.shipping_address,
      shipping_city: data.shipping_city,
      shipping_pincode: data.shipping_pincode,
      shipping_state: data.shipping_state,
      shipping_country: data.billing_country,
      shipping_email: data.shipping_email,
      shipping_phone: data.shipping_phone,
      order_items: data.items,
      payment_method: data.cod ? "COD" : "Prepaid",
      sub_total: data.total,
      length: data.length,
      breadth: data.breadth,
      height: data.height,
      weight: data.weight,
    } satisfies Parameters<typeof createShiprocketOrder>[1];

    const shiprocketData = await createShiprocketOrder(c, shiprocketPayload);

    const dbShipment = await createShipment(c, {
      order_id: data.order_id,
      shiprocket_shipment_id: String(shiprocketData.shipment_id),
      awb_code: shiprocketData.awb_code ?? "",
      courier_name: shiprocketData.courier_name ?? "",
      courier_partner_id: shiprocketData.courier_id ?? null,
      status: "pending",
    });

    return c.json({ dbShipment, shiprocketData }, 201);
  }
);

// Get Shipment Details (Admin)
shipping.get("/shipments/:id", authMiddleware, adminMiddleware, async (c) => {
  const id = parseInt(c.req.param("id"));
  const dbShipment = await getShipment(c, id);
  if (!dbShipment) return c.json({ error: "Not found" }, 404);

  // Fetch from Shiprocket
  const shiprocketShipment = await getShiprocketOrder(
    c,
    dbShipment.shiprocket_shipment_id
  );

  return c.json({ ...dbShipment, shiprocket: shiprocketShipment });
});

// Generate AWB/Label (Admin)
// ────── GENERATE AWB ──────
const AwbSchema = z.object({ courier_id: z.number() });
shipping.post(
  "/shipments/:id/awb",
  authMiddleware,
  adminMiddleware,
  zValidator("json", AwbSchema),
  async (c) => {
    const id = Number(c.req.param("id"));
    const { courier_id } = c.req.valid("json");
    const dbShipment = await getShipment(c, id);
    if (!dbShipment) return c.json({ error: "Not found" }, 404);

    const awbData = await generateAwb(
      c,
      Number(dbShipment.shiprocket_shipment_id),
      courier_id
    );

    await updateShipment(c, id, {
      awb_code: awbData.awb_code ?? dbShipment.awb_code,
      label_url: awbData.label_url ?? dbShipment.label_url,
      status: "ready_to_ship",
    });

    return c.json(awbData);
  }
);

// Track Shipment (Public/Admin)
shipping.get("/shipments/:id/track", async (c) => {
  const id = parseInt(c.req.param("id"));
  const dbShipment = await getShipment(c, id);
  if (!dbShipment) return c.json({ error: "Not found" }, 404);

  const tracking = await trackShipment(c, dbShipment.awb_code);
  return c.json(tracking);
});

// Update Shipment Status (Admin)
// ────── UPDATE SHIPMENT STATUS (Admin) ──────
const UpdateStatusSchema = z.object({
  status: z.enum([
    "pending",
    "ready_to_ship",
    "shipped",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "rto",
    "cancelled",
  ]),
  sub_status: z.string().optional(),
});

shipping.put(
  "/shipments/:id",
  authMiddleware,
  adminMiddleware,
  zValidator("json", UpdateStatusSchema),
  async (c) => {
    const id = Number(c.req.param("id"));
    const { status, sub_status } = c.req.valid("json");
    const dbShipment = await getShipment(c, id);
    if (!dbShipment) return c.json({ error: "Not found" }, 404);

    await updateShiprocketOrder(c, dbShipment.shiprocket_shipment_id, {
      status,
      sub_status,
    });
    await updateShipment(c, id, { status, sub_status: sub_status ?? null });

    return c.json({ message: "Updated" });
  }
);

// List Shipments by Order (Admin)
shipping.get(
  "/orders/:orderId/shipments",
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const orderId = parseInt(c.req.param("orderId"));
    const shipments = await listShipmentsByOrder(c, orderId);
    return c.json(shipments);
  }
);

// Generate Label
// ────── LABEL ──────
shipping.post(
  "/shipments/:id/label",
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const id = Number(c.req.param("id"));
    const dbShipment = await getShipment(c, id);
    if (!dbShipment) return c.json({ error: "Not found" }, 404);

    const labelData = await generateLabel(c, [
      Number(dbShipment.shiprocket_shipment_id),
    ]);
    await updateShipment(c, id, { label_url: labelData.label_url ?? null });

    return c.json(labelData);
  }
);

// Generate Manifest
shipping.post(
  "/shipments/:id/manifest",
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const id = Number(c.req.param("id"));
    const dbShipment = await getShipment(c, id);
    if (!dbShipment) return c.json({ error: "Not found" }, 404);

    const manifestData = await generateManifest(c, [
      Number(dbShipment.shiprocket_shipment_id),
    ]);
    return c.json(manifestData);
  }
);

// Request Pickup
shipping.post(
  "/shipments/:id/pickup",
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const id = Number(c.req.param("id"));
    const { pickup_date } = await c.req.json();
    const dbShipment = await getShipment(c, id);
    if (!dbShipment) return c.json({ error: "Not found" }, 404);

    const pickupData = await requestPickup(
      c,
      [Number(dbShipment.shiprocket_shipment_id)],
      pickup_date
    );
    await updateShipment(c, id, {
      pickup_eta: pickupData.pickup_scheduled_date ?? null,
    });

    return c.json(pickupData);
  }
);

// Reschedule Pickup
shipping.post(
  "/shipments/:id/pickup/reschedule",
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const id = parseInt(c.req.param("id"));
    const { pickup_date } = await c.req.json();
    const dbShipment = await getShipment(c, id);
    if (!dbShipment) return c.json({ error: "Not found" }, 404);

    const rescheduleData = await reschedulePickup(
      c,
      [dbShipment.awb_code],
      pickup_date
    );
    return c.json(rescheduleData);
  }
);

// CANCEL SHIPMENT (Admin)
const CancelSchema = z.object({
  reason: z.string().optional(), // Optional, not used in API but nice for logs
});

shipping.post(
  "/shipments/:id/cancel",
  authMiddleware,
  adminMiddleware,
  zValidator("json", CancelSchema),
  async (c) => {
    const id = Number(c.req.param("id"));
    const { reason } = c.req.valid("json"); // optional
    const dbShipment = await getShipment(c, id);
    if (!dbShipment) return c.json({ error: "Not found" }, 404);

    // Shiprocket: Cancel by AWB (this is the correct way)
    await cancelShipment(c, [dbShipment.awb_code]);

    // Update DB
    await updateShipment(c, id, {
      status: "cancelled",
      sub_status: reason ? `Cancelled: ${reason}` : "Cancelled by admin",
    });

    return c.json({ message: "Shipment cancelled successfully" });
  }
);

// Get NDR
shipping.get("/ndr", authMiddleware, adminMiddleware, async (c) => {
  const ndr = await getNdr(c);
  return c.json(ndr);
});

// Update NDR
shipping.post("/ndr/:awb", authMiddleware, adminMiddleware, async (c) => {
  const awb = c.req.param("awb");
  const { action, deliver_by_date } = await c.req.json();
  const result = await updateNdr(c, awb, action, deliver_by_date);
  return c.json(result);
});

// Webhook Endpoint (Public - from Shiprocket)
shipping.post("/webhook", async (c) => {
  const payload = await c.req.json();
  const signature = c.req.header("X-Shiprocket-Signature") || ""; // Or custom header

  try {
    await handleShiprocketWebhook(c, payload, signature);
    return c.json({ success: true });
  } catch (err: any) {
    console.error("Webhook Error:", err);
    return c.json({ error: err.message }, 400);
  }
});

export default shipping;
