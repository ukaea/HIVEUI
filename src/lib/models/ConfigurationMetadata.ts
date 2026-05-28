// $lib/models/ConfigurationMetadata.ts

import { CombinationMetadata } from './CombinationMetadata';
import type { MetadataModel } from '$lib/services/GenericDataService';

export class ConfigurationMetadata {
    configurationId: string;
    configurationName: string;
    configurationDescription: string;
    equipmentCombinations: CombinationMetadata[];

    constructor() {
        this.configurationId = '';
        this.configurationName = '';
        this.configurationDescription = '';
        this.equipmentCombinations = [];
    }

    static fromJSON(json: any): ConfigurationMetadata {
        const config = new ConfigurationMetadata();
        config.configurationId = json.configurationId ?? '';
        config.configurationName = json.configurationName ?? '';
        config.configurationDescription = json.configurationDescription ?? '';

        // Parse nested combinations - stored as full objects in JSONB
        if (json.equipmentCombinations && Array.isArray(json.equipmentCombinations)) {
            config.equipmentCombinations = json.equipmentCombinations.map(
                (combo: any) => CombinationMetadata.fromJSON(combo)
            );
        }

        return config;
    }

    static toJSON(config: ConfigurationMetadata): any {
        return {
            configurationId: config.configurationId,
            configurationName: config.configurationName,
            configurationDescription: config.configurationDescription,
            // Store full combination objects for denormalized DB storage
            equipmentCombinations: config.equipmentCombinations.map(
                (combo) => CombinationMetadata.toJSON(combo)
            )
        };
    }
}

// Export the model class implementation for the GenericDataService
export const ConfigurationMetadataModel: MetadataModel<ConfigurationMetadata> = ConfigurationMetadata;