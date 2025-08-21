import { ExperimentMetadata, PersonMetadata } from "$lib/models";
import { getJsonContent } from "$lib/jsonUtils";

export class CampaignMetadata {
    campaignUUID: string;
    campaignName: string;
    customerOrg: string;
    customerContactPerson: PersonMetadata;
    experiments: ExperimentMetadata[];

    constructor() {
        this.campaignUUID = '';
        this.campaignName = '';
        this.customerOrg = '';
        this.customerContactPerson = new PersonMetadata();
        this.experiments = [];
    }

    static async fromJSON(apiResponse: any): Promise<CampaignMetadata> {
        const metadata = new CampaignMetadata();

        metadata.campaignUUID = apiResponse.campaignUUID || '';
        metadata.campaignName = apiResponse.campaignName || '';
        metadata.customerOrg = apiResponse.customerOrg || '';
        
        if (apiResponse.customerContactPerson) {
            metadata.customerContactPerson = PersonMetadata.fromJSON(apiResponse.customerContactPerson);
        }
        
        if (apiResponse.experiments && Array.isArray(apiResponse.experiments)) {
            const experimentPromises = apiResponse.experiments.map(async (experimentUUID: string) => {
                try {
                    const experimentData = await getJsonContent(`experiments/${experimentUUID}.json`);
                    return ExperimentMetadata.fromJSON(experimentData);
                } catch (error) {
                    console.error(`Failed to load experiment ${experimentUUID}:`, error);
                    return null;
                }
            });
            
            const experiments = await Promise.all(experimentPromises);
            metadata.experiments = experiments.filter(exp => exp !== null) as ExperimentMetadata[];
        }
        
        return metadata;
    }

    static toJSON(campaign: CampaignMetadata): any {
        return {
            campaignUUID: campaign.campaignUUID,
            campaignName: campaign.campaignName,
            customerOrg: campaign.customerOrg,
            customerContactPerson: PersonMetadata.toJSON(campaign.customerContactPerson),
            experiments: campaign.experiments.map(exp => exp.experimentUUID)
        };
    }
}