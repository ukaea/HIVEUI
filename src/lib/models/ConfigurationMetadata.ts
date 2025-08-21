import { PairMetadata } from './PairMetadata';
import { getJsonContent } from "$lib/jsonUtils";

export class ConfigurationMetadata {
	configurationUUID: string;
    configurationName: string;
    equipmentPairs: PairMetadata[];

	constructor() {
		this.configurationUUID = '';
		this.configurationName = '';
		this.equipmentPairs = [];
	}

    static async fromJSON(json: any): Promise<ConfigurationMetadata> {
        const config = new ConfigurationMetadata();
        config.configurationUUID = json.configurationUUID || '';
        config.configurationName = json.configurationName || '';
        
        if (json.equipmentPairs && Array.isArray(json.equipmentPairs)) {
            const pairPromises = json.equipmentPairs.map(async (pairUUID: string) => {
                try {
                    const pairData = await getJsonContent(`pairs/${pairUUID}.json`);
                    return await PairMetadata.fromJSON(pairData);
                } catch (error) {
                    console.error(`Failed to load pair ${pairUUID}:`, error);
                    return null;
                }
            });
            
            const pairs = await Promise.all(pairPromises);
            config.equipmentPairs = pairs.filter(pair => pair !== null) as PairMetadata[];
        }
        
        return config;
    }

    static toJSON(config: ConfigurationMetadata): any {
        return {
            configurationUUID: config.configurationUUID,
            configurationName: config.configurationName,
            equipmentPairs: config.equipmentPairs.map(pair => pair.pairUUID)
        };
    }
}