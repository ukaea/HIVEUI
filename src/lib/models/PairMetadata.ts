import { EquipmentMetadata } from './EquipmentMetadata';
import { getJsonContent } from "$lib/jsonUtils";

export class PairMetadata {
    pairUUID: string;
    pairName: string;
    equipment: EquipmentMetadata[];

    constructor() {
        this.pairUUID = '';
        this.pairName = '';
        this.equipment = [];
    }

    static async fromJSON(json: any): Promise<PairMetadata> {
        const pair = new PairMetadata();
        pair.pairUUID = json.pairUUID || '';
        pair.pairName = json.pairName || '';
        
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
            pair.equipment = equipment.filter(eq => eq !== null) as EquipmentMetadata[];
        }
        
        return pair;
    }

    static toJSON(pair: PairMetadata): any {
        return {
            pairUUID: pair.pairUUID,
            pairName: pair.pairName,
            equipment: pair.equipment.map(eq => eq.equipmentUUID)
        };
    }
}