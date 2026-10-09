import Zod from "zod";

export class ThermocoupleMetadata {
    attachment: string;
    thermocoupleType: string;
    circleDiameter: number | null;

    constructor() {
        this.attachment = '';
        this.thermocoupleType = '';
        this.circleDiameter = null;
    }

    static schema = Zod.object({
		equipmentName: Zod.string().trim().min(1, 'Equipment Name is required'),
		equipmentType: Zod.string().trim().min(1, 'Equipment Type is required'),
		equipment: Zod.object({
			attachment: Zod.string().trim().min(1, 'Attachment is required'),
			thermocoupleType: Zod.string().trim().min(1, 'Thermocouple Type is required'),
			circleDiameter: Zod.number().min(0, 'Circle Diameter is required'),
		})
	});

    static fromJSON(json: any): ThermocoupleMetadata {
        const metadata = new ThermocoupleMetadata();
        metadata.attachment = json.attachment || '';
        metadata.thermocoupleType = json.thermocoupleType || '';
        metadata.circleDiameter = Number(json.circleDiameter) || null;
        return metadata;
    }

    static toJSON(metadata: ThermocoupleMetadata): any {
        return {
            attachment: metadata.attachment,
            thermocoupleType: metadata.thermocoupleType,
            circleDiameter: metadata.circleDiameter,
        };
    }
}