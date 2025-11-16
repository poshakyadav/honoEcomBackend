import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth from './routes/auth';
import { authMiddleware, adminMiddleware } from './middleware';
import { Env } from './types';
import products from './routes/products';
import shipping from './routes/shipping';
import addresses from './routes/addresses';
import cart from './routes/cart';

const app = new Hono<Env>();

// Global Middleware
app.use('*', cors({ origin: '*', credentials: true }));  // Adjust origin for prod

// Routes
app.route('/auth', auth);
app.route('/products', products);
app.route('/shipping', shipping);
app.route('/addresses', addresses);
app.route('/cart', cart);

// Test Protected Route
app.get('/protected', authMiddleware, (c) => {
  const user = c.get('user');
  return c.json({ message: 'Protected', user });
});

app.get('/admin', authMiddleware, adminMiddleware, (c) => {
  return c.json({ message: 'Admin only' });
});

export default app;