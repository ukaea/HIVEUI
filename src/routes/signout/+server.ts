// src/routes/api/auth/signout/+server.ts
import { auth } from "$lib/auth";
import { env } from '$env/dynamic/private';
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request, url }) => {
    await auth.api.signOut({ headers: request.headers });

    const logoutUrl = new URL(`${env.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/logout`);
    logoutUrl.searchParams.set("post_logout_redirect_uri", url.origin);
    logoutUrl.searchParams.set("client_id", env.AUTH_KEYCLOAK_ID);
    console.log(`Redirecting to Keycloak logout at: ${logoutUrl.toString()}`);

    throw redirect(302, logoutUrl.toString());
};