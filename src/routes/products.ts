import { Hono } from "hono";
import { Context } from "hono";
import { Env } from "../types";
import * as schema from '../db/schema';
import {
  authMiddleware,
  adminMiddleware,
  categoryValidator,
  productValidator,
  variantValidator,
} from "../middleware";
import { CategoryDTO, ProductDTO, VariantDTO } from "../middleware";  // Added imports for DTOs
import {
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
  listCategories,
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  listProducts,
  createVariant,
  getVariant,
  updateVariant,
  deleteVariant,
} from "../lib/products";
import { uploadImages, deleteImages } from "../lib/cloudinary";
import { getDb } from "../lib/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const products = new Hono<Env>();

// Categories (Admin)
products.post(
  "/categories",
  authMiddleware,
  adminMiddleware,
  categoryValidator,
  async (c) => {
    const data = c.req.valid("json") as z.infer<typeof CategoryDTO>;
    const id = await createCategory(c, data);
    return c.json({ id }, 201);
  }
);

products.get("/categories/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const category = await getCategory(c, id);
  if (!category) return c.json({ error: "Not found" }, 404);
  return c.json(category);
});

products.put(
  "/categories/:id",
  authMiddleware,
  adminMiddleware,
  categoryValidator,
  async (c) => {
    const id = parseInt(c.req.param("id"));
    const data = c.req.valid("json") as z.infer<typeof CategoryDTO>;
    await updateCategory(c, id, data);
    return c.json({ message: "Updated" });
  }
);

products.delete(
  "/categories/:id",
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const id = parseInt(c.req.param("id"));
    await deleteCategory(c, id);
    return c.json({ message: "Deleted" });
  }
);

products.get("/categories", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const search = c.req.query("search");
  const cats = await listCategories(c, { page, limit, search });
  return c.json(cats);
});

// Products Routes (Admin CRUD, Public Read)
products.post(
  "/products",
  authMiddleware,
  adminMiddleware,
  productValidator,
  async (c) => {
    const data = c.req.valid("json") as z.infer<typeof ProductDTO>;
    const id = await createProduct(c, data);
    return c.json({ id }, 201);
  }
);

products.get("/products/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const product = await getProduct(c, id);
  if (!product) return c.json({ error: "Not found" }, 404);
  return c.json(product);
});

products.put(
  "/products/:id",
  authMiddleware,
  adminMiddleware,
  productValidator,
  async (c) => {
    const id = parseInt(c.req.param("id"));
    const data = c.req.valid("json") as z.infer<typeof ProductDTO> & { ratingDistribution?: Record<number, number> };
    await updateProduct(c, id, data);
    return c.json({ message: "Updated" });
  }
);

products.delete(
  "/products/:id",
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const id = parseInt(c.req.param("id"));
    await deleteProduct(c, id);
    return c.json({ message: "Deleted" });
  }
);

products.get("/products", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = parseInt(c.req.query("limit") || "10");
  const search = c.req.query("search");
  const categoryId = c.req.query("categoryId")
    ? parseInt(c.req.query("categoryId")!)
    : undefined;
  const prods = await listProducts(c, { page, limit, search, categoryId });
  return c.json(prods);
});

// Variants (admin, with image upload)
products.post("/variants", authMiddleware, adminMiddleware, async (c) => {
  const form = await c.req.formData();
  const body = JSON.parse(form.get("data") as string); // Send JSON as 'data' field
  const files = form.getAll("images") as File[];
  const data = VariantDTO.parse(body); // Fixed: Use DTO.parse
  let images: { url: string; public_id: string }[] = [];
  if (files.length) {
    images = await uploadImages(c, files);
  }

  // Transform: extract color and prepare for createVariant
  const variantInput = {
    product_id: data.product_id,
    name: data.name,
    description: data.description,
    sku: data.sku,
    hsn_code: data.hsn_code,
    length: data.length,
    breadth: data.breadth,
    height: data.height,
    weight: data.weight,
    is_new_arrival: data.is_new_arrival,
    is_trendy: data.is_trendy,
    is_recommended: data.is_recommended,
    color: data.color, // Pass color object (createVariant will handle insert)
    images,
    size_prices: data.size_prices, // Already snake_case
  };

  // const id = await createVariant(c, { ...data, images });
  const id = await createVariant(c, variantInput);
  return c.json({ id }, 201);
});

products.get("/variants/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  const variant = await getVariant(c, id);
  if (!variant) return c.json({ error: "Not found" }, 404);
  return c.json(variant);
});

products.put("/variants/:id", authMiddleware, adminMiddleware, async (c) => {
  const id = parseInt(c.req.param("id"));
  const form = await c.req.formData();
  const body = JSON.parse(form.get("data") as string);
  const files = form.getAll("images") as File[];
  const data = VariantDTO.parse(body);
  let images: { url: string; public_id: string }[] = [];
  if (files.length) {
    images = await uploadImages(c, files);
  }

  const updateInput = {
    name: data.name,
    description: data.description,
    sku: data.sku,
    hsn_code: data.hsn_code,
    length: data.length,
    breadth: data.breadth,
    height: data.height,
    weight: data.weight,
    is_new_arrival: data.is_new_arrival,
    is_trendy: data.is_trendy,
    is_recommended: data.is_recommended,
    color: data.color, // This will create new color if provided
    images,
    size_prices: data.size_prices,
    replaceImages: files.length > 0,
  };
  
  // await updateVariant(c, id, {
  //   ...data,
  //   images,
  //   replaceImages: files.length > 0,
  // });
  await updateVariant(c, id, updateInput);
  return c.json({ message: "Updated" });
});

// DELETE /variants/:id (delete images from Cloudinary)
products.delete("/variants/:id", authMiddleware, adminMiddleware, async (c) => {
  const id = parseInt(c.req.param("id"));
  await deleteVariant(c, id);
  return c.json({ message: "Deleted" });
});

export default products;