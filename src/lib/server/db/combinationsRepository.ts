import { eq } from 'drizzle-orm';
import { db } from './index';
import { combinations } from './schema';

type CombinationRow = {
    combinationId: string;
    combinationName: string;
    equipment: unknown[];
};

function rowToCombination(row: typeof combinations.$inferSelect): CombinationRow {
    return {
        combinationId: row.combinationId,
        combinationName: row.combinationName,
        equipment: (row.equipment as unknown[]) ?? [],
    };
}

export async function getAllCombinations(): Promise<CombinationRow[]> {
    const rows = await db.select().from(combinations);
    return rows.map(rowToCombination);
}

export async function getCombinationById(id: string): Promise<CombinationRow | null> {
    const [row] = await db.select().from(combinations)
        .where(eq(combinations.combinationId, id));
    return row ? rowToCombination(row) : null;
}

export async function upsertCombination(id: string, data: any): Promise<void> {
    const values = {
        combinationId: id,
        combinationName: data.combinationName ?? '',
        equipment: data.equipment ?? [],
    };

    await db.insert(combinations)
        .values(values)
        .onConflictDoUpdate({
            target: combinations.combinationId,
            set: {
                combinationName: values.combinationName,
                equipment: values.equipment,
            },
        });
}

export async function deleteCombination(id: string): Promise<void> {
    await db.delete(combinations).where(eq(combinations.combinationId, id));
}
