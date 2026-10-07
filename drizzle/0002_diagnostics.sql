ALTER TABLE "combinations" RENAME TO "diagnostics";--> statement-breakpoint
ALTER TABLE "diagnostics" RENAME COLUMN "combination_name" TO "diagnostic_name";--> statement-breakpoint
ALTER TABLE "diagnostics" ADD COLUMN "diagnostic_number" integer;--> statement-breakpoint
UPDATE "diagnostics" SET "diagnostic_number" = "combination_id"::integer WHERE "combination_id" ~ '^[1-9][0-9]{0,8}$';--> statement-breakpoint
WITH "base" AS (
	SELECT COALESCE(MAX("diagnostic_number"), 0) AS "max_number" FROM "diagnostics"
), "unnumbered" AS (
	SELECT "combination_id", ROW_NUMBER() OVER (ORDER BY "combination_id") AS "rn"
	FROM "diagnostics" WHERE "diagnostic_number" IS NULL
)
UPDATE "diagnostics" AS "d"
SET "diagnostic_number" = "base"."max_number" + "unnumbered"."rn"
FROM "base", "unnumbered"
WHERE "d"."combination_id" = "unnumbered"."combination_id";--> statement-breakpoint
ALTER TABLE "configurations" RENAME COLUMN "equipment_combinations" TO "diagnostics";--> statement-breakpoint
UPDATE "configurations" AS "cfg"
SET "diagnostics" = (
	SELECT COALESCE(
		jsonb_agg(
			("e"."elem" - 'combinationId' - 'combinationName')
				|| jsonb_build_object('diagnosticNumber', "d"."diagnostic_number", 'diagnosticName', COALESCE("e"."elem"->>'combinationName', ''))
			ORDER BY "e"."ord"
		),
		'[]'::jsonb
	)
	FROM jsonb_array_elements("cfg"."diagnostics") WITH ORDINALITY AS "e"("elem", "ord")
	LEFT JOIN "diagnostics" AS "d" ON "d"."combination_id" = "e"."elem"->>'combinationId'
);--> statement-breakpoint
ALTER TABLE "diagnostics" DROP COLUMN "combination_id";--> statement-breakpoint
ALTER TABLE "diagnostics" ALTER COLUMN "diagnostic_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "diagnostics" ADD PRIMARY KEY ("diagnostic_number");
