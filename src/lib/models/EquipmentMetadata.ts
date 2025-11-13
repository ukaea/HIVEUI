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
    equipmentConfig: Equipment | null

	constructor() {
		this.equipmentName = '';
        this.equipmentType = ''
        this.equipmentConfig = null;
	}

    static fromJSON(json: any): EquipmentMetadata {
        const equipment = new EquipmentMetadata();
        equipment.equipmentName = json.equipmentName || '';
        equipment.equipmentType = json.equipmentType || '';
        switch (json.equipmentType) {
            case "thermocouple":
                equipment.equipmentConfig = ThermocoupleMetadata.fromJSON(json.equipment);
                break;
            case "camera":
                equipment.equipmentConfig = CameraMetadata.fromJSON(json.equipment);
                break;
            case "lens":
                equipment.equipmentConfig = LensMetadata.fromJSON(json.equipment);
                break;
            case "dic":
                equipment.equipmentConfig = DicMetadata.fromJSON(json.equipment);
                break;
            case "flowmeter":
                equipment.equipmentConfig = FlowmeterMetadata.fromJSON(json.equipment);
                break;
            case "pyrometer":
                equipment.equipmentConfig = PyrometerMetadata.fromJSON(json.equipment);
                break;
            case "ir-camera":
                equipment.equipmentConfig = IrCameraMetadata.fromJSON(json.equipment);
                break;
            default:
                equipment.equipmentConfig = null;
        }
        return equipment;
    }

    static toJSON(equipment: EquipmentMetadata): any {
        return {
            equipmentName: equipment.equipmentName,
            equipmentType: equipment.equipmentType,
            equipment: equipment.equipmentConfig
        };
    }
}