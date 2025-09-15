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

export class PyrometerDeviceInformation {
    make: string;
    model: string;
    serialNumber: string;
    spectralRange: SpectralRange;
    temperatureRange: TemperatureRange;

    constructor() {
        this.make = '';
        this.model = '';
        this.serialNumber = '';
        this.spectralRange = new SpectralRange();
        this.temperatureRange = new TemperatureRange();
    }

    static fromJSON(json: any): PyrometerDeviceInformation {
        const device = new PyrometerDeviceInformation();
        device.make = json.make || '';
        device.model = json.model || '';
        device.serialNumber = json.serialNumber || '';
        device.spectralRange = json.spectralRange ? SpectralRange.fromJSON(json.spectralRange) : new SpectralRange();
        device.temperatureRange = json.temperatureRange ? TemperatureRange.fromJSON(json.temperatureRange) : new TemperatureRange();
        return device;
    }

    static toJSON(device: PyrometerDeviceInformation): any {
        return {
            make: device.make,
            model: device.model,
            serialNumber: device.serialNumber,
            spectralRange: SpectralRange.toJSON(device.spectralRange),
            temperatureRange: TemperatureRange.toJSON(device.temperatureRange)
        };
    }
}

export class PyrometerDeviceSettings {
    emissivity: number;
    framerate: number;

    constructor() {
        this.emissivity = 0;
        this.framerate = 0;
    }

    static fromJSON(json: any): PyrometerDeviceSettings {
        const settings = new PyrometerDeviceSettings();
        settings.emissivity = json.emissivity || 0;
        settings.framerate = json.framerate || 0;
        return settings;
    }

    static toJSON(settings: PyrometerDeviceSettings): any {
        return {
            emissivity: settings.emissivity,
            framerate: settings.framerate
        };
    }
}

export class PyrometerMetadata {
    deviceInformation: PyrometerDeviceInformation;
    deviceSettings: PyrometerDeviceSettings;

    constructor() {
        this.deviceInformation = new PyrometerDeviceInformation();
        this.deviceSettings = new PyrometerDeviceSettings();
    }

    static fromJSON(json: any): PyrometerMetadata {
        const metadata = new PyrometerMetadata();
        metadata.deviceInformation = json.deviceInformation ? 
            PyrometerDeviceInformation.fromJSON(json.deviceInformation) : 
            new PyrometerDeviceInformation();
        metadata.deviceSettings = json.deviceSettings ? 
            PyrometerDeviceSettings.fromJSON(json.deviceSettings) : 
            new PyrometerDeviceSettings();
        return metadata;
    }

    static toJSON(metadata: PyrometerMetadata): any {
        return {
            deviceInformation: PyrometerDeviceInformation.toJSON(metadata.deviceInformation),
            deviceSettings: PyrometerDeviceSettings.toJSON(metadata.deviceSettings)
        };
    }
}