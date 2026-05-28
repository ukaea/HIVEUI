import Zod from "zod";

export class ThermocoupleMetadata {
    attachment: string;
    thermocoupleType: string;
    circleDiameter: number;
    noiseFloor: number;

    constructor() {
        this.attachment = '';
        this.thermocoupleType = '';
        this.circleDiameter = 0;
        this.noiseFloor = 0;
    }

    static schema = Zod.object({
		equipmentName: Zod.string().min(1, 'Equipment Name is required'),
		equipmentType: Zod.string().min(1, 'Equipment Type is required'),
		equipment: Zod.object({
			attachment: Zod.string().min(1, 'Attachment is required'),
			thermocoupleType: Zod.string().min(1, 'Thermocouple Type is required'),
			circleDiameter: Zod.number().min(0, 'Circle Diameter is required'),
			noiseFloor: Zod.number().min(0, 'Noise Floor is required')
		})
	});

    static fromJSON(json: any): ThermocoupleMetadata {
        const metadata = new ThermocoupleMetadata();
        metadata.attachment = json.attachment || '';
        metadata.thermocoupleType = json.thermocoupleType || '';
        metadata.circleDiameter = json.circleDiameter || 0;
        metadata.noiseFloor = json.noiseFloor || 0;
        return metadata;
    }

    static toJSON(metadata: ThermocoupleMetadata): any {
        return {
            attachment: metadata.attachment,
            thermocoupleType: metadata.thermocoupleType,
            circleDiameter: metadata.circleDiameter,
            noiseFloor: metadata.noiseFloor
        };
    }
}