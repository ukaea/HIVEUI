export class Resolution {
    x: number;
    y: number;

    constructor() {
        this.x = 0;
        this.y = 0;
    }

    static fromJSON(json: any): Resolution {
        const resolution = new Resolution();
        resolution.x = json.x || 0;
        resolution.y = json.y || 0;
        return resolution;
    }

    static toJSON(resolution: Resolution): any {
        return {
            x: resolution.x,
            y: resolution.y
        };
    }
}

export class SpectralRange {
    minimum: number;
    maximum: number;

    constructor() {
        this.minimum = 0;
        this.maximum = 0;
    }

    static fromJSON(json: any): SpectralRange {
        const range = new SpectralRange();
        range.minimum = json.minimum || 0;
        range.maximum = json.maximum || 0;
        return range;
    }

    static toJSON(range: SpectralRange): any {
        return {
            minimum: range.minimum,
            maximum: range.maximum
        };
    }
}

export class TemperatureRange {
    minimum: number;
    maximum: number;

    constructor() {
        this.minimum = 0;
        this.maximum = 0;
    }

    static fromJSON(json: any): TemperatureRange {
        const range = new TemperatureRange();
        range.minimum = json.minimum || 0;
        range.maximum = json.maximum || 0;
        return range;
    }

    static toJSON(range: TemperatureRange): any {
        return {
            minimum: range.minimum,
            maximum: range.maximum
        };
    }
}

export class IrCameraDeviceInformation {
    make: string;
    model: string;
    serialNumber: string;
    resolution: Resolution;
    spectralRange: SpectralRange;
    temperatureRange: TemperatureRange;

    constructor() {
        this.make = '';
        this.model = '';
        this.serialNumber = '';
        this.resolution = new Resolution();
        this.spectralRange = new SpectralRange();
        this.temperatureRange = new TemperatureRange();
    }

    static fromJSON(json: any): IrCameraDeviceInformation {
        const device = new IrCameraDeviceInformation();
        device.make = json.make || '';
        device.model = json.model || '';
        device.serialNumber = json.serialNumber || '';
        device.resolution = json.resolution ? Resolution.fromJSON(json.resolution) : new Resolution();
        device.spectralRange = json.spectralRange ? SpectralRange.fromJSON(json.spectralRange) : new SpectralRange();
        device.temperatureRange = json.temperatureRange ? TemperatureRange.fromJSON(json.temperatureRange) : new TemperatureRange();
        return device;
    }

    static toJSON(device: IrCameraDeviceInformation): any {
        return {
            make: device.make,
            model: device.model,
            serialNumber: device.serialNumber,
            resolution: Resolution.toJSON(device.resolution),
            spectralRange: SpectralRange.toJSON(device.spectralRange),
            temperatureRange: TemperatureRange.toJSON(device.temperatureRange)
        };
    }
}

export class IrCameraDeviceSettings {
    emissivity: number;
    framerate: number;

    constructor() {
        this.emissivity = 0;
        this.framerate = 0;
    }

    static fromJSON(json: any): IrCameraDeviceSettings {
        const settings = new IrCameraDeviceSettings();
        settings.emissivity = json.emissivity || 0;
        settings.framerate = json.framerate || 0;
        return settings;
    }

    static toJSON(settings: IrCameraDeviceSettings): any {
        return {
            emissivity: settings.emissivity,
            framerate: settings.framerate
        };
    }
}

export class IrCameraMetadata {
    deviceInformation: IrCameraDeviceInformation;
    deviceSettings: IrCameraDeviceSettings;

    constructor() {
        this.deviceInformation = new IrCameraDeviceInformation();
        this.deviceSettings = new IrCameraDeviceSettings();
    }

    static fromJSON(json: any): IrCameraMetadata {
        const metadata = new IrCameraMetadata();
        metadata.deviceInformation = json.deviceInformation ? 
            IrCameraDeviceInformation.fromJSON(json.deviceInformation) : 
            new IrCameraDeviceInformation();
        metadata.deviceSettings = json.deviceSettings ? 
            IrCameraDeviceSettings.fromJSON(json.deviceSettings) : 
            new IrCameraDeviceSettings();
        return metadata;
    }

    static toJSON(metadata: IrCameraMetadata): any {
        return {
            deviceInformation: IrCameraDeviceInformation.toJSON(metadata.deviceInformation),
            deviceSettings: IrCameraDeviceSettings.toJSON(metadata.deviceSettings)
        };
    }
}