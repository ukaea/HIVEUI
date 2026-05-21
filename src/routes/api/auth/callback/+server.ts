import { createKeycloakClient, encodeSession, SESSION_COOKIE, type SessionData } from '$lib/server/auth';
import { error, redirect } from '@sveltejs/kit';
import * as arctic from 'arctic';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	const storedState = cookies.get('oauth_state');
	const codeVerifier = cookies.get('oauth_verifier');
	const redirectTo = cookies.get('oauth_redirect');

	// Clear the temporary PKCE / state cookies immediately
	const cookieDelete = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
	const clearHeaders = new Headers();
	clearHeaders.append('set-cookie', `oauth_state=; ${cookieDelete}`);
	clearHeaders.append('set-cookie', `oauth_verifier=; ${cookieDelete}`);
	clearHeaders.append('set-cookie', `oauth_redirect=; ${cookieDelete}`);

	if (!code || !state || !storedState || !codeVerifier) {
		throw error(400, 'Missing OAuth parameters');
	}

	if (state !== storedState) {
		throw error(400, 'State mismatch — possible CSRF');
	}

	const keycloak = createKeycloakClient();

	let tokens: arctic.OAuth2Tokens;
	try {
		tokens = await keycloak.validateAuthorizationCode(code, codeVerifier);
	} catch (e) {
		if (e instanceof arctic.OAuth2RequestError) {
			throw error(400, `OAuth error: ${e.code}`);
		}
		if (e instanceof arctic.ArcticFetchError) {
			throw error(502, 'Failed to reach Keycloak token endpoint');
		}
		throw error(500, 'Unexpected error during token exchange');
	}

	const idToken = tokens.idToken();
	const claims = arctic.decodeIdToken(idToken) as {
		sub: string;
		email: string;
		name: string;
		groups?: string[];
		email_verified?: boolean;
	};

	const session: SessionData = {
		accessToken: tokens.accessToken(),
		refreshToken: tokens.refreshToken(),
		userId: claims.sub,
		email: claims.email ?? '',
		name: claims.name ?? '',
		groups: claims.groups ?? []
	};

	const maxAge = 60 * 60 * 24 * 7;
	const cookieValue = encodeSession(session);

	const destination = redirectTo ? decodeURIComponent(redirectTo) : '/';

	const response = new Response(null, {
		status: 302,
		headers: clearHeaders
	});
	response.headers.set('location', destination);
	response.headers.append(
		'set-cookie',
		`${SESSION_COOKIE}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
	);

	return response;
};
