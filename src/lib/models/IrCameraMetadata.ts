import Zod from "zod";

export class Resolution {
    x: number | null;
    y: number | null;

    constructor() {
        this.x = null;
        this.y = null;
    }

    static fromJSON(json: any): Resolution {
        const resolution = new Resolution();
        resolution.x = json.x ?? null;
        resolution.y = json.y ?? null;
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
    minimum: number | null;
    maximum: number | null;

    constructor() {
        this.minimum = null;
        this.maximum = null;
    }

    static fromJSON(json: any): SpectralRange {
        const range = new SpectralRange();
        range.minimum = json.minimum ?? null;
        range.maximum = json.maximum ?? null;
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
        range.minimum = json.minimum ?? null;
        range.maximum = json.maximum ?? null;
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
    emissivity: number | null;
    framerate: number | null;

    constructor() {
        this.emissivity = null;
        this.framerate = null;
    }

    static fromJSON(json: any): IrCameraDeviceSettings {
        const settings = new IrCameraDeviceSettings();
        settings.emissivity = json.emissivity ?? null;
        settings.framerate = json.framerate ?? null;
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

    static schema = Zod.object({
		equipmentName: Zod.string().min(1, 'Equipment Name is required'),
		equipmentType: Zod.string().min(1, 'Equipment Type is required'),
		equipment: Zod.object({
			deviceInformation: Zod.object({
				make: Zod.string().min(1, 'Make is required'),
				model: Zod.string().min(1, 'Model is required'),
				serialNumber: Zod.string().min(1, 'Serial Number is required'),
				resolution: Zod.object({
					x: Zod.number({ error: 'Resolution X is required' }).min(1, 'Resolution X must be greater than 0'),
					y: Zod.number({ error: 'Resolution Y is required' }).min(1, 'Resolution Y must be greater than 0')
				}),
				spectralRange: Zod.object({
					minimum: Zod.number({ error: 'Minimum Wavelength is required' }).min(0, 'Minimum Wavelength must be 0 or greater'),
					maximum: Zod.number({ error: 'Maximum Wavelength is required' }).min(0, 'Maximum Wavelength must be 0 or greater')
				}),
				temperatureRange: Zod.object({
					minimum: Zod.number({ error: 'Minimum Temperature is required' }).min(0, 'Minimum Temperature must be 0 or greater'),
					maximum: Zod.number({ error: 'Maximum Temperature is required' }).min(0, 'Maximum Temperature must be 0 or greater')
				})
			}),
			deviceSettings: Zod.object({
				emissivity: Zod.number().min(0, 'Emissivity must be 0 or greater').nullable().optional(),
				framerate: Zod.number().min(0, 'Framerate must be 0 or greater').nullable().optional()
			})
		})
	});

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