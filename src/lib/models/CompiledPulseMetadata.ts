import Zod from "zod";
import { PersonMetadata } from "./PersonMetadata";

export class HeatingInformation {
    heatingType: string;
    currentType: string;
    inputPower: number;
    inputCurrent: number;
    inputVoltage: number;
    outputCurrent: number;

    constructor() {
        this.heatingType = '';
        this.currentType = '';
        this.inputPower = 0.0;
        this.inputCurrent = 0.0;
        this.inputVoltage = 0.0;
        this.outputCurrent = 0.0; 
    }

    static fromJSON(json: any): HeatingInformation {
        const heat = new HeatingInformation();
        heat.heatingType = json.heatingType || '';
        heat.currentType = json.currentType || '';
        heat.inputPower = json.inputPower || '';
        heat.inputCurrent = json.inputCurrent || '';
        heat.inputVoltage = json.inputVoltage || '';
        heat.outputCurrent = json.outputCurrent || '';
        return heat
    }

    static toJSON(metadata: HeatingInformation): any {
        return{
            heatingType: metadata.heatingType,
            currentType: metadata.currentType,
            inputPower: metadata.inputPower,
            inputCurrent: metadata.inputCurrent,
            inputVoltage: metadata.inputVoltage,
            outputCurrent: metadata.outputCurrent
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
    measuredCoolantFlow: number;

    constructor() {
        this.sampleCooling = null;
        this.coolantType = '';
        this.targetCoolantFlow = 0.0;
        this.targetCoolantTemperature = 0.0;
        this.measuredCoolantFlow = 0.0;
    }
    static fromJSON(json: any): CoolantInformation{
        const coolant = new CoolantInformation();
        coolant.sampleCooling = json.sampleCooling || '';
        coolant.coolantType = json.coolantType || '';
        coolant.targetCoolantFlow = json.targetCoolantFlow || '';
        coolant.targetCoolantTemperature = json.targetCoolantTemperature || '';
        coolant.measuredCoolantFlow = json.measuredCoolantFlow || 0.0;
        return coolant
    }

    static toJSON(metadata: CoolantInformation): any {
        return {
        sampleCooling: metadata.sampleCooling,
        coolantType: metadata.coolantType,
        targetCoolantFlow: metadata.targetCoolantFlow,
        targetCoolantTemperature: metadata.targetCoolantTemperature,
        measuredCoolantFlow: metadata.measuredCoolantFlow
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
    operator1: PersonMetadata;
    operator2: PersonMetadata;
    heatingInformation: HeatingInformation;
    coolantInformation: CoolantInformation;
    comment: string;
    pulseQuality: string;
    experimentNumber: number;
    configurationUUID: string;
    processPath: string;
    status: string;
    
    static schema = Zod.object({
        pulseNumber: Zod.number().min(1, 'Pulse Number is required'),
        sampleNumber: Zod.number().min(1, 'Sample Number is required'),
        dataCaptureStart: Zod.date(),
        pulseStart: Zod.date(),
        pulseEnd: Zod.date(),
        operator1: Zod.object({
            firstName: Zod.string().min(1, "Operator 1 First Name is required"),
            lastName: Zod.string().min(1, "Operator 1 Last Name is required"),
            email: Zod.string().email('Invalid email address')
        }),
        operator2: Zod.object({
            firstName: Zod.string().min(1, "Operator 2 First Name is required"),
            lastName: Zod.string().min(1, "Operator 2 Last Name is required"),
            email: Zod.string().email('Invalid email address')
        }),
        heatingInformation: Zod.object({
            heatingType: Zod.enum(["Induction", "DC"]),
            currentType: Zod.enum(["AC", "DC"]),
            inputPower: Zod.number().optional(),
            inputCurrent: Zod.number().optional(),
            inputVoltage: Zod.number().optional(),
            outputCurrent: Zod.number().min(1, 'Output Current is required'),
        }),
        coolantInformation: Zod.object({
            sampleCooling: Zod.boolean(),
            coolantType: Zod.string().min(1, "Coolant Type is required"),
            targetCoolantFlow: Zod.number().min(1, 'Target Coolant Flow is required'),
            targetCoolantTemperature: Zod.number().min(1, 'Target Coolant Temperature is required'),
            measuredCoolantFlow: Zod.number().min(1, 'Measured Coolant Flow is required')
        }),
        comment: Zod.string().min(1, "Comment field is required"),
        pulseQuality: Zod.enum(["Success", "Fail"]),
        experimentNumber: Zod.number().min(1, "Experiment Number is required"),
        //configurationUUID: Zod.string().min(1, "Configuration UUID is required")
    });

    constructor() {
        this.pulseNumber = 0;
        this.sampleNumber = 0;
        this.experimentNumber = 0;
        this.dataCaptureStart = new Date();
        this.pulseStart = new Date();
        this.pulseEnd = new Date();
        this.operator1 = new PersonMetadata();
        this.operator2 = new PersonMetadata();
        this.heatingInformation = new HeatingInformation();
        this.coolantInformation = new CoolantInformation();
        this.comment = '';
        this.pulseQuality = '';
        this.configurationUUID = '';
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
        pulse.comment = json.comment;
        pulse.pulseQuality = json.pulseQuality;
        pulse.experimentNumber = json.experimentNumber;
        pulse.configurationUUID = json.configurationUUID;
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
            operator1: metaData.operator1,
            operator2: metaData.operator2,
            heatingInformation: metaData.heatingInformation,
            coolantInformation: metaData.coolantInformation,
            comment: metaData.comment,
            pulseQuality: metaData.pulseQuality,
            experimentNumber: metaData.experimentNumber,
            configurationUUID: metaData.configurationUUID,
            processPath: metaData.processPath,
            status: metaData.status
        }
    }
}