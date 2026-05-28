import { PersonMetadata } from "./PersonMetadata";

export class CustomerMetadata {
    organisation: string;
    contactPerson: PersonMetadata;

    constructor() {
        this.organisation = '';
        this.contactPerson = new PersonMetadata();
    }

    static fromJSON(json: any): CustomerMetadata {
        const metadata = new CustomerMetadata();
        metadata.organisation = json.organisation || json.organization || '';
        metadata.contactPerson = PersonMetadata.fromJSON(json.contactPerson) || new PersonMetadata();
        return metadata;
    }

    static toJSON(customer: CustomerMetadata): any {
        return {
            organisation: customer.organisation,
            contactPerson: PersonMetadata.toJSON(customer.contactPerson),
        };
    }
}