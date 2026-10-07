// $lib/models/ConfigurationMetadata.ts

import { DiagnosticMetadata } from './DiagnosticMetadata';
import type { MetadataModel } from '$lib/services/GenericDataService';
import Zod from 'zod';

export class ConfigurationMetadata {
    configurationId: string;
    configurationName: string;
    configurationDescription: string;
    diagnostics: DiagnosticMetadata[];

    static schema = Zod.object({
        configurationId: Zod.string({ error: 'Configuration Id is required' }).trim().min(1, 'Configuration Id is required'),
        configurationName: Zod.string({ error: 'Configuration Name is required' }).trim().min(1, 'Configuration Name is required'),
        configurationDescription: Zod.string().optional(),
        diagnostics: Zod.array(Zod.any())
    });

    constructor() {
        this.configurationId = '';
        this.configurationName = '';
        this.configurationDescription = '';
        this.diagnostics = [];
    }

    static fromJSON(json: any): ConfigurationMetadata {
        const config = new ConfigurationMetadata();
        config.configurationId = json.configurationId ?? '';
        config.configurationName = json.configurationName ?? '';
        config.configurationDescription = json.configurationDescription ?? '';

        // Parse nested diagnostics - stored as full objects in JSONB
        if (json.diagnostics && Array.isArray(json.diagnostics)) {
            config.diagnostics = json.diagnostics.map(
                (diagnostic: any) => DiagnosticMetadata.fromJSON(diagnostic)
            );
        }

        return config;
    }

    static toJSON(config: ConfigurationMetadata): any {
        return {
            configurationId: config.configurationId,
            configurationName: config.configurationName,
            configurationDescription: config.configurationDescription,
            // Store full diagnostic objects for denormalized DB storage
            diagnostics: config.diagnostics.map(
                (diagnostic) => DiagnosticMetadata.toJSON(diagnostic)
            )
        };
    }
}

// Export the model class implementation for the GenericDataService
export const ConfigurationMetadataModel: MetadataModel<ConfigurationMetadata> = ConfigurationMetadata;