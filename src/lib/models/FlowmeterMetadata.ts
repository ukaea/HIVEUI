import Zod from "zod";

export class FlowRange {
    minimum: number;
    maximum: number;

    constructor() {
        this.minimum = 0;
        this.maximum = 0;
    }

    static fromJSON(json: any): FlowRange {
        const range = new FlowRange();
        range.minimum = json.minimum || 0;
        range.maximum = json.maximum || 0;
        return range;
    }

    static toJSON(range: FlowRange): any {
        return {
            minimum: range.minimum,
            maximum: range.maximum
        };
    }
}

export class FlowmeterMetadata {
    make: string;
    model: string;
    serialNumber: string;
    assetId: string;
    flowmeterType: string;
    flowRange: FlowRange;

    static schema = Zod.object({
		equipmentName: Zod.string().min(1, 'Equipment Name is required'),
		equipmentType: Zod.string().min(1, 'Equipment Type is required'),
		equipment: Zod.object({
			make: Zod.string().min(1, 'Make is required'),
			model: Zod.string().min(1, 'Model is required'),
			serialNumber: Zod.string().min(1, 'Serial Number is required'),
			assetId: Zod.string().optional(),
			flowmeterType: Zod.string().min(1, 'Flowmeter Type is required'),
			flowRange: Zod.object({
				minimum: Zod.number().min(0, 'Minimum Flow is required'),
				maximum: Zod.number().min(0, 'Maximum Flow is required')
			})
		})
	});

    constructor() {
        this.make = '';
        this.model = '';
        this.serialNumber = '';
        this.assetId = '';
        this.flowmeterType = '';
        this.flowRange = new FlowRange();
    }

    static fromJSON(json: any): FlowmeterMetadata {
        const device = new FlowmeterMetadata();
        device.make = json.make || '';
        device.model = json.model || '';
        device.serialNumber = json.serialNumber || '';
        device.assetId = json.assetId || '';
        device.flowmeterType = json.flowmeterType || '';
        device.flowRange = json.flowRange ? FlowRange.fromJSON(json.flowRange) : new FlowRange();
        return device;
    }

    static toJSON(device: FlowmeterMetadata): any {
        return {
            make: device.make,
            model: device.model,
            serialNumber: device.serialNumber,
            assetId: device.assetId,
            flowmeterType: device.flowmeterType,
            flowRange: FlowRange.toJSON(device.flowRange)
        };
    }
}
/** 
export class FlowmeterMetadata {
    deviceInformation: FlowmeterDeviceInformation;

    constructor() {
        this.deviceInformation = new FlowmeterDeviceInformation();
    }

    static fromJSON(json: any): FlowmeterMetadata {
        const metadata = new FlowmeterMetadata();
        metadata.deviceInformation = json.deviceInformation ? 
            FlowmeterDeviceInformation.fromJSON(json.deviceInformation) : 
            new FlowmeterDeviceInformation();
        return metadata;
    }

    static toJSON(metadata: FlowmeterMetadata): any {
        return {
            deviceInformation: FlowmeterDeviceInformation.toJSON(metadata.deviceInformation)
        };
    }
}
    FlowmeterDeviceInformation
    */