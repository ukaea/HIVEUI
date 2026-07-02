import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core';

export const configurations = pgTable('configurations', {
    configurationId: text('configuration_id').primaryKey(),
    configurationName: text('configuration_name').notNull().default(''),
    configurationDescription: text('configuration_description').notNull().default(''),
    // Full combination objects (each with nested equipment) stored denormalized.
    equipmentCombinations: jsonb('equipment_combinations').notNull().default(sql`'[]'::jsonb`),
});

export const combinations = pgTable('combinations', {
    combinationId: text('combination_id').primaryKey(),
    combinationName: text('combination_name').notNull().default(''),
    // Standalone, reusable combination: full equipment objects stored denormalized.
    equipment: jsonb('equipment').notNull().default(sql`'[]'::jsonb`),
});
