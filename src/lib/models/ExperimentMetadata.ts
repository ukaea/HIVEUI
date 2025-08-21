import { ConfigurationMetadata, CustomerMetadata, PersonMetadata } from '$lib/models';
import { HeatingTypeMetadata } from '$lib/models';
import { getJsonContent } from "$lib/jsonUtils";

export class ExperimentMetadata {
    experimentUUID: string;
    experimentName: string;
    coilUUID: string;
    coilName: string;
    customer: CustomerMetadata;
    leadInvestigator: PersonMetadata;
    experimentStart: Date;
    experimentEnd: Date;
    heatingType: HeatingTypeMetadata;
    sampleCooling: boolean;
    configurations: ConfigurationMetadata[];

    constructor() {
        this.experimentUUID = '';
        this.experimentName = '';
        this.coilUUID = '';
        this.coilName = '';
        this.customer = new CustomerMetadata();
        this.leadInvestigator = new PersonMetadata();
        this.experimentStart = new Date();
        this.experimentEnd = new Date();
        this.heatingType = HeatingTypeMetadata.INDUCTION;
        this.sampleCooling = false;
        this.configurations = [];
    }

    static async fromJSON(json: any): Promise<ExperimentMetadata> {
        const metadata = new ExperimentMetadata();
        
        metadata.experimentUUID = json.experimentUUID || '';
        metadata.experimentName = json.experimentName || '';
        metadata.coilUUID = json.coilUUID || '';
        metadata.coilName = json.coilName || '';
        
        if (json.leadInvestigator) {
            metadata.leadInvestigator = PersonMetadata.fromJSON(json.leadInvestigator);
        }

        if (json.customer) {
            metadata.customer = CustomerMetadata.fromJSON(json.customer);
        }
        
        metadata.experimentStart = json.experimentStart ? new Date(json.experimentStart) : new Date();
        metadata.experimentEnd = json.experimentEnd ? new Date(json.experimentEnd) : new Date();

        metadata.heatingType = json.heatingType || HeatingTypeMetadata.INDUCTION;
        metadata.sampleCooling = json.sampleCooling || false;

        if (json.configurations && Array.isArray(json.configurations)) {
            const configurationPromises = json.configurations.map(async (configurationUUID: string) => {
                try {
                    const configurationData = await getJsonContent(`configurations/${configurationUUID}.json`);
                    return ConfigurationMetadata.fromJSON(configurationData);
                } catch (error) {
                    console.error(`Failed to load configuration ${configurationUUID}:`, error);
                    return null;
                }
            });
            
            const configurations = await Promise.all(configurationPromises);
            metadata.configurations = configurations.filter(config => config !== null) as ConfigurationMetadata[];
        }

        return metadata;
    }

    static toJSON(experiment: ExperimentMetadata): any {
        return {
            experimentUUID: experiment.experimentUUID,
            experimentName: experiment.experimentName,
            coilUUID: experiment.coilUUID,
            coilName: experiment.coilName,
            leadInvestigator: PersonMetadata.toJSON(experiment.leadInvestigator),
            customer: CustomerMetadata.toJSON(experiment.customer),
            experimentStart: experiment.experimentStart.toISOString(),
            experimentEnd: experiment.experimentEnd.toISOString(),
            heatingType: experiment.heatingType,
            sampleCooling: experiment.sampleCooling,
            configurations: experiment.configurations.map(config => config.configurationUUID)
        };
    }
}