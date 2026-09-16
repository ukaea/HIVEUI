import { airflowTokenManager } from '$lib/server/airflowTokenManager';

const SCOPE = 'airflow/fetch';

/**
 * Call Airflow with a bearer token, retrying once on 401/403 so a token Airflow
 * has stopped accepting (clock skew, restart, rotated signing key) self-heals
 * instead of failing every request until the cached expiry passes.
 */
export async function airflowFetch(endpoint: string, init: RequestInit = {}): Promise<Response> {
    const send = (token: string) => {
        const headers = new Headers(init.headers);
        headers.set('Authorization', `Bearer ${token}`);
        return fetch(endpoint, { ...init, headers });
    };

    const token = await airflowTokenManager.getToken();
    const response = await send(token);

    if (response.status !== 401 && response.status !== 403) {
        return response;
    }

    airflowTokenManager.invalidate(token);
    const freshToken = await airflowTokenManager.getToken();
    if (freshToken === token) {
        return response;
    }

    console.warn(`[${SCOPE}] ${response.status} from ${endpoint}, retrying with a fresh token`);
    void response.body?.cancel();
    return send(freshToken);
}
