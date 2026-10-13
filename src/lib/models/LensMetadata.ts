import Zod from "zod";

export class LensDeviceInformation {
    make: string;
    model: string;
    serialNumber: string;
    focalLength: number | null;
    fieldOfView: LensFieldOfView;

    constructor() {
        this.make = '';
        this.model = '';
        this.serialNumber = '';
        this.focalLength = null;
        this.fieldOfView = new LensFieldOfView()
    }

    static fromJSON(json: any): LensDeviceInformation {
        const device = new LensDeviceInformation();
        device.make = json.make || '';
        device.model = json.model || '';
        device.serialNumber = json.serialNumber || '';
        device.focalLength = Number(json.focalLength) || null;
        device.fieldOfView = json.fieldOfView ? LensFieldOfView.fromJSON(json.fieldOfView) : new LensFieldOfView();
        return device;
    }

    static toJSON(device: LensDeviceInformation): any {
        return {
            make: device.make,
            model: device.model,
            serialNumber: device.serialNumber,
            focalLength: device.focalLength,
            fieldOfView: LensFieldOfView.toJSON(device.fieldOfView)
        };
    }
}


export class LensFieldOfView {
    x: number | null;
    y: number | null;

    constructor() {
        this.x = null;
        this.y = null;
    }

    static fromJSON(json: any): LensFieldOfView {
        const fieldofview = new LensFieldOfView();
        fieldofview.x = Number(json.x) || null;
        fieldofview.y = Number(json.y) || null;
        return fieldofview;
    }

    static toJSON(resolution: LensFieldOfView): any {
        return {
            x: resolution.x,
            y: resolution.y
        };
    }
}

export class LensMetadata {
    deviceInformation: LensDeviceInformation;
    static schema = Zod.object({
		equipmentName: Zod.string().min(1, 'Equipment Name is required'),
		equipmentType: Zod.string().min(1, 'Equipment Type is required'),
		equipment: Zod.object({
			deviceInformation: Zod.object({
				make: Zod.string().min(1, 'Make is required'),
				model: Zod.string().min(1, 'Model is required'),
				serialNumber: Zod.string().optional(),
				focalLength: Zod.number().min(0, 'Focal Length is required'),
                fieldOfView : Zod.object({
                    x: Zod.number().optional(),
                    y: Zod.number().optional(),
                    }).optional()
                })
				
			})
		});

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