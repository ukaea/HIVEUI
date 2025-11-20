import {CustomerMetadata, PersonMetadata } from '$lib/models';
import type { MetadataModel } from '$lib/services/GenericDataService';
import Zod from 'zod';

export class ExperimentMetadata {
    experimentNumber: number;
    startDate: Date;
    endDate: Date;
    description: string;
    leadInvestigator: PersonMetadata;
    customer: CustomerMetadata;

    static schema = Zod.object({
		experimentNumber: Zod.number().min(1, 'Experiment Number must be greater than 0'),
		startDate: Zod.date(),
		endDate: Zod.date().optional(),
		description: Zod.string().min(1, 'Description is required'),
		leadInvestigator: Zod.object({
			firstName: Zod.string().min(1, 'First name is required'),
			lastName: Zod.string().min(1, 'Last name is required'),
			email: Zod.string().email('Invalid email address')
		}, {required_error: 'Lead Investigator is required'}),
		customer: Zod.object({
			organisation: Zod.string().optional(),
			contactPerson: Zod.object({
				firstName: Zod.string().optional(),
				lastName: Zod.string().optional(),
				email: Zod.string().optional()
			})
		})
	});

    constructor() {
        this.experimentNumber = 0;
        this.startDate = new Date();
        this.endDate = new Date();
        this.description = '';
        this.leadInvestigator = new PersonMetadata();
        this.customer = new CustomerMetadata();
    }

    static async fromJSON(json: any): Promise<ExperimentMetadata> {
        const metadata = new ExperimentMetadata();
        
        metadata.experimentNumber = json.experimentNumber || 0;
        metadata.startDate = json.startDate ? new Date(json.startDate) : new Date();
        metadata.endDate = json.endDate ? new Date(json.endDate) : new Date();
        metadata.description = json.description || '';
        if (json.leadInvestigator) {
            metadata.leadInvestigator = PersonMetadata.fromJSON(json.leadInvestigator);
        }

        if (json.customer) {
            metadata.customer = CustomerMetadata.fromJSON(json.customer);
        }

        return metadata;
    }

    static toJSON(experiment: ExperimentMetadata): any {
        return {
            experimentNumber: experiment.experimentNumber,
            startDate: experiment.startDate.toISOString(),
            endDate: experiment.endDate ? experiment.endDate.toISOString() : null,
            description: experiment.description,
            leadInvestigator: PersonMetadata.toJSON(experiment.leadInvestigator),
            customer: experiment.customer ? CustomerMetadata.toJSON(experiment.customer) : null,
        };
    }
}

// Export the model class implementation for the GenericDataService
export const ExperimentMetadataModel: MetadataModel<ExperimentMetadata> = ExperimentMetadata;