export class LensDeviceInformation {
    make: string;
    model: string;
    serialNumber: string;
    focalLength: string;
    aperture: string;
    fieldOfViewX: string;
    fieldOfViewY: string;

    constructor() {
        this.make = '';
        this.model = '';
        this.serialNumber = '';
        this.focalLength = '';
        this.aperture = '';
        this.fieldOfViewX = '';
        this.fieldOfViewY = '';
    }

    static fromJSON(json: any): LensDeviceInformation {
        const device = new LensDeviceInformation();
        device.make = json.make || '';
        device.model = json.model || '';
        device.serialNumber = json.serialNumber || '';
        device.focalLength = json.focalLength || '';
        device.aperture = json.aperture || '';
        device.fieldOfViewX = json.fieldOfViewX || '';
        device.fieldOfViewY = json.fieldOfViewY || '';
        return device;
    }

    static toJSON(device: LensDeviceInformation): any {
        return {
            make: device.make,
            model: device.model,
            serialNumber: device.serialNumber,
            focalLength: device.focalLength,
            aperture: device.aperture,
            fieldOfViewX: device.fieldOfViewX,
            fieldOfViewY: device.fieldOfViewY
        };
    }
}

export class LensMetadata {
    deviceInformation: LensDeviceInformation;

    constructor() {
        this.deviceInformation = new LensDeviceInformation();
    }

    static fromJSON(json: any): LensMetadata {
        const metadata = new LensMetadata();
        metadata.deviceInformation = json.deviceInformation ? 
            LensDeviceInformation.fromJSON(json.deviceInformation) : 
            new LensDeviceInformation();
        return metadata;
    }

    static toJSON(metadata: LensMetadata): any {
        return {
            deviceInformation: LensDeviceInformation.toJSON(metadata.deviceInformation)
        };
    }
}