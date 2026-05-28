import { SESSION_COOKIE } from '$lib/server/auth';
import { env } from '$env/dynamic/private';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const logoutUrl = new URL(`${env.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/logout`);
	if (env.KEYCLOAK_GENERIC_LOGOUT !== 'true') {
		logoutUrl.searchParams.set('post_logout_redirect_uri', env.APP_URL);
		logoutUrl.searchParams.set('client_id', env.AUTH_KEYCLOAK_ID);
	}

	const response = new Response(null, {
		status: 302,
		headers: { location: logoutUrl.toString() }
	});

	// Clear the session cookie
	response.headers.append(
		'set-cookie',
		`${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
	);

	return response;
};
