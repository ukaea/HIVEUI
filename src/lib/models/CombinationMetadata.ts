import type { MetadataModel } from "$lib/services/GenericDataService";
import { EquipmentMetadata } from './EquipmentMetadata';

export class CombinationMetadata {
    combinationId: string;
    combinationName: string;
    equipment: EquipmentMetadata[];

    constructor() {
        this.combinationId = '';
        this.combinationName = '';
        this.equipment = [];
    }

    static fromJSON(json: any): CombinationMetadata {
        const combination = new CombinationMetadata();
        combination.combinationId = json.combinationId ?? '';
        combination.combinationName = json.combinationName ?? '';

        // Parse nested equipment - stored as full objects in JSONB
        if (json.equipment && Array.isArray(json.equipment)) {
            combination.equipment = json.equipment.map(
                (eq: any) => EquipmentMetadata.fromJSON(eq)
            );
        }

        return combination;
    }

    static toJSON(combination: CombinationMetadata): any {
        return {
            combinationId: combination.combinationId,
            combinationName: combination.combinationName,
            // Store full equipment objects for denormalized DB storage
            equipment: combination.equipment.map(
                (eq) => EquipmentMetadata.toJSON(eq)
            )
        };
    }
}

// Export the model class implementation for the GenericDataService
export const CombinationMetadataModel: MetadataModel<CombinationMetadata> = CombinationMetadata;