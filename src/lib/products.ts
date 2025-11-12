import { drizzle } from 'drizzle-orm/d1';
import { eq, and, like } from 'drizzle-orm';  // Removed unused imports
import { Context } from 'hono';
import { Env } from '../types';
import * as schema from '../db/schema';
import {
  ProductCategoryInsert,
  ProductCategorySelect,
  ProductInsert,
  ProductSelect,
  ProductVariantInsert,
  ProductVariantSelect,
  SizePriceInsert,
} from '../db/schema';  // Imported inferred types
import { deleteImages } from './cloudinary';  // For deleteVariant

// Reuse getDb from db.ts or duplicate here
function getDb(bindings: Env['Bindings']) {
  return drizzle(bindings.DB, { schema });
}

// Categories
export async function createCategory(
  c: Context<Env>,
  category: Omit<ProductCategoryInsert, 'id' | 'created_at' | 'updated_at' | 'active'> & {
    attributes?: string[];
  }
) {
  const db = getDb(c.env);
  const now = new Date().toISOString();
  const [inserted] = await db
    .insert(schema.product_categories)
    .values({
      ...category,
      active: true,  // Fixed: Use boolean
      created_at: now,
      updated_at: now,
    })
    .returning({ id: schema.product_categories.id });
  if (category.attributes?.length) {
    await db.insert(schema.category_attributes).values(
      category.attributes.map((attr) => ({ category_id: inserted.id, attribute: attr }))
    );
  }
  return inserted.id;
}

export async function getCategory(c: Context<Env>, id: number): Promise<(ProductCategorySelect & { attributes: string[] }) | null> {
  const db = getDb(c.env);
  const category = await db.query.product_categories.findFirst({ where: eq(schema.product_categories.id, id) });
  if (!category) return null;
  const attributes = await db.query.category_attributes.findMany({ where: eq(schema.category_attributes.category_id, id) });
  return { ...category, attributes: attributes.map((a) => a.attribute) };
}

export async function updateCategory(
  c: Context<Env>,
  id: number,
  updates: Partial<ProductCategoryInsert> & { attributes?: string[] }
) {
  const db = getDb(c.env);
  const now = new Date().toISOString();
  await db
    .update(schema.product_categories)
    .set({ ...updates, updated_at: now })
    .where(eq(schema.product_categories.id, id));
  if (updates.attributes !== undefined) {  // Handle if explicitly set to undefined (clear)
    await db.delete(schema.category_attributes).where(eq(schema.category_attributes.category_id, id));
    if (updates.attributes?.length) {
      await db.insert(schema.category_attributes).values(
        updates.attributes.map((attr) => ({ category_id: id, attribute: attr }))
      );
    }
  }
}

export async function deleteCategory(c: Context<Env>, id: number) {
  const db = getDb(c.env);
  await db.delete(schema.category_attributes).where(eq(schema.category_attributes.category_id, id));
  await db.delete(schema.product_categories).where(eq(schema.product_categories.id, id));
}

export async function listCategories(
  c: Context<Env>,
  params: { page?: number; limit?: number; search?: string }
): Promise<(ProductCategorySelect & { attributes: string[] })[]> {
  const db = getDb(c.env);
  const { page = 1, limit = 10, search } = params;
  const baseQuery = db.select().from(schema.product_categories);
  const query = (
    search ? baseQuery.where(like(schema.product_categories.name, `%${search}%`)) : baseQuery
  )
    .limit(limit)
    .offset((page - 1) * limit);
  const categories = await query;
  // Fetch attributes for each
  for (const cat of categories) {
    const attrs = await db.query.category_attributes.findMany({
      where: eq(schema.category_attributes.category_id, cat.id),
    });
    (cat as any).attributes = attrs.map((a) => a.attribute);
  }
  return categories as (ProductCategorySelect & { attributes: string[] })[];
}

