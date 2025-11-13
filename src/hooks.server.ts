import { redirect, type Handle } from '@sveltejs/kit';
import { handle as authenticationHandle } from './auth';
import { sequence } from '@sveltejs/kit/hooks';
import { AUTHZ_REQUIRED_GROUP } from '$env/static/private';
import { AUTHN_ENABLE } from '$env/static/private';
import { AUTHZ_ENABLE } from '$env/static/private';

async function authorizationHandle({ event, resolve }) {
  if (event.url.pathname.startsWith('/') && AUTHN_ENABLE === 'true') {
    const session = await event.locals.auth();
    if (!session) {
      throw redirect(303, '/auth/signin');
    }

    if (AUTHZ_ENABLE !== 'true' || AUTHZ_REQUIRED_GROUP === '') {
      return resolve(event);
    }

    const userGroups = session.user.groups || [];
    if (!userGroups.includes(AUTHZ_REQUIRED_GROUP)) {
      throw redirect(303, '/auth/signin');
    }
  }

  return resolve(event);
}

export const handle: Handle = sequence(authenticationHandle, authorizationHandle)