import { CombinationMetadata } from './CombinationMetadata';
import { getJsonContent } from "$lib/jsonUtils";

export class ConfigurationMetadata {
	configurationUUID: string;
    configurationName: string;
    equipmentCombinations: CombinationMetadata[];
    configurationDescription: string;

	constructor() {
		this.configurationUUID = '';
		this.configurationName = '';
		this.equipmentCombinations = [];
		this.configurationDescription = '';
	}

    static async fromJSON(json: any): Promise<ConfigurationMetadata> {
        const config = new ConfigurationMetadata();
        config.configurationUUID = json.configurationUUID || '';
        config.configurationName = json.configurationName || '';
        config.configurationDescription = json.configurationDescription || '';

        if (json.equipmentCombinations && Array.isArray(json.equipmentCombinations)) {
            const combinationPromises = json.equipmentCombinations.map(async (combinationUUID: string) => {
                try {
                    const combinationData = await getJsonContent(`combinations/${combinationUUID}.json`);
                    return await CombinationMetadata.fromJSON(combinationData);
                } catch (error) {
                    console.error(`Failed to load combination ${combinationUUID}:`, error);
                    return null;
                }
            });

            const combinations = await Promise.all(combinationPromises);
            config.equipmentCombinations = combinations.filter(combination => combination !== null) as CombinationMetadata[];
        }
        
        return config;
    }

    static toJSON(config: ConfigurationMetadata): any {
        return {
            configurationUUID: config.configurationUUID,
            configurationName: config.configurationName,
            equipmentCombinations: config.equipmentCombinations.map(combination => combination.combinationUUID),
            configurationDescription: config.configurationDescription
        };
    }
}