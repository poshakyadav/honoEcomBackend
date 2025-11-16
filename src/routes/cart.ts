// src/routes/cart.ts
import { Hono } from "hono";
import { authMiddleware } from "../middleware";
import { addToCartValidator, updateCartValidator } from "../middleware";
import { upsertCartItem, getUserCart, clearUserCart, updateCartItemQuantity } from "../lib/cart";
import { z } from "zod";

const cart = new Hono();

/* ---------- ADD TO CART ---------- */
cart.post("/", authMiddleware, addToCartValidator, async (c) => {
  const user = c.get("user");
  const { size_price_id, quantity } = c.req.valid("json");

  try {
    await upsertCartItem(c, Number(user.sub), size_price_id, quantity);
    return c.json({ message: "Added to cart" }, 201);
  } catch (e: any) {
    if (e.message.includes("stock")) return c.json({ error: e.message }, 400);
    return c.json({ error: "Failed to add" }, 500);
  }
});

/* ---------- GET CART ---------- */
cart.get("/", authMiddleware, async (c) => {
  const user = c.get("user");
  const items = await getUserCart(c, Number(user.sub));

  // Compute totals
  const summary = items.reduce(
    (acc, i) => {
      const price = i.sizePrice?.total_price ?? 0;
      acc.subtotal += price * i.quantity;
      acc.totalItems += i.quantity;
      return acc;
    },
    { subtotal: 0, totalItems: 0 }
  );

  return c.json({ items, summary });
});

/* ---------- UPDATE QUANTITY ---------- */
cart.patch("/:itemId", authMiddleware, updateCartValidator, async (c) => {
  const user = c.get("user");
  const itemId = Number(c.req.param("itemId"));
  const { quantity } = c.req.valid("json");

  // Verify ownership
  const item = await c.env.DB.prepare(
    `SELECT user_id, size_price_id FROM cart_items WHERE id = ?`
  )
    .bind(itemId)
    .first<{ user_id: number }>();

  if (!item || item.user_id !== Number(user.sub))
    return c.json({ error: "Not found or unauthorized" }, 404);

  try {
    await updateCartItemQuantity(c, itemId, quantity);
    return c.json({ message: quantity === 0 ? "Removed" : "Updated" });
  } catch (e: any) {
    if (e.message.includes("stock")) {
      return c.json({ error: e.message }, 400);
    }
    return c.json({ error: "Failed to update cart" }, 500);
  }
});

/* ---------- REMOVE ITEM ---------- */
cart.delete("/:itemId", authMiddleware, async (c) => {
  const user = c.get("user");
  const itemId = Number(c.req.param("itemId"));

  const item = await c.env.DB.prepare(
    `SELECT user_id FROM cart_items WHERE id = ?`
  )
    .bind(itemId)
    .first<{ user_id: number }>();

  if (!item || item.user_id !== Number(user.sub))
    return c.json({ error: "Not found" }, 404);

  await c.env.DB.prepare(`DELETE FROM cart_items WHERE id = ?`)
    .bind(itemId)
    .run();

  return c.json({ message: "Removed" });
});

/* ---------- CLEAR CART ---------- */
cart.delete("/", authMiddleware, async (c) => {
  const user = c.get("user");
  await clearUserCart(c, Number(user.sub));
  return c.json({ message: "Cart cleared" });
});

export default cart;
