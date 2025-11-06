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
		user: {
			accessToken?: string | null;
			preferred_username?: string | null;
			given_name?: string | null;
			family_name?: string | null;
			groups?: string[] | null;
		} & DefaultSession['user'];
	}
}

declare module '@auth/core/jwt' {
	interface JWT {
		accessToken?: string | null;
		preferred_username?: string | null;
		given_name?: string | null;
		family_name?: string | null;
		groups?: string[] | null;
	}
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

			if (profile) {
				token.preferred_username = profile.preferred_username;
				token.given_name = profile.given_name;
				token.family_name = profile.family_name;
			}

			if (account) {
				token.accessToken = account.access_token;
				if (account.id_token) {
					const payload = JSON.parse(
						Buffer.from(account.id_token.split('.')[1], 'base64').toString()
					);
					token.groups = payload.groups || [];
				}
			}

			return token;
		},

		async session({ session, token }) {
			session.user.accessToken = token.accessToken;
			session.user.preferred_username = token.preferred_username;
			session.user.given_name = token.given_name;
			session.user.family_name = token.family_name;
			session.user.groups = token.groups;
			return session;
		}
	}
});