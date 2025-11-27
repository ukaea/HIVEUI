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
	const decodedToken = jwtDecode(idToken) as any;
	return decodedToken;
}

export const auth = betterAuth({
	user: {
        additionalFields: {
            groups: {
                type: "string[]", // Allows storing an array of strings
                required: true,
                defaultValue: []
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
					const userInfo = await fetchUserInfoFromCustomProvider(tokens);
					return {
						id: userInfo.sub,
						email: userInfo.email,
						name: userInfo.name,
						emailVerified: userInfo.email_verified,
						groups: userInfo.groups || []
					};
				}
			},
		]
	}),
	sveltekitCookies(getRequestEvent)]
});