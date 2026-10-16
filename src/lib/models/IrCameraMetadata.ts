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
        resolution.x = Number(json.x) || null;
        resolution.y = Number(json.y) || null;
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

// export class IrCameraDeviceSettings {
//     emissivity: number;
//     framerate: number;

//     constructor() {
//         this.emissivity = 0;
//         this.framerate = 0;
//     }

//     static fromJSON(json: any): IrCameraDeviceSettings {
//         const settings = new IrCameraDeviceSettings();
//         settings.emissivity = json.emissivity || 0;
//         settings.framerate = json.framerate || 0;
//         return settings;
//     }

//     static toJSON(settings: IrCameraDeviceSettings): any {
//         return {
//             emissivity: settings.emissivity,
//             framerate: settings.framerate
//         };
//     }
// }

export class IrCameraMetadata {
    deviceInformation: IrCameraDeviceInformation;
    // deviceSettings: IrCameraDeviceSettings;

    static schema = Zod.object({
		equipmentName: Zod.string().min(1, 'Equipment Name is required'),
		equipmentType: Zod.string().min(1, 'Equipment Type is required'),
		equipment: Zod.object({
			deviceInformation: Zod.object({
				make: Zod.string().min(1, 'Make is required'),
				model: Zod.string().min(1, 'Model is required'),
				serialNumber: Zod.string().min(1, 'Serial Number is required'),
				resolution: Zod.object({
					x: Zod.number().min(0, 'Resolution X is required'),
					y: Zod.number().min(0, 'Resolution Y is required')
				}),
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
			}),
			// deviceSettings: Zod.object({
			// 	emissivity: Zod.number().min(0, 'Emissivity is required'),
			// 	framerate: Zod.number().min(0, 'Framerate is required')
			// })
		})
	});

    constructor() {
        this.deviceInformation = new IrCameraDeviceInformation();
        // this.deviceSettings = new IrCameraDeviceSettings();
    }

    static fromJSON(json: any): IrCameraMetadata {
        const metadata = new IrCameraMetadata();
        metadata.deviceInformation = json.deviceInformation ? 
            IrCameraDeviceInformation.fromJSON(json.deviceInformation) : 
            new IrCameraDeviceInformation();
        // metadata.deviceSettings = json.deviceSettings ? 
        //     IrCameraDeviceSettings.fromJSON(json.deviceSettings) : 
        //     new IrCameraDeviceSettings();
        return metadata;
    }

    static toJSON(metadata: IrCameraMetadata): any {
        return {
            deviceInformation: IrCameraDeviceInformation.toJSON(metadata.deviceInformation),
            // deviceSettings: IrCameraDeviceSettings.toJSON(metadata.deviceSettings)
        };
    }
}