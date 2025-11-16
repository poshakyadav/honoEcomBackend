// src/lib/cart.ts

import { eq, and, sql, InferSelectModel } from "drizzle-orm";
import { Context } from "hono";
import { CartItemResponse, Env } from "../types";
import * as schema from "../db/schema";
import { getDb } from "./db";

const db = (c: Context<Env>) => getDb(c.env);

/* ---------- ADD / UPDATE (upsert) ---------- */
export async function upsertCartItem(
  c: Context<Env>,
  userId: number,
  sizePriceId: number,
  qty: number
): Promise<number> {
  const now = new Date().toISOString();

  // First verify stock
  const sp = await db(c)
    .select({ stock: schema.size_prices.stock })
    .from(schema.size_prices)
    .where(eq(schema.size_prices.id, sizePriceId))
    .then((rows) => rows[0]);

  if (!sp) throw new Error("Size-price not found");
  if (sp.stock < qty) throw new Error("Insufficient stock");

  const existing = await db(c)
    .select()
    .from(schema.cart_items)
    .where(
      and(
        eq(schema.cart_items.user_id, userId),
        eq(schema.cart_items.size_price_id, sizePriceId)
      )
    )
    .then((rows) => rows[0]);

  if (existing) {
    await db(c)
      .update(schema.cart_items)
      .set({ quantity: qty, updated_at: now })
      .where(eq(schema.cart_items.id, existing.id));
    return existing.id;
  }

  const [ins] = await db(c)
    .insert(schema.cart_items)
    .values({
      user_id: userId,
      size_price_id: sizePriceId,
      quantity: qty,
      created_at: now,
      updated_at: now,
    })
    .returning({ id: schema.cart_items.id });

  return ins!.id;
}

/* ---------- GET USER CART - FULLY TYPE-SAFE ---------- */
export async function getUserCart(c: Context<Env>, userId: number): Promise<CartItemResponse[]> {
  const cartItems = await db(c)
    .select({
      cartItem: schema.cart_items,
      sizePrice: schema.size_prices,
      variant: schema.product_variants,
      product: schema.products,
      color: schema.variant_colors,
      images: schema.variant_images,
    })
    .from(schema.cart_items)
    .leftJoin(
      schema.size_prices,
      eq(schema.cart_items.size_price_id, schema.size_prices.id)
    )
    .leftJoin(
      schema.product_variants,
      eq(schema.size_prices.variant_id, schema.product_variants.id)
    )
    .leftJoin(
      schema.products,
      eq(schema.product_variants.product_id, schema.products.id)
    )
    .leftJoin(
      schema.variant_colors,
      eq(schema.product_variants.color_id, schema.variant_colors.id)
    )
    .leftJoin(
      schema.variant_images,
      eq(schema.variant_images.variant_id, schema.product_variants.id)
    )
    .where(eq(schema.cart_items.user_id, userId))
    .orderBy(schema.cart_items.created_at);

  // Group images by variant and build final shape
  const grouped = cartItems.reduce((acc, row) => {
    const item = row.cartItem;
    if (!item) return acc;

    let existing = acc.find((i) => i.id === item.id);
    if (!existing) {
      existing = {
        ...item,
        sizePrice: row.sizePrice
          ? {
              ...row.sizePrice,
              variant: row.variant
                ? {
                    ...row.variant,
                    product: row.product || undefined,
                    color: row.color || undefined,
                    images: [],
                  }
                : undefined,
            }
          : undefined,
      };
      acc.push(existing);
    }

    // Add image if exists
    if (row.images && existing.sizePrice?.variant) {
      existing.sizePrice.variant.images!.push(row.images);
    }

    return acc;
  }, [] as any[]);

  return grouped;
}

/* ---------- UPDATE CART ITEM QUANTITY BY ID ---------- */
export async function updateCartItemQuantity(
  c: Context<Env>,
  cartItemId: number,
  newQuantity: number
): Promise<void> {
  const now = new Date().toISOString();

  // First get the cart item with size_price to check stock
  const cartItem = await db(c)
    .select({
      cartId: schema.cart_items.id,
      sizePriceId: schema.cart_items.size_price_id,
      stock: schema.size_prices.stock,
    })
    .from(schema.cart_items)
    .leftJoin(schema.size_prices, eq(schema.cart_items.size_price_id, schema.size_prices.id))
    .where(eq(schema.cart_items.id, cartItemId))
    .then((rows) => rows[0]);

  if (!cartItem) throw new Error("Cart item not found");
  if (!cartItem.sizePriceId || cartItem.stock === null)
    throw new Error("Invalid size price");

  if (newQuantity === 0) {
    await db(c)
      .delete(schema.cart_items)
      .where(eq(schema.cart_items.id, cartItemId));
    return;
  }

  if (cartItem.stock < newQuantity) {
    throw new Error(`Only ${cartItem.stock} in stock`);
  }

  await db(c)
    .update(schema.cart_items)
    .set({ quantity: newQuantity, updated_at: now })
    .where(eq(schema.cart_items.id, cartItemId));
}

/* ---------- CLEAR CART ---------- */
export async function clearUserCart(
  c: Context<Env>,
  userId: number
): Promise<void> {
  await db(c)
    .delete(schema.cart_items)
    .where(eq(schema.cart_items.user_id, userId));
}
