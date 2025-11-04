-- Users (id auto, email unique)
DROP TABLE IF EXISTS users;
CREATE TABLE
    users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

-- Products
DROP TABLE IF EXISTS products;
CREATE TABLE
    products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price INTEGER NOT NULL, -- Paisa (e.g., 49900 = ₹499)
        stock INTEGER DEFAULT 0,
        image_url TEXT, -- Cloudinary URL
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

-- Orders
DROP TABLE IF EXISTS orders;
CREATE TABLE
    orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        total INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (
            status IN (
                'pending',
                'paid',
                'shipped',
                'delivered',
                'cancelled'
            )
        ),
        razorpay_order_id TEXT,
        razorpay_payment_id TEXT,
        shiprocket_shipment_id TEXT,
        tracking_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    );

-- Order Items
DROP TABLE IF EXISTS order_items;
CREATE TABLE
    order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price INTEGER NOT NULL, -- Price at purchase time
        FOREIGN KEY (order_id) REFERENCES orders (id),
        FOREIGN KEY (product_id) REFERENCES products (id)
    );

-- Refresh Tokens (hashed, for revocation/rotation)
DROP TABLE IF EXISTS refresh_tokens;
CREATE TABLE refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,  -- SHA-256 hash of refresh token
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for speed
CREATE INDEX idx_orders_user ON orders (user_id);

CREATE INDEX idx_order_items_order ON order_items (order_id);

CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);