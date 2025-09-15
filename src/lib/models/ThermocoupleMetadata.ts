export class ThermocoupleMetadata {
    status: string;
    attachment: string;
    tcType: string;
    location: string;
    areaType: string;
    circleDiameter: string;
    noiseFloor: string;

    constructor() {
        this.status = '';
        this.attachment = '';
        this.tcType = '';
        this.location = '';
        this.areaType = '';
        this.circleDiameter = '';
        this.noiseFloor = '';
    }

    static fromJSON(json: any): ThermocoupleMetadata {
        const metadata = new ThermocoupleMetadata();
        metadata.status = json.status || '';
        metadata.attachment = json.attachment || '';
        metadata.tcType = json.tcType || json.thermocoupleType || '';
        metadata.location = json.location || '';
        metadata.areaType = json.areaType || '';
        metadata.circleDiameter = json.circleDiameter || '';
        metadata.noiseFloor = json.noiseFloor || '';
        return metadata;
    }

    static toJSON(metadata: ThermocoupleMetadata): any {
        return {
            status: metadata.status,
            attachment: metadata.attachment,
            thermocoupleType: metadata.tcType,
            location: metadata.location,
            areaType: metadata.areaType,
            circleDiameter: metadata.circleDiameter,
            noiseFloor: metadata.noiseFloor
        };
    }
}