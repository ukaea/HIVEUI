import { getJsonContent } from "$lib/jsonUtils";
import { ConfigurationMetadata, CustomerMetadata, PersonMetadata } from '$lib/models';

export class ExperimentMetadata {
    ID: string;
    startDate: Date;
    endDate: Date;
    description: string;
    leadInvestigator: PersonMetadata;
    customer: CustomerMetadata;

    constructor() {
        this.ID = '';
        this.startDate = new Date();
        this.endDate = new Date();
        this.description = '';
        this.leadInvestigator = new PersonMetadata();
        this.customer = new CustomerMetadata();
    }

    static async fromJSON(json: any): Promise<ExperimentMetadata> {
        const metadata = new ExperimentMetadata();
        
        metadata.ID = json.ID || '';

        
        if (json.leadInvestigator) {
            metadata.leadInvestigator = PersonMetadata.fromJSON(json.leadInvestigator);
        }

        if (json.customer) {
            metadata.customer = CustomerMetadata.fromJSON(json.customer);
        }
        
        metadata.startDate = json.experimentStart ? new Date(json.experimentStart) : new Date();
        metadata.endDate = json.experimentEnd ? new Date(json.experimentEnd) : new Date();

        metadata.description = json.description || "";

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
        }

        return metadata;
    }

    static toJSON(experiment: ExperimentMetadata): any {
        return {
            ID: experiment.ID,
            startDate: experiment.startDate.toISOString(),
            endDate: experiment.endDate.toISOString(),
            description: experiment.description,
            leadInvestigator: PersonMetadata.toJSON(experiment.leadInvestigator),
            customer: CustomerMetadata.toJSON(experiment.customer),
        };
    }
}