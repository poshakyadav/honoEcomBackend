CREATE TABLE `addresses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`line1` text NOT NULL,
	`line2` text,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`pincode` text NOT NULL,
	`country` text DEFAULT 'India',
	`phone` text NOT NULL,
	`is_default` integer DEFAULT false,
	`is_serviceable` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`size_price_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`size_price_id`) REFERENCES `size_prices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pickup_addresses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admin_id` integer NOT NULL,
	`line1` text NOT NULL,
	`line2` text,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`pincode` text NOT NULL,
	`country` text DEFAULT 'India',
	`phone` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`shiprocket_shipment_id` text NOT NULL,
	`awb_code` text NOT NULL,
	`courier_name` text NOT NULL,
	`courier_partner_id` integer,
	`pickup_eta` text,
	`delivery_eta` text,
	`status` text NOT NULL,
	`tracking_url` text,
	`label_url` text,
	`sub_status` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shipments_shiprocket_shipment_id_unique` ON `shipments` (`shiprocket_shipment_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_size_prices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`variant_id` integer NOT NULL,
	`size` text NOT NULL,
	`base_price` integer NOT NULL,
	`discount_percent` integer DEFAULT 0,
	`discount_amount` integer DEFAULT 0,
	`discounted_price` integer DEFAULT 0,
	`total_price` integer DEFAULT 0,
	`stock` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_size_prices`("id", "variant_id", "size", "base_price", "discount_percent", "discount_amount", "discounted_price", "total_price", "stock", "is_default", "created_at", "updated_at") SELECT "id", "variant_id", "size", "base_price", "discount_percent", "discount_amount", "discounted_price", "total_price", "stock", "is_default", "created_at", "updated_at" FROM `size_prices`;--> statement-breakpoint
DROP TABLE `size_prices`;--> statement-breakpoint
ALTER TABLE `__new_size_prices` RENAME TO `size_prices`;--> statement-breakpoint
PRAGMA foreign_keys=ON;