import {CustomerMetadata, PersonMetadata } from '$lib/models';
import type { MetadataModel } from '$lib/services/GenericDataService';
import Zod from 'zod';

const optionalEmail = Zod.string()
	.trim()
	.refine((value) => value === '' || Zod.email().safeParse(value).success, 'Invalid email address')
	.optional();

function toDateString(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDate(value: string): Date {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
}

export class ExperimentMetadata {
    static SCHEMA_VERSION = '1.0.0';

    experimentNumber: number | null;
    title: string;
    startDate: Date | null;
    endDate: Date | null;
    description: string;
    leadInvestigator: PersonMetadata;
    customer: CustomerMetadata;
    schemaVersion: string;

    static schema = Zod.object({
		experimentNumber: Zod.number({ error: 'Experiment Number is required' })
			.int('Experiment Number must be a whole number')
			.min(1, 'Experiment Number must be greater than 0'),
		title: Zod.string({ error: 'Title is required' }).trim().min(1, 'Title is required'),
		startDate: Zod.date({ error: 'Start Date is required' }),
		endDate: Zod.date().nullable().optional(),
		description: Zod.string({ error: 'Description is required' }).trim().min(1, 'Description is required'),
		leadInvestigator: Zod.object({
			firstName: Zod.string({ error: 'First name is required' }).trim().min(1, 'First name is required'),
			lastName: Zod.string({ error: 'Last name is required' }).trim().min(1, 'Last name is required'),
			email: Zod.string({ error: 'Email is required' })
				.trim()
				.min(1, { error: 'Email is required', abort: true })
				.email('Invalid email address')
		}, { error: 'Lead Investigator is required' }),
		customer: Zod.object({
			organisation: Zod.string().optional(),
			contactPerson: Zod.object({
				firstName: Zod.string().optional(),
				lastName: Zod.string().optional(),
				email: optionalEmail
			})
		}).optional(),
		schemaVersion: Zod.string().min(1, 'Schema Version is required')
	});

    constructor() {
        this.experimentNumber = null;
        this.title = '';
        this.startDate = null;
        this.endDate = null;
        this.description = '';
        this.leadInvestigator = new PersonMetadata();
        this.customer = new CustomerMetadata();
        this.schemaVersion = ExperimentMetadata.SCHEMA_VERSION;
    }

    static async fromJSON(json: any): Promise<ExperimentMetadata> {
        const metadata = new ExperimentMetadata();
        
        metadata.experimentNumber = Number(json.experimentNumber) || null;
        metadata.title = json.title || '';
        metadata.startDate = json.startDate ? parseDate(json.startDate) : null;
        metadata.endDate = json.endDate ? parseDate(json.endDate) : null;
        metadata.description = json.description || '';
        if (json.leadInvestigator) {
            metadata.leadInvestigator = PersonMetadata.fromJSON(json.leadInvestigator);
        }

        if (json.customer) {
            metadata.customer = CustomerMetadata.fromJSON(json.customer);
        }

        metadata.schemaVersion = json.schemaVersion || ExperimentMetadata.SCHEMA_VERSION;

        return metadata;
    }

    static toJSON(experiment: ExperimentMetadata): any {
        return {
            experimentNumber: experiment.experimentNumber,
            title: experiment.title,
            startDate: experiment.startDate ? toDateString(experiment.startDate) : null,
            endDate: experiment.endDate ? toDateString(experiment.endDate) : null,
            description: experiment.description,
            leadInvestigator: PersonMetadata.toJSON(experiment.leadInvestigator),
            customer: experiment.customer ? CustomerMetadata.toJSON(experiment.customer) : null,
            schemaVersion: experiment.schemaVersion,
        };
    }
}

// Export the model class implementation for the GenericDataService
export const ExperimentMetadataModel: MetadataModel<ExperimentMetadata> = ExperimentMetadata;