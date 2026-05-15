import { building } from "$app/environment";
import { env } from '$env/dynamic/private';
import { auth, refreshAccessToken } from "$lib/auth";
import { redirect, type Handle } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { jwtDecode } from "jwt-decode";

// Keyed by user id. Value is a promise that resolves to the new tokens (or null on failure).
// Concurrent requests for the same user wait on the same promise rather than each firing a refresh.
const refreshLocks = new Map<string, Promise<{ accessToken: string; refreshToken: string } | null>>();

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  if (pathname.startsWith("/api/auth")) {
    return svelteKitHandler({ event, resolve, auth, building });
  }

  if (env.AUTHN_ENABLE !== 'true') {
    return resolve(event);
  }

  const isAsset = pathname.includes('.') || pathname.startsWith('/fonts') || pathname.startsWith('/images');
  const isPublic = pathname === '/unauthorized';

  if (isAsset || isPublic) {
    return resolve(event);
  }

  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user as App.Locals['user'];

    const user = event.locals.user;
    if (user?.accessToken) {
      const { exp } = jwtDecode(user.accessToken) as { exp?: number };
      if (exp) {
        const now = Date.now() / 1000;
        const remainingSeconds = Math.round(exp - now);

        if (remainingSeconds <= 0) {
          console.warn(`[${pathname}] Access token expired for ${user.email}, refreshing`);

          // If no refresh is in flight for this user, start one. Otherwise join the existing promise.
          if (!refreshLocks.has(user.id)) {
            const promise = refreshAccessToken(user.refreshToken).finally(() => {
              refreshLocks.delete(user.id);
            });
            refreshLocks.set(user.id, promise);
          }

          const newTokens = await refreshLocks.get(user.id)!;

          if (newTokens) {
            const { exp: newExp } = jwtDecode(newTokens.accessToken) as { exp?: number };
            const newExpiry = newExp ? `${Math.round(newExp - Date.now() / 1000)}s` : 'unknown';
            console.log(`[${pathname}] Token refreshed for ${user.email}, new access token expires in ${newExpiry}`);
            const updateResponse = await auth.api.updateUser({
              body: { accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken },
              headers: event.request.headers,
              asResponse: true
            });
            event.locals.user = { ...user, accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken };
            const response = await resolve(event);
            updateResponse.headers.getSetCookie().forEach(cookie => {
              response.headers.append('set-cookie', cookie);
            });
            return response;
          } else {
            console.warn(`Token refresh failed for ${user.email}, signing out`);
            await auth.api.signOut({ headers: event.request.headers });
            for (const c of event.cookies.getAll()) {
              event.cookies.delete(c.name, { path: '/' });
            }
            event.locals.session = null;
            event.locals.user = null;
            throw redirect(302, '/');
          }
        }
      }
    }
  } else {
    event.locals.session = null;
    event.locals.user = null;
  }

  if (!event.locals.user) {
    if (pathname.startsWith('/api/auth/callback')) {
      return resolve(event);
    }

    const result = await auth.api.signInSocial({
      body: {
        provider: 'keycloak-custom',
        callbackURL: '/'
      },
    });

    if (result?.url) {
      throw redirect(302, result.url);
    }

    throw redirect(302, '/unauthorized');
  }

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
