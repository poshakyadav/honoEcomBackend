import { sqliteTable, integer, text, index, real } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';  // Added for types

// ------------------------------------------------------------------
// Users Schema
// ------------------------------------------------------------------
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').unique().notNull(),
  password_hash: text('password_hash').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  address: text('address'),
  role: text('role').default('user').$type<'user' | 'admin'>(),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// ------------------------------------------------------------------
//  Products related schema's
// ------------------------------------------------------------------
export const product_categories = sqliteTable('product_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  description: text('description'),
  active: integer('active', { mode: 'boolean' }).default(true),
  image_url: text('image_url'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Category Attributes (element collection)
export const category_attributes = sqliteTable('category_attributes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  category_id: integer('category_id').notNull().references(() => product_categories.id),
  attribute: text('attribute').notNull(),
});

// Products
// @ts-ignore  // Ignore circular reference
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  brand: text('brand').notNull(),
  category_id: integer('category_id').notNull().references(() => product_categories.id),
  // @ts-ignore  // Ignore circular reference
  default_variant_id: integer('default_variant_id').references(() => product_variants.id),
  active: integer('active', { mode: 'boolean' }).default(true),
  average_rating: real('average_rating').default(0.0),
  total_ratings: integer('total_ratings').default(0),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Product Rating Distribution
export const product_rating_distributions = sqliteTable('product_rating_distributions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  product_id: integer('product_id').notNull().references(() => products.id),
  rating: integer('rating').notNull(),  // 1-5
  count: integer('count').default(0),
});

// Variant Colors
export const variant_colors = sqliteTable('variant_colors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  hex_code: text('hex_code'),
});

// Product Variants
// @ts-ignore  // Ignore circular reference
export const product_variants = sqliteTable('product_variants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // @ts-ignore  // Ignore circular reference
  product_id: integer('product_id').notNull().references(() => products.id),
  name: text('name').notNull(),
  description: text('description'),
  sku: text('sku').notNull().unique(),
  hsn_code: text('hsn_code'),
  active: integer('active', { mode: 'boolean' }).default(true),
  color_id: integer('color_id').notNull().references(() => variant_colors.id),
  length: real('length').notNull(),
  breadth: real('breadth').notNull(),
  height: real('height').notNull(),
  weight: real('weight').notNull(),
  is_new_arrival: integer('is_new_arrival', { mode: 'boolean' }).default(false),
  is_trendy: integer('is_trendy', { mode: 'boolean' }).default(false),
  is_recommended: integer('is_recommended', { mode: 'boolean' }).default(false),
  view_count: integer('view_count').default(0),
  sales_count: integer('sales_count').default(0),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// Variant Images (url and public_id)
export const variant_images = sqliteTable('variant_images', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  variant_id: integer('variant_id').notNull().references(() => product_variants.id),
  image_url: text('image_url').notNull(),
  public_id: text('public_id').notNull(),
});

// Size Prices
export const size_prices = sqliteTable('size_prices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  variant_id: integer('variant_id').notNull().references(() => product_variants.id),
  size: text('size').notNull(),
  base_price: integer('base_price').notNull(),
  discount_percent: integer('discount_percent').default(0),  // 0-100
  discount_amount: integer('discount_amount').default(0),
  discounted_price: integer('discounted_price').default(0),
  total_price: integer('total_price').default(0),
  stock: integer('stock').default(0),
  is_default: integer('is_default', { mode: 'boolean' }).default(false),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// ------------------------------------------------------------------
//  Orders related schema's
// ------------------------------------------------------------------
export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id),
  total: integer('total').notNull(),
  status: text('status').default('pending').$type<'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'>(),
  razorpay_order_id: text('razorpay_order_id'),
  razorpay_payment_id: text('razorpay_payment_id'),
  shiprocket_shipment_id: text('shiprocket_shipment_id'),
  tracking_url: text('tracking_url'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Order Items
export const order_items = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  order_id: integer('order_id').notNull().references(() => orders.id),
  product_id: integer('product_id').notNull().references(() => products.id),
  quantity: integer('quantity').notNull(),
  price: integer('price').notNull(),
});

