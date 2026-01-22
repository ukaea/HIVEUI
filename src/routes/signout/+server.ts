// src/routes/api/auth/signout/+server.ts
import { auth } from "$lib/auth";
import { env } from '$env/dynamic/private';
import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals, url }) => {
    // 1. Clear the Better Auth session
    await auth.api.signOut({
        headers: new Headers({
            cookie: url.searchParams.get('cookie') || ""
        })
    });

    // 2. Construct the Keycloak Logout URL
    const logoutUrl = new URL(`${env.AUTH_KEYCLOAK_ISSUER}/protocol/openid-connect/logout`);
    
    logoutUrl.searchParams.set("post_logout_redirect_uri", url.origin);
    logoutUrl.searchParams.set("client_id", env.AUTH_KEYCLOAK_ID);
    console.log(`Redirecting to Keycloak logout at: ${logoutUrl.toString()}`);

    // 3. Redirect the browser to Keycloak to kill the global session
    throw redirect(302, logoutUrl.toString());
};