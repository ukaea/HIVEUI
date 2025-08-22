import { ExperimentMetadata, PersonMetadata } from "$lib/models";
import { getJsonContent } from "$lib/jsonUtils";

export class CampaignMetadata {
    campaignUUID: string;
    campaignName: string;
    experiments: ExperimentMetadata[];

    constructor() {
        this.campaignUUID = '';
        this.campaignName = '';
        this.experiments = [];
    }

    static async fromJSON(json: any): Promise<CampaignMetadata> {
        const metadata = new CampaignMetadata();

        metadata.campaignUUID = json.campaignUUID || '';
        metadata.campaignName = json.campaignName || '';

        if (json.experiments && Array.isArray(json.experiments)) {
            const experimentPromises = json.experiments.map(async (experimentUUID: string) => {
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
            experiments: campaign.experiments.map(exp => exp.experimentUUID)
        };
    }
}