// Products
export async function createProduct(
  c: Context<Env>,
  product: Omit<ProductInsert, 'id' | 'created_at' | 'updated_at' | 'active' | 'average_rating' | 'total_ratings'> & {
    ratingDistribution?: Record<number, number>;
  }
) {
  const db = getDb(c.env);
  const now = new Date().toISOString();
  const [inserted] = await db
    .insert(schema.products)
    .values({
      ...product,
      active: true,  // Fixed: Use boolean
      average_rating: 0.0,
      total_ratings: 0,
      created_at: now,
      updated_at: now,
    })
    .returning({ id: schema.products.id });
  if (product.ratingDistribution) {
    await db.insert(schema.product_rating_distributions).values(
      Object.entries(product.ratingDistribution).map(([rating, count]) => ({
        product_id: inserted.id,
        rating: parseInt(rating),
        count,
      }))
    );
  }
  return inserted.id;
}

export async function getProduct(c: Context<Env>, id: number): Promise<ProductSelect | null> {
  const db = getDb(c.env);
  const product = await db.query.products.findFirst({
    where: eq(schema.products.id, id),
    with: {
      category: true,
      variants: {
        with: {
          color: true,
          images: true,
          sizePrices: true,
        },
      },
      ratingDist: true,
      defaultVariant: true,
    },
  });
  return product ?? null;
}

export async function updateProduct(
  c: Context<Env>,
  id: number,
  updates: Partial<ProductInsert> & { ratingDistribution?: Record<number, number> }
) {
  const db = getDb(c.env);
  const now = new Date().toISOString();
  await db
    .update(schema.products)
    .set({ ...updates, updated_at: now })
    .where(eq(schema.products.id, id));
  if (updates.ratingDistribution) {
    await db.delete(schema.product_rating_distributions).where(eq(schema.product_rating_distributions.product_id, id));
    await db.insert(schema.product_rating_distributions).values(
      Object.entries(updates.ratingDistribution).map(([rating, count]) => ({
        product_id: id,
        rating: parseInt(rating),
        count,
      }))
    );
  }
}

export async function deleteProduct(c: Context<Env>, id: number) {
  const db = getDb(c.env);
  await db.delete(schema.product_rating_distributions).where(eq(schema.product_rating_distributions.product_id, id));
  const variants = await db.query.product_variants.findMany({
    where: eq(schema.product_variants.product_id, id),
  });
  for (const v of variants) {
    await deleteVariant(c, v.id);
  }
  await db.delete(schema.products).where(eq(schema.products.id, id));
}

export async function listProducts(
  c: Context<Env>,
  params: { page?: number; limit?: number; search?: string; categoryId?: number }
): Promise<ProductSelect[]> {
  const db = getDb(c.env);
  const { page = 1, limit = 10, search, categoryId } = params;
  const products = await db.query.products.findMany({
    limit,
    offset: (page - 1) * limit,
    where: and(
      search ? like(schema.products.brand, `%${search}%`) : undefined,
      categoryId ? eq(schema.products.category_id, categoryId) : undefined
    ),
    // Optionally add 'with' for relations if needed in list (e.g., without for performance)
  });
  return products;
}

// Variants
export async function createVariant(
  c: Context<Env>,
  variant: Omit<ProductVariantInsert, 'id' | 'created_at' | 'updated_at' | 'active' | 'view_count' | 'sales_count'> & {
    images?: { url: string; public_id: string }[];
    size_prices?: Array<
      Omit<SizePriceInsert, 'id' | 'variant_id' | 'created_at' | 'updated_at' | 'discount_amount' | 'discounted_price' | 'total_price'>
    >;
    color: { name: string; hex_code?: string };
  }
) {
  const db = getDb(c.env);
  const now = new Date().toISOString();
  // Create color if new
  let colorId = variant.color_id;
  if (!colorId) {
    const [colorInserted] = await db
      .insert(schema.variant_colors)
      .values(variant.color)
      .returning({ id: schema.variant_colors.id });
    colorId = colorInserted.id;
  }
  const [inserted] = await db
    .insert(schema.product_variants)
    .values({
      ...variant,
      color_id: colorId,
      active: true,  // Fixed: Use boolean
      view_count: 0,
      sales_count: 0,
      created_at: now,
      updated_at: now,
    })
    .returning({ id: schema.product_variants.id });
  if (variant.images?.length) {
    await db.insert(schema.variant_images).values(
      variant.images.map((img) => ({
        variant_id: inserted.id,
        image_url: img.url,  // Fixed: Match column name
        public_id: img.public_id,
      }))
    );
  }
  if (variant.size_prices?.length) {
    for (const sp of variant.size_prices) {
      const discountPercent = sp.discount_percent ?? 0;  // Handle optional
      const discountAmount = Math.floor((sp.base_price * discountPercent) / 100);
      const discountedPrice = sp.base_price - discountAmount;
      await db.insert(schema.size_prices).values({
        variant_id: inserted.id,
        ...sp,
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        discounted_price: discountedPrice,
        total_price: discountedPrice,
        created_at: now,
        updated_at: now,
      });
    }
  }
  // If first variant, set as default in product
  const product = await db.query.products.findFirst({ where: eq(schema.products.id, variant.product_id) });
  if (product && !product.default_variant_id) {  // Fixed: Null check
    await db
      .update(schema.products)
      .set({ default_variant_id: inserted.id, updated_at: now })
      .where(eq(schema.products.id, variant.product_id));
  }
  return inserted.id;
}

