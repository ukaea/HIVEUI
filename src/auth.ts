import { SvelteKitAuth, type DefaultSession } from '@auth/sveltekit';
import Keycloak from '@auth/sveltekit/providers/keycloak';
import type { JWT } from '@auth/core/jwt';
import type { Account, Profile } from '@auth/core/types';
import {
	AUTH_KEYCLOAK_ID,
	AUTH_KEYCLOAK_ISSUER,
	AUTH_KEYCLOAK_SECRET,
	AUTH_SECRET
} from '$env/static/private';

// Extend the built-in session and JWT types
declare module '@auth/core/types' {
	interface Session extends DefaultSession {
		sessionToken?: string;
		user: {
			id?: string;
			preferred_username?: string;
			given_name?: string;
			family_name?: string;
			idToken?: string;
			accessToken?: string;
			refreshToken?: string;
		} & DefaultSession['user'];
	}
}

declare module '@auth/core/jwt' {
	interface JWT {
		id?: string;
		preferred_username?: string;
		given_name?: string;
		family_name?: string;
		idToken?: string;
		accessToken?: string;
		refreshToken?: string;
	}
}

// Keycloak profile type
interface KeycloakProfile extends Profile {
	preferred_username?: string;
	given_name?: string;
	family_name?: string;
}

const kcConfig = {
	issuer: AUTH_KEYCLOAK_ISSUER,
	clientId: AUTH_KEYCLOAK_ID,
	clientSecret: AUTH_KEYCLOAK_SECRET
};

export const { handle, signIn, signOut } = SvelteKitAuth({
	trustHost: true,
	secret: AUTH_SECRET,
	providers: [Keycloak(kcConfig)],
	callbacks: {
		async jwt({ user, token, account, profile }) {
			// Store user ID on first sign-in
			if (user?.id) {
				token.id = user.id;
			}

			// Store Keycloak profile information
			if (profile) {
				const kcProfile = profile as KeycloakProfile;
				token.preferred_username = kcProfile.preferred_username;
				token.given_name = kcProfile.given_name;
				token.family_name = kcProfile.family_name;
			}

			// Store tokens from the account
			if (account) {
				token.idToken = account.id_token;
				token.accessToken = account.access_token;
				token.refreshToken = account.refresh_token;
			}

			return token;
		},

		async session({ session, token }) {
			// Add custom fields to the session
			if (token.id) {
				session.user.id = token.id;
			}
			
			session.user.preferred_username = token.preferred_username;
			session.user.given_name = token.given_name;
			session.user.family_name = token.family_name;
			session.user.idToken = token.idToken;
			session.user.accessToken = token.accessToken;
			session.user.refreshToken = token.refreshToken;
			
			// Store access token as session token if available
			if (token.accessToken && typeof token.accessToken === 'string') {
				session.sessionToken = token.accessToken;
			}

			return session;
		}
	}
});