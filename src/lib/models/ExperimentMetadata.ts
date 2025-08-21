import { PersonMetadata } from '$lib/models';

export enum HeatingType {
    INDUCTION = 'Induction',
    DIRECT_CURRET = 'DC',
}

export class ExperimentMetadata {
    experimentUUID: string;
    experimentName: string;
    coilUUID: string;
    coilName: string;
    leadInvestigator: PersonMetadata;
    experimentStart: Date;
    experimentEnd: Date;
    heatingType: HeatingType;
    sampleCooling: boolean;

    constructor() {
        this.experimentUUID = '';
        this.experimentName = '';
        this.coilUUID = '';
        this.coilName = '';
        this.leadInvestigator = new PersonMetadata();
        this.experimentStart = new Date();
        this.experimentEnd = new Date();
        this.heatingType = HeatingType.INDUCTION;
        this.sampleCooling = false;
    }

    static fromJSON(apiResponse: any): ExperimentMetadata {
        const metadata = new ExperimentMetadata();
        
        metadata.experimentUUID = apiResponse.experimentUUID || '';
        metadata.experimentName = apiResponse.experimentName || '';
        metadata.coilUUID = apiResponse.coilUUID || '';
        metadata.coilName = apiResponse.coilName || '';
        
        // Handle nested PersonMetadata
        if (apiResponse.leadInvestigator) {
            metadata.leadInvestigator = PersonMetadata.fromJSON(apiResponse.leadInvestigator);
        }
        
        // Handle dates
        metadata.experimentStart = apiResponse.experimentStart ? new Date(apiResponse.experimentStart) : new Date();
        metadata.experimentEnd = apiResponse.experimentEnd ? new Date(apiResponse.experimentEnd) : new Date();
        
        // Handle enum
        metadata.heatingType = apiResponse.heatingType || HeatingType.INDUCTION;
        metadata.sampleCooling = apiResponse.sampleCooling || false;
        
        return metadata;
    }

    static toJSON(experiment: ExperimentMetadata): any {
        return {
            experimentUUID: experiment.experimentUUID,
            experimentName: experiment.experimentName,
            coilUUID: experiment.coilUUID,
            coilName: experiment.coilName,
            leadInvestigator: PersonMetadata.toJSON(experiment.leadInvestigator),
            experimentStart: experiment.experimentStart.toISOString(),
            experimentEnd: experiment.experimentEnd.toISOString(),
            heatingType: experiment.heatingType,
            sampleCooling: experiment.sampleCooling
        };
    }
}