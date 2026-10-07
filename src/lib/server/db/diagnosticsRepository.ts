import { eq } from 'drizzle-orm';
import { db } from './index';
import { diagnostics } from './schema';

type DiagnosticRow = {
    diagnosticNumber: number;
    diagnosticName: string;
    port: string;
    equipment: unknown[];
};

function rowToDiagnostic(row: typeof diagnostics.$inferSelect): DiagnosticRow {
    return {
        diagnosticNumber: row.diagnosticNumber,
        diagnosticName: row.diagnosticName,
        port: row.port ?? '',
        equipment: (row.equipment as unknown[]) ?? [],
    };
}

export async function getAllDiagnostics(): Promise<DiagnosticRow[]> {
    const rows = await db.select().from(diagnostics);
    return rows.map(rowToDiagnostic);
}

export async function getDiagnosticById(id: string): Promise<DiagnosticRow | null> {
    const [row] = await db.select().from(diagnostics)
        .where(eq(diagnostics.diagnosticNumber, Number(id)));
    return row ? rowToDiagnostic(row) : null;
}

export async function upsertDiagnostic(id: string, data: any): Promise<void> {
    const values = {
        diagnosticNumber: Number(id),
        diagnosticName: data.diagnosticName ?? '',
        port: data.port ?? '',
        equipment: data.equipment ?? [],
    };

    await db.insert(diagnostics)
        .values(values)
        .onConflictDoUpdate({
            target: diagnostics.diagnosticNumber,
            set: {
                diagnosticName: values.diagnosticName,
                port: values.port,
                equipment: values.equipment,
            },
        });
}

export async function deleteDiagnostic(id: string): Promise<void> {
    await db.delete(diagnostics).where(eq(diagnostics.diagnosticNumber, Number(id)));
}
