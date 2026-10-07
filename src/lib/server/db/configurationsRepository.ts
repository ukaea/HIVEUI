import { eq } from 'drizzle-orm';
import { db } from './index';
import { configurations } from './schema';

type ConfigurationRow = {
    configurationId: string;
    configurationName: string;
    configurationDescription: string;
    diagnostics: unknown[];
};

function rowToConfiguration(row: typeof configurations.$inferSelect): ConfigurationRow {
    return {
        configurationId: row.configurationId,
        configurationName: row.configurationName,
        configurationDescription: row.configurationDescription,
        diagnostics: (row.diagnostics as unknown[]) ?? [],
    };
}

export async function getAllConfigurations(): Promise<ConfigurationRow[]> {
    const rows = await db.select().from(configurations);
    return rows.map(rowToConfiguration);
}

export async function getConfigurationById(id: string): Promise<ConfigurationRow | null> {
    const [row] = await db.select().from(configurations)
        .where(eq(configurations.configurationId, id));
    return row ? rowToConfiguration(row) : null;
}

export async function upsertConfiguration(id: string, data: any): Promise<void> {
    const values = {
        configurationId: id,
        configurationName: data.configurationName ?? '',
        configurationDescription: data.configurationDescription ?? '',
        diagnostics: data.diagnostics ?? [],
    };

    await db.insert(configurations)
        .values(values)
        .onConflictDoUpdate({
            target: configurations.configurationId,
            set: {
                configurationName: values.configurationName,
                configurationDescription: values.configurationDescription,
                diagnostics: values.diagnostics,
            },
        });
}

export async function deleteConfiguration(id: string): Promise<void> {
    await db.delete(configurations).where(eq(configurations.configurationId, id));
}
