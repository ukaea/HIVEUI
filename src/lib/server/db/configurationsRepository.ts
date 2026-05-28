import { eq } from 'drizzle-orm';
import { db } from './index';
import { combinations, configurations } from './schema';

type ConfigurationRow = {
    configurationId: string;
    configurationName: string;
    configurationDescription: string;
    equipmentCombinations: { combinationId: string; combinationName: string; equipmentIds: string[] }[];
};

async function buildConfiguration(configId: string): Promise<ConfigurationRow | null> {
    const [config] = await db.select().from(configurations)
        .where(eq(configurations.configurationId, configId));
    if (!config) return null;

    const combos = await db.select().from(combinations)
        .where(eq(combinations.configurationId, configId));

    return {
        configurationId: config.configurationId,
        configurationName: config.configurationName,
        configurationDescription: config.configurationDescription,
        equipmentCombinations: combos.map((c) => ({
            combinationId: c.combinationId,
            combinationName: c.combinationName,
            equipmentIds: c.equipmentIds,
        })),
    };
}

export async function getAllConfigurations(): Promise<ConfigurationRow[]> {
    const configs = await db.select().from(configurations);
    return Promise.all(configs.map((c) => buildConfiguration(c.configurationId) as Promise<ConfigurationRow>));
}

export async function getConfigurationById(id: string): Promise<ConfigurationRow | null> {
    return buildConfiguration(id);
}

export async function upsertConfiguration(id: string, data: any): Promise<void> {
    await db.transaction(async (tx) => {
        await tx.insert(configurations)
            .values({
                configurationId: id,
                configurationName: data.configurationName ?? '',
                configurationDescription: data.configurationDescription ?? '',
            })
            .onConflictDoUpdate({
                target: configurations.configurationId,
                set: {
                    configurationName: data.configurationName ?? '',
                    configurationDescription: data.configurationDescription ?? '',
                },
            });

        // Replace combinations: delete existing then re-insert
        await tx.delete(combinations).where(eq(combinations.configurationId, id));

        const combos: (typeof combinations.$inferInsert)[] = (data.equipmentCombinations ?? []).map((combo: any) => ({
            combinationId: combo.combinationId,
            combinationName: combo.combinationName ?? '',
            configurationId: id,
            equipmentIds: (combo.equipment ?? []).map((eq: any) => eq.equipmentName ?? eq.equipmentId ?? ''),
        }));

        if (combos.length > 0) {
            await tx.insert(combinations).values(combos);
        }
    });
}

export async function deleteConfiguration(id: string): Promise<void> {
    await db.delete(configurations).where(eq(configurations.configurationId, id));
}
