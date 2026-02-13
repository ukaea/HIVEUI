import Zod from "zod";
import { PersonMetadata } from "./PersonMetadata";
import { HeatingInformation, CoolantInformation } from "./CompiledPulseMetadata";

export class RunMetadata {
    runNumber: number;
    sampleNumber: number;
    experimentNumber: string;
    configurationId: string;
    operator1: PersonMetadata;
    operator2: PersonMetadata;
    heatingInformation: HeatingInformation;
    coolantInformation: CoolantInformation;
    status: string;
    dagRunId: string;
    createdAt: string;

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
        this.runNumber = 0;
        this.sampleNumber = 0;
        this.experimentNumber = '';
        this.configurationId = '';
        this.operator1 = new PersonMetadata();
        this.operator2 = new PersonMetadata();
        this.heatingInformation = new HeatingInformation();
        this.coolantInformation = new CoolantInformation();
        this.status = 'draft';
        this.dagRunId = '';
        this.createdAt = new Date().toISOString();
    }

    static fromJSON(json: any): RunMetadata {
        const run = new RunMetadata();
        run.runNumber = json.runNumber || 0;
        run.sampleNumber = json.sampleNumber || 0;
        run.experimentNumber = json.experimentNumber || '';
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
        run.createdAt = json.createdAt || new Date().toISOString();
        return run;
    }

    static toJSON(metadata: RunMetadata): any {
        return {
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
            createdAt: metadata.createdAt
        };
    }
}
