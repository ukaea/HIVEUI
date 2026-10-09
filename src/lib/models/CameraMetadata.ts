import Zod from "zod";

export class CameraResolution {
    x: number | null;
    y: number | null;

    constructor() {
        this.x = null;
        this.y = null;
    }

    static fromJSON(json: any): CameraResolution {
        const resolution = new CameraResolution();
        resolution.x = Number(json.x) || Number(json.resolutionX) || null;
        resolution.y = Number(json.y) || Number(json.resolutionY) || null;
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

    static schema = Zod.object({
		equipmentName: Zod.string().trim().min(1, 'Equipment Name is required'),
		equipmentType: Zod.string().trim().min(1, 'Equipment Type is required'),
		equipment: Zod.object({
			make: Zod.string().trim().min(1, 'Make is required'),
			model: Zod.string().trim().min(1, 'Model is required'),
			serialNumber: Zod.string().trim().optional(),
			assetId: Zod.string().trim().optional(),
			resolution: Zod.object({
                x: Zod.number().min(0.1, 'Resolution X is required'),
				y: Zod.number().min(0.1, 'Resolution Y is required')
			})
		})
	});

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

