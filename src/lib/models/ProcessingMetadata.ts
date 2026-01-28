import { CoolantInformation } from "./CompiledPulseMetadata";

export class HeatingInformation {
    measuredPower: number;
    outputFrequency: number;
    outputVoltage: number;
    outputCurrent: number;

    constructor() {
        this.measuredPower = 0;
        this.outputFrequency = 0;
        this.outputVoltage = 0;
        this.outputCurrent = 0;
    }

    static fromJSON(json: any): HeatingInformation {
        const heat = new HeatingInformation();
        heat.measuredPower = json.measuredPower || 0;
        heat.outputFrequency = json.outputFrequency || 0;
        heat.outputVoltage = json.outputVoltage || 0;
        heat.outputCurrent = json.outputCurrent || 0;
        return heat;
    }

    static toJSON(heat: HeatingInformation): any {
        return {
            measuredPower: heat.measuredPower,
            outputFrequency: heat.outputFrequency,
            outputVoltage: heat.outputVoltage,
            outputCurrent: heat.outputCurrent
        };
    }
}

export class coolantInformation {
    coolantFlow: number;
    coolantFlowVariance: number;
    coolantPressureIn: number;
    coolantPressureOut: number;
    deltaPressure: number;
    coolantTemperatureIn: number;
    coolantTemperatureInVariance: number;
    coolantTemperatureOut: number;
    coolantTemperatureOutVariance: number;
    deltaTemperature: number

    constructor() {
        this.coolantFlow = 0;
        this.coolantFlowVariance = 0;
        this.coolantPressureIn = 0;
        this.coolantPressureOut = 0;
        this.deltaPressure = 0;
        this.coolantTemperatureIn = 0
        this.coolantTemperatureInVariance = 0;
        this.coolantTemperatureOut = 0;
        this.coolantTemperatureOutVariance = 0;
        this.deltaTemperature = 0
    }

    static fromJSON(json: any): coolantInformation {
        const coolant = new coolantInformation();
        coolant.coolantFlow = json.coolantFlow || 0;
        coolant.coolantFlowVariance = json.coolantFlowVariance || 0;
        coolant.coolantPressureIn = json.coolantPressureIn || 0;
        coolant.coolantPressureOut = json.coolantPressureOut || 0;
        coolant.deltaPressure = json.deltaPressure || 0;
        coolant.coolantTemperatureIn = json.coolantTemperatureIn || 0;
        coolant.coolantTemperatureInVariance = json.coolantTemperatureInVariance || 0;
        coolant.coolantTemperatureOut = json.coolantTemperatureOut || 0;
        coolant.coolantTemperatureOutVariance = json.coolantTemperatureOutVariance || 0;
        coolant.deltaTemperature = json.deltaTemperature || 0;
        return coolant;
    }

    static toJSON(coolant: coolantInformation): any {
        return {
            coolantFlow: coolant.coolantFlow,
            coolantFlowVariance: coolant.coolantFlowVariance,
            coolantPressureIn: coolant.coolantPressureIn,
            coolantPressureOut: coolant.coolantPressureOut,
            deltaPressure: coolant.deltaPressure,
            coolantTemperatureIn: coolant.coolantTemperatureIn,
            coolantTemperatureInVariance: coolant.coolantTemperatureInVariance,
            coolantTemperatureOut: coolant.coolantTemperatureOut,
            coolantTemperatureOutVariance: coolant.coolantTemperatureOutVariance,
            deltaTemperature: coolant.deltaTemperature,
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

export class ProcessMetadata {
    powerSupplyReportedPower: string;
    heatingInformation: HeatingInformation;
    coolantInformation: CoolantInformation;
    pulseEndTimestamp: Date;
    pulseStartTimestamp: Date;
    dataCaptureStartTimestamp: Date;


    constructor() {
        this.powerSupplyReportedPower = '';
        this.heatingInformation = new HeatingInformation();
        this.coolantInformation = new CoolantInformation();
        this.pulseEndTimestamp = new Date();
        this.pulseStartTimestamp = new Date();
        this.dataCaptureStartTimestamp = new Date();
    }

    static fromJSON(json: any): ProcessMetadata {
        const device = new ProcessMetadata();
        device.powerSupplyReportedPower = json.powerSupplyReportedPower || '';
        device.heatingInformation = json.heatingInformation ? HeatingInformation.fromJSON(json.heatingInformation) : new HeatingInformation();
        device.coolantInformation = json.coolantInformation ? CoolantInformation.fromJSON(json.coolantInformation) : new CoolantInformation();
        device.pulseEndTimestamp = json.pulseEndTimestamp;
        device.pulseStartTimestamp = json.pulseStartTimestamp;
        device.dataCaptureStartTimestamp = json.dataCaptureStartTimestamp;
        return device;
    }

    static toJSON(device: ProcessMetadata): any {
        return {
            powerSupplyReportedPower: device.powerSupplyReportedPower,
            heatingInformation: HeatingInformation.toJSON(device.heatingInformation),
            coolantInformation: CoolantInformation.toJSON(device.coolantInformation),
            pulseEndTimestamp: device.pulseEndTimestamp,
            pulseStartTimestamp: device.pulseStartTimestamp,
            dataCaptureStartTimestamp: device.dataCaptureStartTimestamp
        };
    }
}