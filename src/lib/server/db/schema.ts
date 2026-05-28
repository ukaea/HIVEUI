import { pgTable, text } from 'drizzle-orm/pg-core';

export const configurations = pgTable('configurations', {
    configurationId: text('configuration_id').primaryKey(),
    configurationName: text('configuration_name').notNull().default(''),
    configurationDescription: text('configuration_description').notNull().default(''),
});

export const combinations = pgTable('combinations', {
    combinationId: text('combination_id').primaryKey(),
    combinationName: text('combination_name').notNull().default(''),
    configurationId: text('configuration_id')
        .notNull()
        .references(() => configurations.configurationId, { onDelete: 'cascade' }),
    equipmentIds: text('equipment_ids').array().notNull(),
});
