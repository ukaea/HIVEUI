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

    static fromJSON(json: any): ThermocoupleMetadata {
        const metadata = new ThermocoupleMetadata();
        metadata.attachment = json.attachment || '';
        metadata.thermocoupleType = json.tcType || json.thermocoupleType || '';
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