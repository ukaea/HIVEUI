import { PersonMetadata } from "./PersonMetadata";

export class HeatingInformation {
    heatingType: string;
    currentType: string;
    inputPower: number;
    inputCurrent: number;
    inputVoltage: number;
    outputFrequency: string;
    measuredPower: string;
    outputCurrent: string;
    outputVoltage: string;

    constructor() {
        this.heatingType = '';
        this.currentType = '';
        this.inputPower = 0.0;
        this.inputCurrent = 0.0;
        this.inputVoltage = 0.0;
        this.outputFrequency = '';
        this.measuredPower = '';
        this.outputCurrent = '';
        this.outputVoltage = '';
    }

    static fromJSON(json: any): HeatingInformation {
        const heat = new HeatingInformation();
        heat.heatingType = json.heatingType || '';
        heat.currentType = json.currentType || '';
        heat.inputPower = json.inputPower || '';
        heat.inputCurrent = json.inputCurrent || '';
        heat.inputVoltage = json.inputVoltage || '';
        heat.outputFrequency = json.outputFrequency || '';
        heat.measuredPower = json.measuredPower || '';
        heat.outputCurrent = json.outputCurrent || '';
        heat.outputVoltage = json.outputVoltage || '';
        return heat
    }

    static toJSON(metadata: HeatingInformation): any {
        return{
            heatingType: metadata.heatingType,
            currentType: metadata.currentType,
            inputPower: metadata.inputPower,
            inputCurrent: metadata.inputCurrent,
            inputVoltage: metadata.inputVoltage,
            outputFrequency: metadata.outputFrequency,
            measuredPower: metadata.measuredPower,
            outputCurrent: metadata.outputCurrent,
            outputVoltage: metadata.outputVoltage
        };
    }
}

export class ThermocoupleInformation {
    thermocoupleID: string;
    maxValue: string;

    constructor() {
        this.thermocoupleID = '';
        this.maxValue = '';
    }

    static fromJSON(json: any): ThermocoupleInformation {
        const thermocouple = new ThermocoupleInformation();
        thermocouple.thermocoupleID = json.thermocoupleID || '';
        thermocouple.maxValue = json.maxValue || '';
        return thermocouple
    }

    static toJSON(metadata: ThermocoupleInformation): any {
        return {
            thermocoupleID: metadata.thermocoupleID,
            maxValue: metadata.maxValue,
        };
    }
}


export class CoolantPressure {
    in: string;
    out: string;
    delta: string;

    constructor() {
        this.in = '';
        this.out = '';
        this.delta = '';
    }

    static fromJSON(json: any): CoolantPressure {
        const pressure = new CoolantPressure();
        pressure.in = json.in || '';
        pressure.out = json.out || '';
        pressure.delta = json.delta || '';
        return pressure
    }

    static toJSON(metadata: CoolantPressure): any {
        return {
            in: metadata.in,
            out: metadata.out,
            delta: metadata.delta,
        }
    }

}

export class CoolantInformation {
    sampleCooling: boolean | null;
    coolantType: string;
    targetCoolantFlow: number;
    targetCoolantTemperature: number;
    measuredCoolantFlow: string;
    coolantFlowVariance:string;
    coolantPressureIn: string;
    coolantPressureOut: string;
    deltaPressure: string;
    coolantTemperatureIn: string;
    coolantTemperatureInVariance: string;
    coolantTemperatureOut: string;
    coolantTemperatureOutVariance: string;
    deltaTemperature: string;

    constructor() {
        this.sampleCooling = null;
        this.coolantType = '';
        this.targetCoolantFlow = 0.0;
        this.targetCoolantTemperature = 0.0;
        this.measuredCoolantFlow = '';
        this.coolantFlowVariance = '';
        this.coolantPressureIn = '';
        this.coolantPressureOut = '';
        this.deltaPressure = '';
        this.coolantTemperatureIn = '';
        this.coolantTemperatureInVariance = '';
        this.coolantTemperatureOut = '';
        this.coolantTemperatureOutVariance = '';
        this.deltaTemperature = '';
    }
    static fromJSON(json: any): CoolantInformation{
        const coolant = new CoolantInformation();
        coolant.sampleCooling = json.sampleCooling || '';
        coolant.coolantType = json.coolantType || '';
        coolant.targetCoolantFlow = json.targetCoolantFlow || '';
        coolant.targetCoolantTemperature = json.targetCoolantTemperature || '';
        coolant.measuredCoolantFlow = json.measuredCoolantFlow || '';
        coolant.coolantFlowVariance = json.coolantFlowVariance || '';
        coolant.coolantPressureIn = json.coolantPressureIn || '';
        coolant.coolantPressureOut = json.coolantPressureOut || '';
        coolant.deltaPressure = json.deltaPressure || '';
        coolant.coolantTemperatureIn = json.coolantTemperatureIn || '';
        coolant.coolantTemperatureInVariance = json.coolantTemperatureInVariance || '';
        coolant.coolantTemperatureOut = json.coolantTemperatureOut || '';
        coolant.coolantTemperatureOutVariance = json.coolantTemperatureOutVariance || '';
        coolant.deltaTemperature = json.coolantTemperatureOutVariance || '';
        return coolant
    }

