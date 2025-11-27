import { betterAuth } from "better-auth";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { genericOAuth, keycloak } from "better-auth/plugins"
import { env } from '$env/dynamic/private';
import { jwtDecode } from "jwt-decode";

function fetchUserInfoFromCustomProvider(tokens: any) {
	// Extract ID token
	const idToken = tokens.idToken;
	if (!idToken) {
		throw new Error("ID token is missing");
	}
	
	// Decode the ID token to get user info
	const idData = jwtDecode(idToken) as any;

	const keycloakData = {
		id: idData,
		accessToken: tokens.accessToken,
	}

	return keycloakData;
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
					const keycloakData = await fetchUserInfoFromCustomProvider(tokens);
					return {
						id: keycloakData.id.sub,
						email: keycloakData.id.email,
						name: keycloakData.id.name,
						emailVerified: keycloakData.id.email_verified,
						groups: keycloakData.id.groups || [],
						accessToken: keycloakData.accessToken
					};
				}
			},
		]
	}),
	sveltekitCookies(getRequestEvent)]
});