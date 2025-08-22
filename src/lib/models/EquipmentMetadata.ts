export class EquipmentMetadata {
	equipmentUUID: string;
	equipmentName: string;

	constructor() {
		this.equipmentUUID = '';
		this.equipmentName = '';
	}

    static fromJSON(json: any): EquipmentMetadata {
        const equipment = new EquipmentMetadata();
        equipment.equipmentUUID = json.equipmentUUID || '';
        equipment.equipmentName = json.equipmentName || '';
        return equipment;
    }

    static toJSON(equipment: EquipmentMetadata): any {
        return {
            equipmentUUID: equipment.equipmentUUID,
            equipmentName: equipment.equipmentName
        };
    }
}
