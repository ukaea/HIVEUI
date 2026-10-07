import type { MetadataModel } from '$lib/services/GenericDataService';
import Zod from 'zod';

export class SampleMetadata {
    sampleNumber: number;
    name: string;
    ownerGroup: string;
    accessGroups: string[];

    static schema = Zod.object({
        sampleNumber: Zod.number().min(1, 'Sample Number must be greater than 0'),
        name: Zod.string().trim().min(1, 'Name is required'),
        ownerGroup: Zod.string().min(1, 'Owner Group is required'),
        accessGroups: Zod.array(Zod.string()).min(1, 'At least one Access Group is required')
    });

    constructor() {
        this.sampleNumber = 0;
        this.name = '';
        this.ownerGroup = '';
        this.accessGroups = [];
    }

    static fromJSON(json: any): SampleMetadata {
        const metadata = new SampleMetadata();
        metadata.sampleNumber = json.sampleNumber || 0;
        metadata.name = json.name || '';
        metadata.ownerGroup = json.ownerGroup || '';
        metadata.accessGroups = Array.isArray(json.accessGroups) ? json.accessGroups : [];
        return metadata;
    }

    static toJSON(sample: SampleMetadata): any {
        return {
            sampleNumber: sample.sampleNumber,
            name: sample.name,
            ownerGroup: sample.ownerGroup,
            accessGroups: sample.accessGroups
        };
    }
}

// Export the model class implementation for the GenericDataService
export const SampleMetadataModel: MetadataModel<SampleMetadata> = SampleMetadata;
