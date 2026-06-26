import Zod from "zod";
import { PersonMetadata } from "./PersonMetadata";

function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for non-secure contexts (HTTP in dev)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

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
        heat.inputPower = json.inputPower || 0.0;
        heat.inputCurrent = json.inputCurrent || 0.0;
        heat.inputVoltage = json.inputVoltage || 0.0;
        heat.outputCurrent = json.outputCurrent || 0.0;
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

export class RunMetadata {
    runUUID: string;
    runNumber: number;
    sampleNumber: number;
    experimentNumber: number;
    configurationId: string;
    operator1: PersonMetadata;
    operator2: PersonMetadata;
    heatingInformation: HeatingInformation;
    coolantInformation: CoolantInformation;
    status: string;
    dagRunId: string;
    ingestDagRunId: string;
    currentStep: number;
    createdAt: string;
    pulseMap: Array<{ pulseNumber: number; sequenceNumber: number }>

    static schema = Zod.object({
        runNumber: Zod.number().min(1, 'Run Number is required'),
        sampleNumber: Zod.number().min(1, 'Sample Number is required'),
        experimentNumber: Zod.number().min(1, 'Experiment Number is required'),
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
    });

    constructor() {
        this.runUUID = generateUUID();
        this.runNumber = 0;
        this.sampleNumber = 0;
        this.experimentNumber = 0;
        this.configurationId = '';
        this.operator1 = new PersonMetadata();
        this.operator2 = new PersonMetadata();
        this.heatingInformation = new HeatingInformation();
        this.coolantInformation = new CoolantInformation();
        this.status = 'draft';
        this.dagRunId = '';
        this.ingestDagRunId = '';
        this.currentStep = 0;
        this.createdAt = new Date().toISOString();
        this.pulseMap = [];
    }

    static fromJSON(json: any): RunMetadata {
        const run = new RunMetadata();
        run.runUUID = json.runUUID || run.runUUID;
        run.runNumber = json.runNumber || 0;
        run.sampleNumber = json.sampleNumber || 0;
        run.experimentNumber = json.experimentNumber || 0;
        run.configurationId = json.configurationId || '';
        run.operator1 = json.operator1 ?
            PersonMetadata.fromJSON(json.operator1) :
            new PersonMetadata();
        run.operator2 = json.operator2 ?
            PersonMetadata.fromJSON(json.operator2) :
            new PersonMetadata();
        run.heatingInformation = json.heatingInformation ?
            HeatingInformation.fromJSON(json.heatingInformation) :
            new HeatingInformation();
        run.coolantInformation = json.coolantInformation ?
            CoolantInformation.fromJSON(json.coolantInformation) :
            new CoolantInformation();
        run.status = json.status || 'draft';
        run.dagRunId = json.dagRunId || '';
        run.ingestDagRunId = json.ingestDagRunId || '';
        run.currentStep = json.currentStep || 0;
        run.createdAt = json.createdAt || new Date().toISOString();
        run.pulseMap = Array.isArray(json.pulseMap) ? json.pulseMap : [];
        return run;
    }

    static toJSON(metadata: RunMetadata): any {
        return {
            runUUID: metadata.runUUID,
            runNumber: metadata.runNumber,
            sampleNumber: metadata.sampleNumber,
            experimentNumber: metadata.experimentNumber,
            configurationId: metadata.configurationId,
            operator1: PersonMetadata.toJSON(metadata.operator1),
            operator2: PersonMetadata.toJSON(metadata.operator2),
            heatingInformation: HeatingInformation.toJSON(metadata.heatingInformation),
            coolantInformation: CoolantInformation.toJSON(metadata.coolantInformation),
            status: metadata.status,
            dagRunId: metadata.dagRunId,
            ingestDagRunId: metadata.ingestDagRunId,
            currentStep: metadata.currentStep,
            createdAt: metadata.createdAt,
            pulseMap: metadata.pulseMap.map(({ pulseNumber, sequenceNumber }) => ({ pulseNumber, sequenceNumber }))
        };
    }
}
