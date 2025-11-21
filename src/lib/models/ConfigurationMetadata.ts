// $lib/models/ConfigurationMetadata.ts

import { CombinationMetadata } from './CombinationMetadata';
import { getJsonContent } from "$lib/jsonUtils";
import type { MetadataModel } from '$lib/services/GenericDataService';

export class ConfigurationMetadata {
    configurationId: number;
    configurationName: string;
    equipmentCombinations: CombinationMetadata[];
    configurationDescription: string;

    constructor() {
        this.configurationId = 0;
        this.configurationName = '';
        this.equipmentCombinations = [];
        this.configurationDescription = '';
    }

    static async fromJSON(json: any): Promise<ConfigurationMetadata> {
        const config = new ConfigurationMetadata();
        config.configurationId = json.configurationId || 0;
        config.configurationName = json.configurationName || '';
        config.configurationDescription = json.configurationDescription || '';

        if (json.equipmentCombinations && Array.isArray(json.equipmentCombinations)) {
            const combinationPromises = json.equipmentCombinations.map(async (combinationId: number) => {
                try {
                    const combinationData = await getJsonContent(`combinations/combi${combinationId}.json`);
                    return await CombinationMetadata.fromJSON(combinationData);
                } catch (error) {
                    console.error(`Failed to load combination ${combinationId}:`, error);
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
            configurationId: config.configurationId,
            configurationName: config.configurationName,
            equipmentCombinations: config.equipmentCombinations.map(combination => combination.combinationId),
            configurationDescription: config.configurationDescription
        };
    }
}

// Export the model class implementation for the GenericDataService
export const ConfigurationMetadataModel: MetadataModel<ConfigurationMetadata> = ConfigurationMetadata;