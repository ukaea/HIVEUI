export interface KeycloakMember {
	id: string;
	username: string;
	email: string;
	firstName: string;
	lastName: string;
	enabled: boolean;
}

export class MemberService {
	private static readonly API_ENDPOINT = '/api/get-members';

	/**
	 * Fetches all members from Keycloak
	 */
	static async getMembers(group:string): Promise<KeycloakMember[]> {
		try {
			//const response = await fetch(this.API_ENDPOINT);
            const response = await fetch(`${this.API_ENDPOINT}?group=${encodeURIComponent(group)}`);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Failed to fetch members');
			}

			const data = await response.json();
			return data.members || [];
		} catch (error) {
			console.error('Error fetching members:', error);
			throw error;
		}
	}
}