export class PersonMetadata {
    firstName: string;
    lastName: string;
    email: string;

    constructor() {
        this.firstName = '';
        this.lastName = '';
        this.email = '';
    }

    static fromJSON(apiResponse: any): PersonMetadata {
        const metadata = new PersonMetadata();
        metadata.firstName = apiResponse.firstName || '';
        metadata.lastName = apiResponse.lastName || '';
        metadata.email = apiResponse.email || '';
        return metadata;
    }

    static toJSON(person: PersonMetadata): any {
        return {
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email
        };
    }
}