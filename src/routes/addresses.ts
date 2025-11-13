import { Hono } from "hono";
import { Context } from "hono";
import { Env } from "../types";
import {
  authMiddleware,
  adminMiddleware,
  addressValidator,
  pickupAddressValidator,
} from "../middleware";
import { checkServiceability } from "../lib/shipping";
import {
  createAddress,
  updateAddress,
  deleteAddress,
  getAddress,
  listUserAddresses,
  upsertPickupAddress,
  getPickupAddress,
  getAdminPickupPin,
} from "../lib/db";

const addresses = new Hono<Env>();

// User Addresses
addresses.post("/addresses", authMiddleware, addressValidator, async (c) => {
  const user = c.get("user");
  if (user.role !== "user")
    return c.json({ error: "Only users can add shipping addresses" }, 403);
  const data = c.req.valid("json");

  // Check serviceability (use default pickup PIN or fetch admin pickup)
  const pickupPin = await getAdminPickupPin(c);

  const serviceable = await checkServiceability(
    c,
    pickupPin,
    data.pincode,
    1, // Weight 1 Kg dummy
    false
  );
  const isServiceable = serviceable.available_courier_companies.length > 0;

  const addressId = await createAddress(c, {
    ...data,
    user_id: Number(user.sub),
    is_serviceable: isServiceable, // ← boolean
  });

  if (!isServiceable) {
    return c.json(
      {
        message:
          "We are not currently available at this address, but we're expanding soon! Please add a different address to successfully place your order.",
        addressId,
      },
      201
    );
  }

  return c.json({ addressId }, 201);
});

addresses.get("/addresses", authMiddleware, async (c) => {
  const user = c.get("user");
  if (user.role !== "user")
    return c.json({ error: "Only users can list their addresses" }, 403);
  const addrs = await listUserAddresses(c, Number(user.sub));
  return c.json(addrs);
});

addresses.get("/addresses/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const addr = await getAddress(c, id);
  if (!addr || addr.user_id !== Number(user.sub))
    return c.json({ error: "Not found or unauthorized" }, 404);
  return c.json(addr);
});

addresses.put("/addresses/:id", authMiddleware, addressValidator, async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const data = c.req.valid("json");
  const addr = await getAddress(c, id);
  if (!addr || addr.user_id !== Number(user.sub))
    return c.json({ error: "Not found or unauthorized" }, 404);

  // Re-check serviceability
  const pickupPin = await getAdminPickupPin(c);
  const serviceable = await checkServiceability(
    c,
    pickupPin,
    data.pincode,
    1,
    false
  );
  const isServiceable = serviceable.available_courier_companies.length > 0;

  await updateAddress(c, id, {
    ...data,
    is_serviceable: isServiceable,
  });

  if (!isServiceable) {
    return c.json({
      message:
        "Updated, but this address is not currently serviceable. We're working on it—please use another for orders.",
    });
  }

  return c.json({ message: "Updated" });
});

addresses.delete("/addresses/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  const addr = await getAddress(c, id);
  if (!addr || addr.user_id !== Number(user.sub))
    return c.json({ error: "Not found or unauthorized" }, 404);
  await deleteAddress(c, id);
  return c.json({ message: "Deleted" });
});

// Admin Pickup Address (only one)
addresses.post(
  "/pickup-address",
  authMiddleware,
  adminMiddleware,
  pickupAddressValidator,
  async (c) => {
    const user = c.get("user");
    const data = c.req.valid("json");
    const id = await upsertPickupAddress(c, {
      ...data,
      admin_id: Number(user.sub),
    });
    return c.json({ id }, 201);
  }
);

addresses.get("/pickup-address", authMiddleware, adminMiddleware, async (c) => {
  const user = c.get("user");
  const addr = await getPickupAddress(c, Number(user.sub));
  if (!addr) return c.json({ error: "No pickup address set" }, 404);
  return c.json(addr);
});

export default addresses;
