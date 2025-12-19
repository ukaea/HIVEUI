import { GenericDataService, type MetadataModel } from "$lib/services/GenericDataService";
import { EquipmentMetadata } from './EquipmentMetadata';

export class CombinationMetadata {
    combinationId: number;
    combinationName: string;
    equipment: EquipmentMetadata[];

    constructor() {
        this.combinationId = 0;
        this.combinationName = '';
        this.equipment = [];
    }

    static async fromJSON(json: any): Promise<CombinationMetadata> {
        const combination = new CombinationMetadata();
        combination.combinationId = json.combinationId || 0;
        combination.combinationName = json.combinationName || '';

        const equipmentService = new GenericDataService<EquipmentMetadata>({
            modelClass: EquipmentMetadata,
            endpoint: '/local/equipment',
            idField: 'equipmentName',
            displayName: 'equipment'
        });

        if (json.equipment && Array.isArray(json.equipment)) {
            const equipmentPromises = json.equipment.map(async (equipmentName: string) => {
                try {
                    const equipmentData = await equipmentService.fetchOne(equipmentName);
                    return EquipmentMetadata.fromJSON(equipmentData);
                } catch (error) {
                    console.error(`Failed to load equipment ${equipmentName}:`, error);
                    return null;
                }
            });

            const equipment = await Promise.all(equipmentPromises);
            combination.equipment = equipment.filter(eq => eq !== null) as EquipmentMetadata[];
        }

        return combination;
    }

    static toJSON(combination: CombinationMetadata): any {
        return {
            combinationId: combination.combinationId,
            combinationName: combination.combinationName,
            equipment: combination.equipment.map(eq => eq.equipmentName)
        };
    }
}

// Export the model class implementation for the GenericDataService
export const CombinationMetadataModel: MetadataModel<CombinationMetadata> = CombinationMetadata;