export async function getVariant(c: Context<Env>, id: number): Promise<ProductVariantSelect | null> {
  const db = getDb(c.env);
  const variant = await db.query.product_variants.findFirst({
    where: eq(schema.product_variants.id, id),
    with: {
      product: true,
      color: true,
      images: true,
      sizePrices: true,
    },
  });
  return variant ?? null;
}

export async function updateVariant(
  c: Context<Env>,
  id: number,
  updates: Partial<ProductVariantInsert> & {
    images?: { url: string; public_id: string }[];
    size_prices?: Array<
      Omit<SizePriceInsert, 'id' | 'variant_id' | 'created_at' | 'updated_at' | 'discount_amount' | 'discounted_price' | 'total_price'>
    >;
    color?: { name: string; hex_code?: string };
    replaceImages?: boolean;
  }
) {
  const db = getDb(c.env);
  const now = new Date().toISOString();
  let colorId = updates.color_id;
  if (updates.color) {
    const [colorInserted] = await db
      .insert(schema.variant_colors)
      .values(updates.color)
      .returning({ id: schema.variant_colors.id });
    colorId = colorInserted.id;
  }
  await db
    .update(schema.product_variants)
    .set({ ...updates, color_id: colorId, updated_at: now })
    .where(eq(schema.product_variants.id, id));
  if (updates.replaceImages && updates.images) {
    // Delete old images
    const oldImages = await db.query.variant_images.findMany({
      where: eq(schema.variant_images.variant_id, id),
    });
    await deleteImages(c, oldImages.map((i) => i.public_id));
    await db.delete(schema.variant_images).where(eq(schema.variant_images.variant_id, id));
    // Add new
    if (updates.images.length) {
      await db.insert(schema.variant_images).values(
        updates.images.map((img) => ({
          variant_id: id,
          image_url: img.url,
          public_id: img.public_id,
        }))
      );
    }
  }
  if (updates.size_prices) {
    await db.delete(schema.size_prices).where(eq(schema.size_prices.variant_id, id));
    for (const sp of updates.size_prices) {
      const discountPercent = sp.discount_percent ?? 0;
      const discountAmount = Math.floor((sp.base_price * discountPercent) / 100);
      const discountedPrice = sp.base_price - discountAmount;
      await db.insert(schema.size_prices).values({
        variant_id: id,
        ...sp,
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        discounted_price: discountedPrice,
        total_price: discountedPrice,
        created_at: now,
        updated_at: now,
      });
    }
  }
}

export async function deleteVariant(c: Context<Env>, id: number) {
  const db = getDb(c.env);
  const images = await db.query.variant_images.findMany({
    where: eq(schema.variant_images.variant_id, id),
  });
  await deleteImages(c, images.map((i) => i.public_id));
  await db.delete(schema.size_prices).where(eq(schema.size_prices.variant_id, id));
  await db.delete(schema.variant_images).where(eq(schema.variant_images.variant_id, id));
  await db.delete(schema.product_variants).where(eq(schema.product_variants.id, id));
}