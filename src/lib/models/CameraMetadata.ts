
export class CameraResolution {
    x: number;
    y: number;

    constructor() {
        this.x = 0;
        this.y = 0;
    }

    static fromJSON(json: any): CameraResolution {
        const resolution = new CameraResolution();
        resolution.x = json.x || json.resolutionX || 0;
        resolution.y = json.y || json.resolutionY || 0;
        return resolution;
    }

    static toJSON(resolution: CameraResolution): any {
        return {
            x: resolution.x,
            y: resolution.y
        };
    }
}

export class CameraMetadata {
    make: string;
    model: string;
    serialNumber: string;
    assetId: string;
    resolution: CameraResolution;

    constructor() {
        this.make = '';
        this.model = '';
        this.serialNumber = '';
        this.assetId = '';
        this.resolution = new CameraResolution();
    }

    static fromJSON(json: any): CameraMetadata {
        const device = new CameraMetadata();
        device.make = json.make || '';
        device.model = json.model || '';
        device.serialNumber = json.serialNumber || '';
        device.assetId = json.assetId || '';
        device.resolution = json.resolution ? CameraResolution.fromJSON(json.resolution) : new CameraResolution();
        return device;
    }

    static toJSON(device: CameraMetadata): any {
        return {
            make: device.make,
            model: device.model,
            serialNumber: device.serialNumber,
            assetId: device.assetId,
            resolution: CameraResolution.toJSON(device.resolution)
        };
    }
}
/** 
export class CameraMetadata {
    deviceInformation: CameraDeviceInformation;

    constructor() {
        this.deviceInformation = new CameraDeviceInformation();
    }

    static fromJSON(json: any): CameraMetadata {
        const metadata = new CameraMetadata();
        metadata.deviceInformation = json.deviceInformation ? 
            CameraDeviceInformation.fromJSON(json.deviceInformation) : 
            new CameraDeviceInformation();
        return metadata;
    }

    static toJSON(metadata: CameraMetadata): any {
        return {
            deviceInformation: CameraDeviceInformation.toJSON(metadata.deviceInformation)
        };
    }
}
*/

