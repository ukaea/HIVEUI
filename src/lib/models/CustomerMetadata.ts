import { PersonMetadata } from "./PersonMetadata";

export class CustomerMetadata {
    organization: string;
    contactPerson: PersonMetadata;

    constructor() {
        this.organization = '';
        this.contactPerson = new PersonMetadata();
    }

    static fromJSON(json: any): CustomerMetadata {
        const metadata = new CustomerMetadata();
        metadata.organization = json.organization || '';
        metadata.contactPerson = PersonMetadata.fromJSON(json.contactPerson) || new PersonMetadata();
        return metadata;
    }

    static toJSON(customer: CustomerMetadata): any {
        return {
            organization: customer.organization,
            contactPerson: PersonMetadata.toJSON(customer.contactPerson),
        };
    }
}