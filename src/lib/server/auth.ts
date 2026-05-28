import * as arctic from 'arctic';
import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '$env/dynamic/private';

export function createKeycloakClient() {
	const redirectURI = `${env.APP_URL}/api/auth/callback`;
	return new arctic.KeyCloak(
		env.AUTH_KEYCLOAK_ISSUER,
		env.AUTH_KEYCLOAK_ID,
		env.AUTH_KEYCLOAK_SECRET,
		redirectURI
	);
}

export const SESSION_COOKIE = 'hive_session';

export interface SessionData {
	accessToken: string;
	refreshToken: string;
	userId: string;
	email: string;
	name: string;
	groups: string[];
}

// ---------------------------------------------------------------------------
// Session cookie encoding (HMAC-SHA256 signed, base64url payload)
// ---------------------------------------------------------------------------

function sign(payload: string, secret: string): string {
	return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function encodeSession(data: SessionData): string {
	const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
	const sig = sign(payload, env.SESSION_SECRET!);
	return `${payload}.${sig}`;
}

export function decodeSession(cookie: string): SessionData | null {
	const dot = cookie.lastIndexOf('.');
	if (dot === -1) return null;
	const payload = cookie.slice(0, dot);
	const sig = cookie.slice(dot + 1);
	const expected = sign(payload, env.SESSION_SECRET!);
	try {
		if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
	} catch {
		return null;
	}
	try {
		return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as SessionData;
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

/**
 * Refreshes the access token against Keycloak's token endpoint.
 * Returns new tokens or null if Keycloak rejects (e.g. refresh token expired).
 */
export async function refreshAccessToken(
	refreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
	const keycloak = createKeycloakClient();
	try {
		const tokens = await keycloak.refreshAccessToken(refreshToken);
		return {
			accessToken: tokens.accessToken(),
			refreshToken: tokens.refreshToken()
		};
	} catch (e) {
		if (e instanceof arctic.OAuth2RequestError) {
			console.error('Token refresh rejected by Keycloak:', e.code);
		} else if (e instanceof arctic.ArcticFetchError) {
			console.error('Token refresh fetch failed:', e.cause);
		} else {
			console.error('Token refresh unexpected error:', e);
		}
		return null;
	}
}

/**
 * Makes a downstream fetch with the current access token. If the downstream
 * service returns 401/403 (token expired mid-request), refreshes once and
 * retries. Writes new tokens back into locals.user so the hook's
 * setSessionCookie call on the way out picks them up automatically.
 */
export async function fetchWithTokenRefresh(
	locals: App.Locals,
	makeRequest: (token: string) => Promise<Response>
): Promise<Response> {
	const user = locals.user!;
	const response = await makeRequest(user.accessToken);

	if (response.status !== 401 && response.status !== 403) {
		return response;
	}

	console.log(`Downstream ${response.status} for ${user.email}, token likely expired mid-request — refreshing`);
	const newTokens = await refreshAccessToken(user.refreshToken);
	if (!newTokens) {
		return response;
	}

	locals.user = { ...user, ...newTokens };
	return makeRequest(newTokens.accessToken);
}
