CREATE TABLE `category_attributes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`attribute` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `product_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`active` integer DEFAULT true,
	`image_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_categories_name_unique` ON `product_categories` (`name`);--> statement-breakpoint
CREATE TABLE `product_rating_distributions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`count` integer DEFAULT 0,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sku` text NOT NULL,
	`hsn_code` text,
	`active` integer DEFAULT true,
	`color_id` integer NOT NULL,
	`length` real NOT NULL,
	`breadth` real NOT NULL,
	`height` real NOT NULL,
	`weight` real NOT NULL,
	`is_new_arrival` integer DEFAULT false,
	`is_trendy` integer DEFAULT false,
	`is_recommended` integer DEFAULT false,
	`view_count` integer DEFAULT 0,
	`sales_count` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`color_id`) REFERENCES `variant_colors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_sku_unique` ON `product_variants` (`sku`);--> statement-breakpoint
CREATE TABLE `size_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`variant_id` integer NOT NULL,
	`size` text NOT NULL,
	`base_price` integer NOT NULL,
	`discount_percent` integer DEFAULT 0,
	`discount_amount` integer DEFAULT 0,
	`discounted_price` integer DEFAULT 0,
	`total_price` integer DEFAULT 0,
	`stock` integer DEFAULT 0,
	`is_default` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `variant_colors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`hex_code` text
);
--> statement-breakpoint
CREATE TABLE `variant_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`variant_id` integer NOT NULL,
	`image_url` text NOT NULL,
	`public_id` text NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `products` ADD `brand` text NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `category_id` integer NOT NULL REFERENCES product_categories(id);--> statement-breakpoint
ALTER TABLE `products` ADD `default_variant_id` integer REFERENCES product_variants(id);--> statement-breakpoint
ALTER TABLE `products` ADD `active` integer DEFAULT true;--> statement-breakpoint
ALTER TABLE `products` ADD `average_rating` real DEFAULT 0;--> statement-breakpoint
ALTER TABLE `products` ADD `total_ratings` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `products` ADD `updated_at` text DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `name`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `description`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `price`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `stock`;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `image_url`;