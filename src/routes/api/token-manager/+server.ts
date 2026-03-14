import { json } from '@sveltejs/kit';
import { airflowTokenManager } from '$lib/server/airflowTokenManager';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    const token = await airflowTokenManager.getToken();
    return json({ access_token: token });
};
