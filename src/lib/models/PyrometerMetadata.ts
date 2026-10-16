import Zod from "zod";

export class SpectralRange {
    minimum: number | null;
    maximum: number | null;

    constructor() {
        this.minimum = null;
        this.maximum = null;
    }

    static fromJSON(json: any): SpectralRange {
        const range = new SpectralRange();
        range.minimum = Number(json.minimum) || null;
        range.maximum = Number(json.maximum) || null;
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
    minimum: number | null;
    maximum: number | null;

    constructor() {
        this.minimum = null;
        this.maximum = null;
    }

    static fromJSON(json: any): TemperatureRange {
        const range = new TemperatureRange();
        range.minimum = Number(json.minimum) || null;
        range.maximum = Number(json.maximum) || null;
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
		equipmentName: Zod.string().trim().min(1, 'Equipment Name is required'),
		equipmentType: Zod.string().trim().min(1, 'Equipment Type is required'),
		equipment: Zod.object({
			make: Zod.string().trim().min(1, 'Make is required'),
			model: Zod.string().trim().min(1, 'Model is required'),
			serialNumber: Zod.string().trim().min(1, 'Serial Number is required'),
			assetId: Zod.string().optional(),
			spectralRange: Zod.object({
				minimum: Zod.number().min(0.1, 'Minimum Wavelength is required')
                                .refine((value) => !Number.isInteger(value), {
                                        message: 'Minimum Wavelength must be a decimal number'
                                }),
				maximum: Zod.number().min(0.1, 'Maximum Wavelength is required')
                                .refine((value) => !Number.isInteger(value), {
                                        message: 'Maximum Wavelength must be a decimal number'
                                })
			}).refine((range) => range.maximum >= range.minimum, {
				path: ['maximum'],
				error: 'Maximum Wavelength must be greater than or equal to Minimum Wavelength'
			}),
			temperatureRange: Zod.object({
				minimum: Zod.number({ error: 'Minimum Temperature is required' }).min(0, 'Minimum Temperature must be 0 or greater'),
				maximum: Zod.number({ error: 'Maximum Temperature is required' }).min(0, 'Maximum Temperature must be 0 or greater')
			}).refine((range) => range.maximum >= range.minimum, {
				path: ['maximum'],
				error: 'Maximum Temperature must be greater than or equal to Minimum Temperature'
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