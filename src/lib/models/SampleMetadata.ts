import type { MetadataModel } from '$lib/services/GenericDataService';
import Zod from 'zod';

export class SampleMetadata {
    sampleNumber: number;

    static schema = Zod.object({
        sampleNumber: Zod.number().min(1, 'Sample Number must be greater than 0')
    });

    constructor() {
        this.sampleNumber = 0;
    }

    static fromJSON(json: any): SampleMetadata {
        const metadata = new SampleMetadata();
        metadata.sampleNumber = json.sampleNumber || 0;
        return metadata;
    }

    static toJSON(sample: SampleMetadata): any {
        return {
            sampleNumber: sample.sampleNumber
        };
    }
}

// Export the model class implementation for the GenericDataService
export const SampleMetadataModel: MetadataModel<SampleMetadata> = SampleMetadata;
