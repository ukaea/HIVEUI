import type { MetadataModel } from "$lib/services/GenericDataService";
import { EquipmentMetadata } from './EquipmentMetadata';
import Zod from 'zod';

export class DiagnosticMetadata {
    diagnosticNumber: number | null;
    diagnosticName: string;
    equipment: EquipmentMetadata[];

    static schema = Zod.object({
        diagnosticNumber: Zod.number({ error: 'Diagnostic Number is required' })
            .int('Diagnostic Number must be a whole number')
            .min(1, 'Diagnostic Number must be greater than 0'),
        diagnosticName: Zod.string({ error: 'Diagnostic Name is required' }).trim().min(1, 'Diagnostic Name is required'),
        equipment: Zod.array(Zod.any()).min(1, 'At least one equipment is required')
    });

    constructor() {
        this.diagnosticNumber = null;
        this.diagnosticName = '';
        this.equipment = [];
    }

    static fromJSON(json: any): DiagnosticMetadata {
        const diagnostic = new DiagnosticMetadata();
        diagnostic.diagnosticNumber = Number(json.diagnosticNumber) || null;
        diagnostic.diagnosticName = json.diagnosticName ?? '';

        // Parse nested equipment - stored as full objects in JSONB
        if (json.equipment && Array.isArray(json.equipment)) {
            diagnostic.equipment = json.equipment.map(
                (eq: any) => EquipmentMetadata.fromJSON(eq)
            );
        }

        return diagnostic;
    }

    static toJSON(diagnostic: DiagnosticMetadata): any {
        return {
            diagnosticNumber: diagnostic.diagnosticNumber,
            diagnosticName: diagnostic.diagnosticName,
            // Store full equipment objects for denormalized DB storage
            equipment: diagnostic.equipment.map(
                (eq) => EquipmentMetadata.toJSON(eq)
            )
        };
    }
}

// Export the model class implementation for the GenericDataService
export const DiagnosticMetadataModel: MetadataModel<DiagnosticMetadata> = DiagnosticMetadata;