// ------------------------------------------------------------------
//  Refresh Tokens Schema
// ------------------------------------------------------------------
export const refresh_tokens = sqliteTable('refresh_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id),
  token_hash: text('token_hash').notNull(),
  expires_at: text('expires_at').notNull(),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Indexes (for speed)
export const idx_orders_user = index('idx_orders_user').on(orders.user_id);
export const idx_order_items_order = index('idx_order_items_order').on(order_items.order_id);
export const idx_refresh_user = index('idx_refresh_user').on(refresh_tokens.user_id);

// Product related Indexes
export const idx_products_category = index('idx_products_category').on(products.category_id);
export const idx_variants_product = index('idx_variants_product').on(product_variants.product_id);
export const idx_size_prices_variant = index('idx_size_prices_variant').on(size_prices.variant_id);
export const idx_category_attributes = index('idx_category_attributes').on(category_attributes.category_id);
export const idx_rating_dist = index('idx_rating_dist').on(product_rating_distributions.product_id);
export const idx_variant_images = index('idx_variant_images').on(variant_images.variant_id);

// Optional: Relations (for type-safe joins if needed later)
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  refreshTokens: many(refresh_tokens),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.user_id], references: [users.id] }),
  items: many(order_items),
}));

export const orderItemsRelations = relations(order_items, ({ one }) => ({
  order: one(orders, { fields: [order_items.order_id], references: [orders.id] }),
  product: one(products, { fields: [order_items.product_id], references: [products.id] }),
}));

export const refreshTokensRelations = relations(refresh_tokens, ({ one }) => ({
  user: one(users, { fields: [refresh_tokens.user_id], references: [users.id] }),
}));

// Product related relations
export const productCategoriesRelations = relations(product_categories, ({ many }) => ({
  attributes: many(category_attributes),
  products: many(products),
}));

export const categoryAttributesRelations = relations(category_attributes, ({ one }) => ({
  category: one(product_categories, { fields: [category_attributes.category_id], references: [product_categories.id] }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(product_categories, { fields: [products.category_id], references: [product_categories.id] }),
  variants: many(product_variants),
  ratingDist: many(product_rating_distributions),
  defaultVariant: one(product_variants, { fields: [products.default_variant_id], references: [product_variants.id] }),
}));

export const productRatingDistRelations = relations(product_rating_distributions, ({ one }) => ({
  product: one(products, { fields: [product_rating_distributions.product_id], references: [products.id] }),
}));

export const productVariantsRelations = relations(product_variants, ({ one, many }) => ({
  product: one(products, { fields: [product_variants.product_id], references: [products.id] }),
  color: one(variant_colors, { fields: [product_variants.color_id], references: [variant_colors.id] }),
  images: many(variant_images),
  sizePrices: many(size_prices),
}));

export const variantColorsRelations = relations(variant_colors, ({ many }) => ({
  variants: many(product_variants),
}));

export const variantImagesRelations = relations(variant_images, ({ one }) => ({
  variant: one(product_variants, { fields: [variant_images.variant_id], references: [product_variants.id] }),
}));

export const sizePricesRelations = relations(size_prices, ({ one }) => ({
  variant: one(product_variants, { fields: [size_prices.variant_id], references: [product_variants.id] }),
}));

// Exported Inferred Types (for insert/select in other files)
export type ProductCategoryInsert = InferInsertModel<typeof product_categories>;
export type ProductCategorySelect = InferSelectModel<typeof product_categories>;

export type ProductInsert = InferInsertModel<typeof products>;
export type ProductSelect = InferSelectModel<typeof products>;

export type ProductVariantInsert = InferInsertModel<typeof product_variants>;
export type ProductVariantSelect = InferSelectModel<typeof product_variants>;

export type SizePriceInsert = InferInsertModel<typeof size_prices>;
export type SizePriceSelect = InferSelectModel<typeof size_prices>;

// Add more as needed (e.g., for ratings, colors)