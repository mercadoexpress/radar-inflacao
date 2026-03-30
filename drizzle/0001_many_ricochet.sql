CREATE TABLE `alert_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertId` int NOT NULL,
	`productId` int NOT NULL,
	`state` varchar(4) NOT NULL,
	`variationPercent` decimal(8,2) NOT NULL,
	`priceFrom` decimal(10,2) NOT NULL,
	`priceTo` decimal(10,2) NOT NULL,
	`riskLevel` enum('baixo','moderado','alto') NOT NULL DEFAULT 'moderado',
	`triggeredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`thresholdPercent` decimal(5,2) NOT NULL,
	`direction` enum('up','down','both') NOT NULL DEFAULT 'up',
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `economic_indices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`indexName` varchar(32) NOT NULL,
	`region` varchar(32),
	`value` decimal(8,4) NOT NULL,
	`period` varchar(16) NOT NULL,
	`referenceDate` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `economic_indices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `external_price_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productName` varchar(128) NOT NULL,
	`currentPrice` decimal(10,2) NOT NULL,
	`variation` decimal(8,2),
	`source` varchar(64) NOT NULL,
	`collectedAt` date NOT NULL,
	`status` enum('pending','processed','error') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `external_price_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`state` enum('PR','SC','RS') NOT NULL,
	`source` varchar(64) NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`collectedAt` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`category` enum('proteinas','hortifruti','graos_secos','outros_insumos','suprimentos') NOT NULL,
	`unit` varchar(16) NOT NULL,
	`priority` int NOT NULL DEFAULT 0,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
