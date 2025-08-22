import { EquipmentMetadata } from './EquipmentMetadata';
import { getJsonContent } from "$lib/jsonUtils";

export class CombinationMetadata {
    combinationUUID: string;
    combinationName: string;
    equipment: EquipmentMetadata[];

    constructor() {
        this.combinationUUID = '';
        this.combinationName = '';
        this.equipment = [];
    }

    static async fromJSON(json: any): Promise<CombinationMetadata> {
        const combination = new CombinationMetadata();
        combination.combinationUUID = json.combinationUUID || '';
        combination.combinationName = json.combinationName || '';

        if (json.equipment && Array.isArray(json.equipment)) {
            const equipmentPromises = json.equipment.map(async (equipmentUUID: string) => {
                try {
                    const equipmentData = await getJsonContent(`equipment/${equipmentUUID}.json`);
                    return EquipmentMetadata.fromJSON(equipmentData);
                } catch (error) {
                    console.error(`Failed to load equipment ${equipmentUUID}:`, error);
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
            combinationUUID: combination.combinationUUID,
            combinationName: combination.combinationName,
            equipment: combination.equipment.map(eq => eq.equipmentUUID)
        };
    }
}