import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

// Users
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

// Products
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  price: integer('price').notNull(),
  stock: integer('stock').default(0),
  image_url: text('image_url'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Orders
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

// Refresh Tokens
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

// Optional: Relations (for type-safe joins if needed later)
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  refreshTokens: many(refresh_tokens),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.user_id], references: [users.id] }),
  items: many(order_items),
}));

export const productsRelations = relations(products, ({ many }) => ({
  orderItems: many(order_items),
}));

export const orderItemsRelations = relations(order_items, ({ one }) => ({
  order: one(orders, { fields: [order_items.order_id], references: [orders.id] }),
  product: one(products, { fields: [order_items.product_id], references: [products.id] }),
}));

export const refreshTokensRelations = relations(refresh_tokens, ({ one }) => ({
  user: one(users, { fields: [refresh_tokens.user_id], references: [users.id] }),
}));