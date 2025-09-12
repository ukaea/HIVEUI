import { getJsonContent } from "$lib/jsonUtils";

export class CampaignMetadata {
    campaignUUID: string;
    campaignTitle: string;

    constructor() {
        this.campaignUUID = '';
        this.campaignTitle = '';
    }

    static async fromJSON(json: any): Promise<CampaignMetadata> {
        const metadata = new CampaignMetadata();

        metadata.campaignUUID = json.campaignUUID || '';
        metadata.campaignTitle = json.campaignTitle || json.campaignName || '';

        return metadata;
    }

    static toJSON(campaign: CampaignMetadata): any {
        return {
            campaignUUID: campaign.campaignUUID,
            campaignTitle: campaign.campaignTitle
        };
    }
}