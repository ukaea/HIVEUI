import type { MetadataModel } from '$lib/services/GenericDataService';
import {
    CameraMetadata,
    DicMetadata,
    FlowmeterMetadata,
    IrCameraMetadata, LensMetadata,
    PyrometerMetadata,
    ThermocoupleMetadata
} from '.';


type Equipment = DicMetadata | ThermocoupleMetadata | CameraMetadata |
                    FlowmeterMetadata | PyrometerMetadata | IrCameraMetadata | LensMetadata;


export class EquipmentMetadata {
	equipmentName: string;
    equipmentType: string;
    equipment: Equipment | null

	constructor() {
		this.equipmentName = '';
        this.equipmentType = ''
        this.equipment = null;
	}

    static fromJSON(json: any): EquipmentMetadata {
        const equipment = new EquipmentMetadata();
        equipment.equipmentName = json.equipmentName || '';
        equipment.equipmentType = json.equipmentType || '';
        switch (json.equipmentType) {
            case "thermocouple":
                equipment.equipment = ThermocoupleMetadata.fromJSON(json);
                break;
            case "camera":
                equipment.equipment = CameraMetadata.fromJSON(json);
                break;
            case "lens":
                equipment.equipment = LensMetadata.fromJSON(json);
                break;
            case "dic":
                equipment.equipment = DicMetadata.fromJSON(json);
                break;
            case "flowmeter":
                equipment.equipment = FlowmeterMetadata.fromJSON(json);
                break;
            case "pyrometer":
                equipment.equipment = PyrometerMetadata.fromJSON(json);
                break;
            case "ir-camera":
                equipment.equipment = IrCameraMetadata.fromJSON(json);
                break;
            default:
                equipment.equipment = null;
        }
        return equipment;
    }

    static toJSON(equipment: EquipmentMetadata): any {
        return {
            equipmentName: equipment.equipmentName,
            equipmentType: equipment.equipmentType,
            equipment: equipment.equipment
        };
    }
}

// Export the model class implementation for the GenericDataService
export const EquipmentMetadataModel: MetadataModel<EquipmentMetadata> = EquipmentMetadata;