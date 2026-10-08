ALTER TABLE "configurations" ADD COLUMN "configuration_number" integer;--> statement-breakpoint
UPDATE "configurations" SET "configuration_number" = "configuration_id"::integer WHERE "configuration_id" ~ '^[1-9][0-9]{0,8}$';--> statement-breakpoint
WITH "base" AS (
	SELECT COALESCE(MAX("configuration_number"), 0) AS "max_number" FROM "configurations"
), "unnumbered" AS (
	SELECT "configuration_id", ROW_NUMBER() OVER (ORDER BY "configuration_id") AS "rn"
	FROM "configurations" WHERE "configuration_number" IS NULL
)
UPDATE "configurations" AS "c"
SET "configuration_number" = "base"."max_number" + "unnumbered"."rn"
FROM "base", "unnumbered"
WHERE "c"."configuration_id" = "unnumbered"."configuration_id";--> statement-breakpoint
ALTER TABLE "configurations" DROP COLUMN "configuration_id";--> statement-breakpoint
ALTER TABLE "configurations" ALTER COLUMN "configuration_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "configurations" ADD PRIMARY KEY ("configuration_number");--> statement-breakpoint
ALTER TABLE "diagnostics" DROP COLUMN "port";
