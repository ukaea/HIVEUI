import { auth } from "$lib/auth";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { building } from "$app/environment";
import { redirect, type Handle } from "@sveltejs/kit";
import { env } from '$env/dynamic/private';

export const handle: Handle = async ({ event, resolve }) => {
  let session = await auth.api.getSession({
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
    return svelteKitHandler({ event, resolve, auth, building });
  }


  const publicPrefixes = ['/api/auth'];
  const publicPaths = ['/login', '/unauthorized'];
  const publicRootPath = '/';

  const isPublicRoute =
    publicPaths.includes(event.url.pathname) ||
    publicPrefixes.some(prefix => event.url.pathname.startsWith(prefix))
    
  // If it's a public route, skip all checks
  if (isPublicRoute) {
    return svelteKitHandler({ event, resolve, auth, building });
  }

  // --- AUTHENTICATION (Login Check) ---
  if (!event.locals.user) {
    throw redirect(303, '/login');
  }

  // --- AUTHORIZATION (Group Check) ---
  if (env.AUTHZ_ENABLE === 'true') {
    const requiredGroup = env.AUTHZ_REQUIRED_GROUP;

    if (!requiredGroup) {
      console.error("AUTHZ_ENABLE is true, but AUTHZ_REQUIRED_GROUP is missing.");
      throw new Error("Server misconfiguration: Missing required group.");
    }

    // Check for group membership
    const userGroups = event.locals.user.groups || [];
    const hasAccess = userGroups.includes(requiredGroup);

    if (!hasAccess) {
      console.log(`User ${event.locals.user.email} denied access. Missing group: ${requiredGroup}`);
      await auth.api.signOut({
        headers: event.request.headers,
      });
      throw redirect(303, '/unauthorized');
    }
  }

  return svelteKitHandler({ event, resolve, auth, building });
};