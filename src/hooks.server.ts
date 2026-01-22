import { building } from "$app/environment";
import { env } from '$env/dynamic/private';
import { auth } from "$lib/auth";
import { redirect, type Handle } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  // 1. Better Auth Handler
  if (pathname.startsWith("/api/auth")) {
    return svelteKitHandler({ event, resolve, auth, building });
  }

  // 2. Global Auth Bypass
  if (env.AUTHN_ENABLE !== 'true') {
    return resolve(event);
  }

  // 3. Asset & Public Path Guard
  // Exclude common static files and the unauthorized page
  const isAsset = pathname.includes('.') || pathname.startsWith('/fonts') || pathname.startsWith('/images');
  const isPublic = pathname === '/unauthorized';
  
  if (isAsset || isPublic) {
    return resolve(event);
  }

  // 4. Get Session
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user as App.Locals['user'];
  } else {
    event.locals.session = null;
    event.locals.user = null;
  }

  // 5. Authentication Challenge
  if (!event.locals.user) {
    // CRITICAL: Do not redirect if we are already in the middle of an auth flow
    // Better Auth handles the callback via the svelteKitHandler above.
    if (pathname.startsWith('/api/auth/callback')) {
        return resolve(event);
    }

    console.log(`Unauthenticated access to ${pathname}. Redirecting to Keycloak.`);

    const result = await auth.api.signInSocial({
      body: {
        provider: 'keycloak-custom',
        // Omitting callbackURL allows Better Auth to use its default internal logic
        // which is safer for state management.
        callbackURL: '/' 
      },
    });

    if (result?.url) {
      throw redirect(302, result.url);
    }

    throw redirect(302, '/unauthorized');
  }

  // 6. Authorization (Group Check)
  if (env.AUTHZ_ENABLE === 'true') {
    const requiredGroup = env.AUTHZ_REQUIRED_GROUP;
    const userGroups = event.locals.user?.groups || [];

    if (requiredGroup && !userGroups.includes(requiredGroup)) {
      console.warn(`Access Denied for ${event.locals.user?.email}`);
      await auth.api.signOut({ headers: event.request.headers });
      throw redirect(303, '/unauthorized');
    }
  }

  return resolve(event);
};