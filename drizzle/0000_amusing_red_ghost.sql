CREATE TABLE "combinations" (
	"combination_id" text PRIMARY KEY NOT NULL,
	"combination_name" text DEFAULT '' NOT NULL,
	"equipment" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configurations" (
	"configuration_id" text PRIMARY KEY NOT NULL,
	"configuration_name" text DEFAULT '' NOT NULL,
	"configuration_description" text DEFAULT '' NOT NULL,
	"equipment_combinations" jsonb DEFAULT '[]'::jsonb NOT NULL
);
