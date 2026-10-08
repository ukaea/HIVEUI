import Zod from "zod";

export class ThermocoupleMetadata {
    attachment: string;
    thermocoupleType: string;
    circleDiameter: number | null;
    noiseFloor: number | null;

    constructor() {
        this.attachment = '';
        this.thermocoupleType = '';
        this.circleDiameter = null;
        this.noiseFloor = null;
    }

    static schema = Zod.object({
		equipmentName: Zod.string().min(1, 'Equipment Name is required'),
		equipmentType: Zod.string().min(1, 'Equipment Type is required'),
		equipment: Zod.object({
			attachment: Zod.string().min(1, 'Attachment is required'),
			thermocoupleType: Zod.string().min(1, 'Thermocouple Type is required'),
			circleDiameter: Zod.number({ error: 'Circle Diameter is required' }).min(0, 'Circle Diameter must be 0 or greater'),
			noiseFloor: Zod.number().min(0, 'Noise Floor must be 0 or greater').nullable().optional()
		})
	});

    static fromJSON(json: any): ThermocoupleMetadata {
        const metadata = new ThermocoupleMetadata();
        metadata.attachment = json.attachment || '';
        metadata.thermocoupleType = json.thermocoupleType || '';
        metadata.circleDiameter = json.circleDiameter ?? null;
        metadata.noiseFloor = json.noiseFloor ?? null;
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