// $lib/models/ConfigurationMetadata.ts

import { DiagnosticMetadata } from './DiagnosticMetadata';
import type { MetadataModel } from '$lib/services/GenericDataService';
import Zod from 'zod';

export type AttachedDiagnostic = DiagnosticMetadata & { port: string };

export class ConfigurationMetadata {
    configurationNumber: number | null;
    configurationName: string;
    configurationDescription: string;
    diagnostics: AttachedDiagnostic[];

    static schema = Zod.object({
        configurationNumber: Zod.number({ error: 'Configuration Number is required' })
            .int('Configuration Number must be a whole number')
            .min(1, 'Configuration Number must be greater than 0'),
        configurationName: Zod.string({ error: 'Configuration Name is required' }).trim().min(1, 'Configuration Name is required'),
        configurationDescription: Zod.string().optional(),
        diagnostics: Zod.array(Zod.any()).min(1, 'At least one diagnostic is required')
    });

    constructor() {
        this.configurationNumber = null;
        this.configurationName = '';
        this.configurationDescription = '';
        this.diagnostics = [];
    }

    static fromJSON(json: any): ConfigurationMetadata {
        const config = new ConfigurationMetadata();
        config.configurationNumber = Number(json.configurationNumber) || null;
        config.configurationName = json.configurationName ?? '';
        config.configurationDescription = json.configurationDescription ?? '';

        // Parse nested diagnostics - stored as full objects in JSONB
        if (json.diagnostics && Array.isArray(json.diagnostics)) {
            config.diagnostics = json.diagnostics.map(
                (diagnostic: any) => ({ ...DiagnosticMetadata.fromJSON(diagnostic), port: diagnostic.port ?? '' })
            );
        }

        return config;
    }

    static toJSON(config: ConfigurationMetadata): any {
        return {
            configurationNumber: config.configurationNumber,
            configurationName: config.configurationName,
            configurationDescription: config.configurationDescription,
            // Store full diagnostic objects for denormalized DB storage
            diagnostics: config.diagnostics.map(
                (diagnostic) => ({ ...DiagnosticMetadata.toJSON(diagnostic), port: diagnostic.port ?? '' })
            )
        };
    }
}

// Export the model class implementation for the GenericDataService
export const ConfigurationMetadataModel: MetadataModel<ConfigurationMetadata> = ConfigurationMetadata;