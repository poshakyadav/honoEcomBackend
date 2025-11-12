import { defineConfig } from 'drizzle-kit';

const isLocal = !!process.env.LOCAL_DB_PATH;

const config = isLocal
  ? defineConfig({
      schema: './src/db/schema.ts',
      out: './migrations',
      dialect: 'sqlite',
      dbCredentials: {
        url: process.env.LOCAL_DB_PATH!,
      },
    })
  : defineConfig({
      schema: './src/db/schema.ts',
      out: './migrations',
      dialect: 'sqlite',
      driver: 'd1-http',
      dbCredentials: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
        databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
        token: process.env.CLOUDFLARE_D1_TOKEN!,
      },
    });

export default config;