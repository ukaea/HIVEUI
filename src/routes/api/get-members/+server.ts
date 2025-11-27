import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

interface KeycloakTokenResponse {
	access_token: string;
	expires_in: number;
	token_type: string;
}

interface KeycloakUser {
	id: string;
	username: string;
	email?: string;
	firstName?: string;
	lastName?: string;
	enabled: boolean;
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Validate environment variables
		if (!env.AUTH_KEYCLOAK_ISSUER || !env.AUTH_KEYCLOAK_ID || !env.AUTH_KEYCLOAK_SECRET) {
			console.error('Missing Keycloak configuration');
			return json(
				{ success: false, message: 'Keycloak configuration is incomplete' },
				{ status: 500 }
			);
		}

		const issuerUrl = new URL(env.AUTH_KEYCLOAK_ISSUER);
		const pathParts = issuerUrl.pathname.split('/');
		const realmIndex = pathParts.indexOf('realms');
		
		if (realmIndex === -1 || realmIndex === pathParts.length - 1) {
			return json(
				{ success: false, message: 'Invalid Keycloak issuer URL format' },
				{ status: 500 }
			);
		}

		const realm = pathParts[realmIndex + 1];
		const keycloakBaseUrl = `${issuerUrl.protocol}//${issuerUrl.host}`;

		// Get access token
		const tokenUrl = `${keycloakBaseUrl}/realms/${realm}/protocol/openid-connect/token`;
		const tokenResponse = await fetch(tokenUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				grant_type: 'client_credentials',
				client_id: env.AUTH_KEYCLOAK_ID,
				client_secret: env.AUTH_KEYCLOAK_SECRET,
			}),
		});

		if (!tokenResponse.ok) {
			const errorText = await tokenResponse.text();
			console.error('Failed to get Keycloak access token:', errorText);
			return json(
				{ success: false, message: 'Failed to authenticate with Keycloak' },
				{ status: 500 }
			);
		}

		const tokenData: KeycloakTokenResponse = await tokenResponse.json();
		const usersUrl = new URL(`${keycloakBaseUrl}/admin/realms/${realm}/users`);
		
		const usersResponse = await fetch(usersUrl.toString(), {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${tokenData.access_token}`,
				'Content-Type': 'application/json',
			},
		});

		if (!usersResponse.ok) {
			const errorText = await usersResponse.text();
			console.error('Failed to fetch users from Keycloak:', errorText);
			return json(
				{ success: false, message: 'Failed to fetch users from Keycloak' },
				{ status: 500 }
			);
		}

		const users: KeycloakUser[] = await usersResponse.json();

		// Transform the data to a cleaner format
		const members = users.map((user) => ({
			id: user.id,
			username: user.username,
			email: user.email || '',
			firstName: user.firstName || '',
			lastName: user.lastName || '',
			enabled: user.enabled,
		}));

		return json({
			success: true,
			members,
			count: members.length,
		});

	} catch (error) {
		console.error('Error fetching members from Keycloak:', error);
		return json(
			{ 
				success: false, 
				message: error instanceof Error ? error.message : 'Error fetching members' 
			},
			{ status: 500 }
		);
	}
};