    static toJSON(metadata: CoolantInformation): any {
        return {
        sampleCooling: metadata.sampleCooling,
        coolantType: metadata.coolantType,
        targetCoolantFlow: metadata.targetCoolantFlow,
        targetCoolantTemperature: metadata.targetCoolantTemperature,
        measuredCoolantFlow: metadata.measuredCoolantFlow,
        coolantFlowVariance: metadata.coolantFlowVariance,
        coolantPressureIn: metadata.coolantPressureIn,
        coolantPressureOut: metadata.coolantPressureOut,
        deltaPressure: metadata.deltaPressure,
        coolantTemperatureIn: metadata.coolantTemperatureIn,
        coolantTemperatureInVariance: metadata.coolantTemperatureInVariance,
        coolantTemperatureOut: metadata.coolantTemperatureOut,
        coolantTemperatureOutVariance: metadata.coolantTemperatureOutVariance,
        deltaTemperature: metadata.coolantTemperatureOutVariance,
        }
    }

}

	// Includes the experiment and configurations
export class CompiledPulseMetadata {
    pulseNumber: number;
    sampleNumber: number;
    dataCaptureStart: Date;
    pulseStart: Date;
    pulseEnd: Date;
    pulseDuration: string;
    operator1: PersonMetadata;
    operator2: PersonMetadata;
    heatingInformation: HeatingInformation;
    coolantInformation: CoolantInformation;
    thermocoupleInformation: ThermocoupleInformation;
    comment: string;
    pulseQuality: string;
    experimentNumber: string;
    configurationId: number;
    processPath: string;
    status: string;
    
    constructor() {
        this.pulseNumber = 0;
        this.sampleNumber = 0;
        this.experimentNumber = '';
        this.dataCaptureStart = new Date();
        this.pulseStart = new Date();
        this.pulseEnd = new Date();
        this.pulseDuration = '';
        this.operator1 = new PersonMetadata();
        this.operator2 = new PersonMetadata();
        this.heatingInformation = new HeatingInformation();
        this.coolantInformation = new CoolantInformation();
        this.thermocoupleInformation = new ThermocoupleInformation();
        this.comment = '';
        this.pulseQuality = '';
        this.configurationId = 0;
        this.processPath = '';
        this.status = '';
    }

    static fromJSON(json: any): CompiledPulseMetadata {
        const pulse = new CompiledPulseMetadata();
        pulse.pulseNumber = json.pulseNumber;
        pulse.sampleNumber = json.sampleNumber;
        pulse.dataCaptureStart = json.dataCaptureStart;
        pulse.pulseStart = json.pulseStart;
        pulse.pulseEnd = json.pulseEnd;
        pulse.pulseDuration = json.pulseDuration;
        pulse.operator1 = json.operator1 ?
            PersonMetadata.fromJSON(json.operator1) :
            new PersonMetadata();
        pulse.operator2 = json.operator2 ?
            PersonMetadata.fromJSON(json.operator2) :
            new PersonMetadata();
        pulse.heatingInformation = json.heatingInformation ?
            HeatingInformation.fromJSON(json.heatingInformation) :
            new HeatingInformation();
        pulse.coolantInformation = json.coolantInformation ?
            CoolantInformation.fromJSON(json.coolantInformation) :
            new CoolantInformation();
        pulse.thermocoupleInformation = json.thermocoupleInformation ?
            ThermocoupleInformation.fromJSON(json.thermocoupleInformation) :
            new ThermocoupleInformation();
        pulse.comment = json.comment;
        pulse.pulseQuality = json.pulseQuality;
        pulse.experimentNumber = json.experimentNumber;
        pulse.configurationId = json.configurationId;
        pulse.processPath = json.processPath;
        pulse.status = json.status;
        return pulse
    }

    static toJSON(metaData: CompiledPulseMetadata): any {
        return{
            pulseNumber: metaData.pulseNumber,
            sampleNumber: metaData.sampleNumber,
            dataCaptureStart: metaData.dataCaptureStart,
            pulseStart: metaData.pulseStart,
            pulseEnd: metaData.pulseEnd,
            pulseDuration: metaData.pulseDuration,
            operator1: metaData.operator1,
            operator2: metaData.operator2,
            heatingInformation: metaData.heatingInformation,
            coolantInformation: metaData.coolantInformation,
            thermocoupleInformation: metaData.thermocoupleInformation,
            comment: metaData.comment,
            pulseQuality: metaData.pulseQuality,
            experimentNumber: metaData.experimentNumber,
            configurationId: metaData.configurationId,
            processPath: metaData.processPath,
            status: metaData.status
        }
    }
}