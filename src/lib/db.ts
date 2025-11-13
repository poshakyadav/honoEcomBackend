import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { Context } from "hono";
import { Env, User, RefreshToken } from "../types";
import * as schema from "../db/schema"; // ← correct path

export function getDb(bindings: Env["Bindings"]) {
  return drizzle(bindings.DB, { schema });
}

/* ---------- GET USER ---------- */
export async function getUserByEmail(
  c: Context<Env>,
  email: string
): Promise<User | null> {
  const db = getDb(c.env);
  const result = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });
  return result ?? null;
}

/* ---------- CREATE USER ---------- */
export async function createUser(
  c: Context<Env>,
  user: Omit<User, "id" | "created_at">
): Promise<number> {
  const db = getDb(c.env);
  const [inserted] = await db
    .insert(schema.users)
    .values({
      ...user,
      // Ensure nulls are passed correctly
      phone: user.phone ?? null,
      address: user.address ?? null,
      role: user.role ?? "user",
    })
    .returning({ id: schema.users.id });
  return inserted.id;
}

/* ---------- REFRESH TOKENS ---------- */
export async function storeRefreshToken(
  c: Context<Env>,
  userId: number,
  tokenHash: string,
  expiresAt: string
): Promise<void> {
  const db = getDb(c.env);
  await db.insert(schema.refresh_tokens).values({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });
}

export async function getRefreshTokenHash(
  c: Context<Env>,
  tokenHash: string
): Promise<RefreshToken | null> {
  const db = getDb(c.env);
  const result = await db.query.refresh_tokens.findFirst({
    where: eq(schema.refresh_tokens.token_hash, tokenHash),
  });
  return result ?? null;
}

export async function deleteRefreshToken(
  c: Context<Env>,
  tokenHash: string
): Promise<void> {
  const db = getDb(c.env);
  await db
    .delete(schema.refresh_tokens)
    .where(eq(schema.refresh_tokens.token_hash, tokenHash));
}

/* ---------- SHIPMENTS ---------- */
// Shipping Helpers
export async function createShipment(
  c: Context<Env>,
  shipment: Omit<schema.ShipmentInsert, "id" | "created_at" | "updated_at">
) {
  const db = getDb(c.env);
  const now = new Date().toISOString();
  const [inserted] = await db
    .insert(schema.shipments)
    .values({
      ...shipment,
      created_at: now,
      updated_at: now,
    })
    .returning({ id: schema.shipments.id });
  return inserted.id;
}

export async function updateShipment(
  c: Context<Env>,
  id: number,
  updates: Partial<schema.ShipmentInsert>
) {
  const db = getDb(c.env);
  const now = new Date().toISOString();
  await db
    .update(schema.shipments)
    .set({ ...updates, updated_at: now })
    .where(eq(schema.shipments.id, id));
}

export async function getShipment(c: Context<Env>, id: number) {
  const db = getDb(c.env);
  return db.query.shipments.findFirst({
    where: eq(schema.shipments.id, id),
    with: { order: true },
  });
}

export async function listShipmentsByOrder(c: Context<Env>, orderId: number) {
  const db = getDb(c.env);
  return db.query.shipments.findMany({
    where: eq(schema.shipments.order_id, orderId),
  });
}

// ---------- Address Helpers ---------- //
// Addresses
export async function createAddress(
  c: Context<Env>,
  address: Omit<
    schema.AddressInsert,
    "id" | "created_at" | "updated_at" | "is_serviceable" | "is_default"
  > & { is_serviceable: boolean }
) {
  const db = getDb(c.env);
  const now = new Date().toISOString();
  const [inserted] = await db
    .insert(schema.addresses)
    .values({
      ...address,
      is_default: false, // ← NOW FALSE (boolean)
      created_at: now,
      updated_at: now,
    })
    .returning({ id: schema.addresses.id });
  return inserted.id;
}

export async function updateAddress(
  c: Context<Env>,
  id: number,
  updates: Partial<schema.AddressInsert> & { is_serviceable?: boolean }
) {
  const db = getDb(c.env);
  const now = new Date().toISOString();

  // Convert boolean to proper type
  const processedUpdates = {
    ...updates,
    is_default: updates.is_default ?? undefined,
    is_serviceable: updates.is_serviceable ?? undefined,
  };

  await db
    .update(schema.addresses)
    .set({ ...processedUpdates, updated_at: now })
    .where(eq(schema.addresses.id, id));
}

export async function deleteAddress(c: Context<Env>, id: number) {
  const db = getDb(c.env);
  await db.delete(schema.addresses).where(eq(schema.addresses.id, id));
}

export async function getAddress(c: Context<Env>, id: number) {
  const db = getDb(c.env);
  return db.query.addresses.findFirst({ where: eq(schema.addresses.id, id) });
}

export async function listUserAddresses(c: Context<Env>, userId: number) {
  const db = getDb(c.env);
  return db.query.addresses.findMany({
    where: eq(schema.addresses.user_id, userId),
  });
}

// Pickup Addresses (limit to one)
export async function upsertPickupAddress(
  c: Context<Env>,
  address: Omit<schema.PickupAddressInsert, "id" | "created_at" | "updated_at">
) {
  const db = getDb(c.env);
  const now = new Date().toISOString();

  // Check if exists for admin
  const existing = await db.query.pickup_addresses.findFirst({
    where: eq(schema.pickup_addresses.admin_id, address.admin_id),
  });
  if (existing) {
    // Update
    await db
      .update(schema.pickup_addresses)
      .set({ ...address, updated_at: now })
      .where(eq(schema.pickup_addresses.id, existing.id));
    return existing.id;
  } else {
    // Insert
    const [inserted] = await db
      .insert(schema.pickup_addresses)
      .values({
        ...address,
        created_at: now,
        updated_at: now,
      })
      .returning({ id: schema.pickup_addresses.id });
    return inserted.id;
  }
}

export async function getPickupAddress(c: Context<Env>, adminId: number) {
  const db = getDb(c.env);
  return db.query.pickup_addresses.findFirst({
    where: eq(schema.pickup_addresses.admin_id, adminId),
  });
}

export async function getAdminPickupPin(c: Context<Env>): Promise<string> {
  const db = getDb(c.env);
  const admin = await db.query.users.findFirst({
    where: eq(schema.users.role, 'admin')
  });
  if (!admin) throw new Error("No admin found");

  const pickup = await getPickupAddress(c, admin.id);
  if (!pickup) throw new Error("Admin pickup address not set");

  return pickup.pincode;
}