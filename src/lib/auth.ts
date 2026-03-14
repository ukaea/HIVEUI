import { betterAuth } from "better-auth";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { genericOAuth, keycloak } from "better-auth/plugins"
import { env } from '$env/dynamic/private';
import { jwtDecode } from "jwt-decode";

interface TokenData {
	id: any;
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresAt: number;
}

function fetchUserInfoFromCustomProvider(tokens: any): TokenData {
	// Extract ID token
	const idToken = tokens.idToken;
	if (!idToken) {
		throw new Error("ID token is missing");
	}

	// Decode the ID token to get user info
	const idData = jwtDecode(idToken) as any;

	// Calculate expiry time (expiresIn is in seconds, convert to milliseconds timestamp)
	const expiresIn = tokens.expiresIn || 300; // Default to 5 minutes if not provided
	const accessTokenExpiresAt = Date.now() + (expiresIn * 1000);

	const keycloakData: TokenData = {
		id: idData,
		accessToken: tokens.accessToken,
		refreshToken: tokens.refreshToken || "",
		accessTokenExpiresAt
	}

	return keycloakData;
}

/**
 * Refreshes the access token using the refresh token from Keycloak.
 * Returns new token data or null if refresh fails.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresAt: number;
} | null> {
	try {
		// Fetch the OpenID configuration to get the token endpoint
		const discoveryUrl = `${env.AUTH_KEYCLOAK_ISSUER}/.well-known/openid-configuration`;
		const discoveryResponse = await fetch(discoveryUrl);
		if (!discoveryResponse.ok) {
			console.error('Failed to fetch OpenID configuration');
			return null;
		}
		const config = await discoveryResponse.json();
		const tokenEndpoint = config.token_endpoint;

		// Prepare the refresh token request
		const params = new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
			client_id: env.AUTH_KEYCLOAK_ID || '',
			client_secret: env.AUTH_KEYCLOAK_SECRET || ''
		});

		const response = await fetch(tokenEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: params.toString()
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Token refresh failed:', response.status, errorText);
			return null;
		}

		const tokens = await response.json();

		// Calculate new expiry time
		const expiresIn = tokens.expires_in || 300;
		const accessTokenExpiresAt = Date.now() + (expiresIn * 1000);

		return {
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token || refreshToken, // Keycloak may return a new refresh token
			accessTokenExpiresAt
		};
	} catch (error) {
		console.error('Error refreshing access token:', error);
		return null;
	}
}

export const auth = betterAuth({
	user: {
        additionalFields: {
            groups: {
                type: "string[]", // Allows storing an array of strings
                required: true,
                defaultValue: []
            },
			accessToken: {
				type: "string",
				required: true,
				defaultValue: ""
			},
			refreshToken: {
				type: "string",
				required: true,
				defaultValue: ""
			},
			accessTokenExpiresAt: {
				type: "number",
				required: true,
				defaultValue: 0
			}
        }
    },
	plugins: [genericOAuth({
		config: [
			{
				providerId: "keycloak-custom",
				clientId: env.AUTH_KEYCLOAK_ID,
				clientSecret: env.AUTH_KEYCLOAK_SECRET,
				discoveryUrl: `${env.AUTH_KEYCLOAK_ISSUER}/.well-known/openid-configuration`,
				scopes: ["openid", "profile", "email"],
				getUserInfo: async (tokens) => {
					// Custom logic to fetch and return user info
					const keycloakData = fetchUserInfoFromCustomProvider(tokens);
					return {
						id: keycloakData.id.sub,
						email: keycloakData.id.email,
						name: keycloakData.id.name,
						emailVerified: keycloakData.id.email_verified,
						groups: keycloakData.id.groups || [],
						accessToken: keycloakData.accessToken,
						refreshToken: keycloakData.refreshToken,
						accessTokenExpiresAt: keycloakData.accessTokenExpiresAt
					};
				}
			},
		]
	}),
	sveltekitCookies(getRequestEvent)]
});