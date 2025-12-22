import { auth } from "$lib/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import { redirect, type Handle } from "@sveltejs/kit";
import { env } from '$env/dynamic/private';

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith("/api/auth")) {
    return svelteKitHandler({ event, resolve, auth, building });
  }

  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user;
  } else {
    event.locals.session = null;
    event.locals.user = null;
  }

  // --- AUTHN BYPASS ---
  if (env.AUTHN_ENABLE !== 'true') {
    return resolve(event);
  }

  // --- PUBLIC PATHS ---
  const publicPaths = ['/unauthorized'];
  if (publicPaths.includes(event.url.pathname)) {
    return resolve(event);
  }

  // --- AUTHENTICATION (Direct to Keycloak) ---
  if (!event.locals.user) {
    console.log('No active session found. Redirecting to Keycloak.');

    const result = await auth.api.signInSocial({
      body: {
        provider: 'keycloak-custom',
        callbackURL: `${event.url.origin}`
      },
    });

    if (result && 'url' in result && result.url) {
      throw redirect(302, result.url);
    }

    console.error("Better Auth did not return a redirect URL", result);
  }

  // --- AUTHORIZATION (Group Check) ---
  if (env.AUTHZ_ENABLE === 'true') {
    const requiredGroup = env.AUTHZ_REQUIRED_GROUP;

    if (!requiredGroup) {
      console.error("AUTHZ_ENABLE is true, but AUTHZ_REQUIRED_GROUP is missing.");
      throw new Error("Server misconfiguration: Missing required group.");
    }

    const userGroups = (event.locals.user as any).groups || [];
    const hasAccess = userGroups.includes(requiredGroup);

    if (!hasAccess) {
      console.log(`User ${event.locals.user.email} denied access. Missing group: ${requiredGroup}`);

      await auth.api.signOut({ headers: event.request.headers });
      throw redirect(303, '/unauthorized');
    }
  }

  return resolve(event);
};