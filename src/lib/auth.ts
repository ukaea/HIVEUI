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
}

function fetchUserInfoFromCustomProvider(tokens: any): TokenData {
	// Extract ID token
	const idToken = tokens.idToken;
	if (!idToken) {
		throw new Error("ID token is missing");
	}

	// Decode the ID token to get user info
	const idData = jwtDecode(idToken) as any;

	const keycloakData: TokenData = {
		id: idData,
		accessToken: tokens.accessToken,
		refreshToken: tokens.refreshToken || ""
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

		console.log('Access token refreshed successfully');
		return {
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token || refreshToken
		};
	} catch (error) {
		console.error('Error refreshing access token:', error);
		return null;
	}
}

export async function fetchWithTokenRefresh(
	user: App.Locals['user'],
	requestHeaders: Headers,
	makeRequest: (token: string) => Promise<Response>
): Promise<Response> {
	const response = await makeRequest(user!.accessToken);
	console.log(`Downstream response status: ${response.status}`);

	if (response.status !== 403 && response.status !== 401) {
		return response;
	}

	if (!user?.refreshToken) {
		return response;
	}

	console.log(`Downstream ${response.status} for user ${user.email}, attempting token refresh`);
	const newTokens = await refreshAccessToken(user.refreshToken);
	if (!newTokens) {
		return response;
	}

	await auth.api.updateUser({
		body: {
			accessToken: newTokens.accessToken,
			refreshToken: newTokens.refreshToken
		},
		headers: requestHeaders
	});

	return makeRequest(newTokens.accessToken);
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
						refreshToken: keycloakData.refreshToken
					};
				}
			},
		]
	}),
	sveltekitCookies(getRequestEvent)]
});