import { building } from "$app/environment";
import { env } from '$env/dynamic/private';
import { auth, refreshAccessToken } from "$lib/auth";
import { redirect, type Handle } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";

const TOKEN_REFRESH_BUFFER_MS = 30 * 1000;

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
    if (user?.accessTokenExpiresAt && user?.refreshToken) {
      const now = Date.now();
      if (now >= user.accessTokenExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
        const newTokens = await refreshAccessToken(user.refreshToken);
        if (newTokens) {
          try {
            await auth.api.updateUser({
              body: {
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken,
                accessTokenExpiresAt: newTokens.accessTokenExpiresAt
              },
              headers: event.request.headers
            });
            event.locals.user = {
              ...user,
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
              accessTokenExpiresAt: newTokens.accessTokenExpiresAt
            };
          } catch (updateError) {
            console.error('Failed to update user with new tokens:', updateError);
          }
        } else {
          await auth.api.signOut({ headers: event.request.headers });
          event.locals.session = null;
          event.locals.user = null;
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
