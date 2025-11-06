import { redirect, type Handle } from '@sveltejs/kit';
import { handle as authenticationHandle } from './auth';
import { sequence } from '@sveltejs/kit/hooks';
import { AUTH_REQUIRED_GROUP } from '$env/static/private';
import { AUTH_ENABLE } from '$env/static/private';

async function authorizationHandle({ event, resolve }) {
  // Protect any routes under /
  if (event.url.pathname.startsWith('/') && AUTH_ENABLE === 'true') {
    const session = await event.locals.auth();
    if (!session) {
      // Redirect to the signin page
      throw redirect(303, '/auth/signin');
    }

    if (AUTH_REQUIRED_GROUP === '') {
      return resolve(event);
    }

    const userGroups = session.user.groups || [];
    if (!userGroups.includes(AUTH_REQUIRED_GROUP)) {
      throw redirect(303, '/auth/signin');
    }
  }

  return resolve(event);
}

export const handle: Handle = sequence(authenticationHandle, authorizationHandle)