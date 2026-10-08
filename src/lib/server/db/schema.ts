import { sql } from 'drizzle-orm';
import { integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

export const configurations = pgTable('configurations', {
    configurationNumber: integer('configuration_number').primaryKey(),
    configurationName: text('configuration_name').notNull().default(''),
    configurationDescription: text('configuration_description').notNull().default(''),
    // Full diagnostic objects (each with nested equipment and its port) stored denormalized.
    diagnostics: jsonb('diagnostics').notNull().default(sql`'[]'::jsonb`),
});

export const diagnostics = pgTable('diagnostics', {
    diagnosticNumber: integer('diagnostic_number').primaryKey(),
    diagnosticName: text('diagnostic_name').notNull().default(''),
    // Standalone, reusable diagnostic: full equipment objects stored denormalized.
    equipment: jsonb('equipment').notNull().default(sql`'[]'::jsonb`),
});
