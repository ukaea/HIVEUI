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

export interface PulseMapEntry {
    pulseId: number;
    seqId: number;
}

function toPulseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

export function normalizePulseMap(raw: any): PulseMapEntry[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    const entries: PulseMapEntry[] = [];
    let dropped = 0;

    for (const pulse of raw) {
        const pulseId = toPulseNumber(pulse?.pulseId ?? pulse?.pulseNumber);
        const seqId = toPulseNumber(pulse?.seqId ?? pulse?.sequenceNumber);

        if (pulseId === null || seqId === null) {
            dropped++;
            continue;
        }

        entries.push({ pulseId, seqId });
    }

    if (dropped > 0) {
        console.warn(
            `normalizePulseMap: dropped ${dropped}/${raw.length} pulse map entries with no usable pulseId/seqId`
        );
    }

    return entries;
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
    sampleCooling: boolean;
    coolantType: string;
    targetCoolantFlow: number;
    targetCoolantTemperature: number;
    measuredCoolantFlow: number;

    constructor() {
        this.sampleCooling = false;
        this.coolantType = '';
        this.targetCoolantFlow = 0.0;
        this.targetCoolantTemperature = 0.0;
        this.measuredCoolantFlow = 0.0;
    }
    static fromJSON(json: any): CoolantInformation{
        const coolant = new CoolantInformation();
        coolant.sampleCooling = json.sampleCooling === true;
        coolant.coolantType = json.coolantType || '';
        coolant.targetCoolantFlow = Number(json.targetCoolantFlow) || 0.0;
        coolant.targetCoolantTemperature = Number(json.targetCoolantTemperature) || 0.0;
        coolant.measuredCoolantFlow = Number(json.measuredCoolantFlow) || 0.0;
        return coolant
    }

    static toJSON(metadata: CoolantInformation): any {
        return {
        sampleCooling: metadata.sampleCooling === true,
        coolantType: metadata.coolantType || '',
        targetCoolantFlow: Number(metadata.targetCoolantFlow) || 0.0,
        targetCoolantTemperature: Number(metadata.targetCoolantTemperature) || 0.0,
        measuredCoolantFlow: Number(metadata.measuredCoolantFlow) || 0.0
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
    pulseMap: PulseMapEntry[];

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
            coolantType: Zod.string(),
            targetCoolantFlow: Zod.number(),
            targetCoolantTemperature: Zod.number(),
            measuredCoolantFlow: Zod.number()
        }).superRefine((coolant, ctx) => {
            if (!coolant.sampleCooling) {
                return;
            }

            const required: [keyof typeof coolant, string][] = [
                ['coolantType', 'Coolant Type is required'],
                ['targetCoolantFlow', 'Target Coolant Flow is required'],
                ['targetCoolantTemperature', 'Target Coolant Temperature is required'],
                ['measuredCoolantFlow', 'Measured Coolant Flow is required']
            ];

            for (const [field, message] of required) {
                const value = coolant[field];
                const missing = typeof value === 'string' ? value.length < 1 : Number(value) < 1;
                if (missing) {
                    ctx.addIssue({ code: 'custom', path: [field], message });
                }
            }
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
        run.runNumber = Number(json.runNumber) || 0;
        run.sampleNumber = Number(json.sampleNumber) || 0;
        run.experimentNumber = Number(json.experimentNumber) || 0;
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
        run.pulseMap = normalizePulseMap(json.pulseMap);
        return run;
    }

    static toJSON(metadata: RunMetadata): any {
        return {
            runUUID: metadata.runUUID,
            runNumber: Number(metadata.runNumber) || 0,
            sampleNumber: Number(metadata.sampleNumber) || 0,
            experimentNumber: Number(metadata.experimentNumber) || 0,
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
            pulseMap: normalizePulseMap(metadata.pulseMap)
        };
    }
}
