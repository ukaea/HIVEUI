import { env } from '$env/dynamic/private';
import {
	createKeycloakClient,
	decodeSession,
	encodeSession,
	refreshAccessToken,
	SESSION_COOKIE,
	type SessionData
} from '$lib/server/auth';
import { redirect, type Handle } from '@sveltejs/kit';
import { jwtDecode } from 'jwt-decode';
import * as arctic from 'arctic';

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

function setSessionCookie(data: SessionData, response: Response): void {
	const value = encodeSession(data);
	const maxAge = 60 * 60 * 24 * 7; // 7 days
	response.headers.append(
		'set-cookie',
		`${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
	);
}

// ---------------------------------------------------------------------------
// Per-user refresh deduplication
// ---------------------------------------------------------------------------

const refreshLocks = new Map<string, Promise<{ accessToken: string; refreshToken: string } | null>>();

// ---------------------------------------------------------------------------
// Handle
// ---------------------------------------------------------------------------

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Auth callback and signout are handled by their own routes — let them through
	if (pathname.startsWith('/api/auth/') || pathname === '/signout') {
		return resolve(event);
	}

	if (env.AUTHN_ENABLE !== 'true') {
		return resolve(event);
	}

	const isAsset = pathname.includes('.') || pathname.startsWith('/fonts') || pathname.startsWith('/images');
	const isPublic = pathname === '/unauthorized';

	if (isAsset || isPublic) {
		return resolve(event);
	}

	// Read and verify session cookie
	const raw = event.cookies.get(SESSION_COOKIE);
	const session = raw ? decodeSession(raw) : null;

	if (session) {
		event.locals.user = session;

		// Check access token expiry directly from JWT exp claim
		const { exp } = jwtDecode(session.accessToken) as { exp?: number };
		const { exp: refreshExp } = jwtDecode(session.refreshToken) as { exp?: number };
		if (exp) {
			const now = Date.now() / 1000;
			const remainingSeconds = Math.round(exp - now);
			const refreshRemainingSeconds = refreshExp ? Math.round(refreshExp - now) : null;

			console.log(
				`[${pathname}] ${session.email} — access token expires in ${remainingSeconds}s` +
				(refreshRemainingSeconds !== null ? `, refresh token expires in ${refreshRemainingSeconds}s` : '')
			);

			if (remainingSeconds <= 0) {
				console.warn(`[${pathname}] Access token expired for ${session.email}, refreshing`);

				if (!refreshLocks.has(session.userId)) {
					const promise = refreshAccessToken(session.refreshToken).finally(() => {
						refreshLocks.delete(session.userId);
					});
					refreshLocks.set(session.userId, promise);
				}

				const newTokens = await refreshLocks.get(session.userId)!;

				if (newTokens) {
					const { exp: newExp } = jwtDecode(newTokens.accessToken) as { exp?: number };
					const newExpiry = newExp ? `${Math.round(newExp - Date.now() / 1000)}s` : 'unknown';
					console.log(`[${pathname}] Token refreshed for ${session.email}, new token expires in ${newExpiry}`);

					const updatedSession: SessionData = { ...session, ...newTokens };
					event.locals.user = updatedSession;

					const response = await resolve(event);
					setSessionCookie(updatedSession, response);
					return response;
				} else {
					console.warn(`Token refresh failed for ${session.email}, clearing session`);
					const clearCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
					const isBrowserNavigation = event.request.headers.get('accept')?.includes('text/html') ?? false;
					if (isBrowserNavigation) {
						// Full page load — redirect to root so the hook re-runs with no session
						// and issues the Keycloak redirect normally
						const headers = new Headers();
						headers.append('set-cookie', clearCookie);
						headers.set('location', '/');
						return new Response(null, { status: 302, headers });
					} else {
						// SvelteKit client-side fetch — signal the layout's fetch interceptor to reload
						const headers = new Headers();
						headers.append('set-cookie', clearCookie);
						headers.set('x-auth-reload', '1');
						return new Response(null, { status: 401, headers });
					}
				}
			}
		}
	} else {
		event.locals.user = null;
	}

	// Redirect unauthenticated users to Keycloak via PKCE
	if (!event.locals.user) {
		const state = arctic.generateState();
		const codeVerifier = arctic.generateCodeVerifier();

		const cookieOpts = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=600';
		const headers = new Headers();
		headers.append('set-cookie', `oauth_state=${state}; ${cookieOpts}`);
		headers.append('set-cookie', `oauth_verifier=${codeVerifier}; ${cookieOpts}`);
		headers.append('set-cookie', `oauth_redirect=${encodeURIComponent(pathname)}; ${cookieOpts}`);

		const keycloak = createKeycloakClient();
		const url = keycloak.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);
		headers.set('location', url.toString());

		return new Response(null, { status: 302, headers });
	}

	// Group authorisation
	if (env.AUTHZ_ENABLE === 'true') {
		const requiredGroup = env.AUTHZ_REQUIRED_GROUP;
		const userGroups = event.locals.user.groups ?? [];

		if (requiredGroup && !userGroups.includes(requiredGroup)) {
			console.warn(`Access denied for ${event.locals.user.email}`);
			throw redirect(303, '/unauthorized');
		}
	}

	return resolve(event);
};
