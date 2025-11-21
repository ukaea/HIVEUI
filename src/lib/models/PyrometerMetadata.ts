import Zod from "zod";

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

export class PyrometerMetadata {
    make: string;
    model: string;
    serialNumber: string;
    assetId: string;
    spectralRange: SpectralRange;
    temperatureRange: TemperatureRange;

    static schema = Zod.object({
		equipmentName: Zod.string().min(1, 'Equipment Name is required'),
		equipmentType: Zod.string().min(1, 'Equipment Type is required'),
		equipment: Zod.object({
			make: Zod.string().min(1, 'Make is required'),
			model: Zod.string().min(1, 'Model is required'),
			serialNumber: Zod.string().optional(),
			assetId: Zod.string().optional(),
			spectralRange: Zod.object({
				minimum: Zod.number().min(0, 'Minimum Wavelength is required'),
				maximum: Zod.number().min(0, 'Maximum Wavelength is required')
			}),
			temperatureRange: Zod.object({
				minimum: Zod.number().min(0, 'Minimum Temperature is required'),
				maximum: Zod.number().min(0, 'Maximum Temperature is required')
			})
		})
	});

    constructor() {
        this.make = '';
        this.model = '';
        this.serialNumber = '';
        this.assetId = '';
        this.spectralRange = new SpectralRange();
        this.temperatureRange = new TemperatureRange();
    }

    static fromJSON(json: any): PyrometerMetadata {
        const device = new PyrometerMetadata();
        device.make = json.make || '';
        device.model = json.model || '';
        device.serialNumber = json.serialNumber || '';
        device.assetId = json.assetId || '';
        device.spectralRange = json.spectralRange ? SpectralRange.fromJSON(json.spectralRange) : new SpectralRange();
        device.temperatureRange = json.temperatureRange ? TemperatureRange.fromJSON(json.temperatureRange) : new TemperatureRange();
        return device;
    }

    static toJSON(device: PyrometerMetadata): any {
        return {
            make: device.make,
            model: device.model,
            serialNumber: device.serialNumber,
            assetId: device.assetId,
            spectralRange: SpectralRange.toJSON(device.spectralRange),
            temperatureRange: TemperatureRange.toJSON(device.temperatureRange)
        };
    }
}

/** 
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
    */