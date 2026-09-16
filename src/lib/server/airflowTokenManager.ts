import { env } from '$env/dynamic/private';
import { jwtDecode } from 'jwt-decode';

type TokenResponse = {
    access_token: string;
    // Some deployments also return the lifetime in seconds.
    expires_in?: number;
};

// Refresh a little before the token actually expires so an in-flight request
// never races the expiry boundary.
const EXPIRY_SKEW_MS = 60 * 1000; // 60 seconds
// Fallback lifetime if the token carries no exp claim and no expires_in.
const DEFAULT_LIFETIME_MS = 50 * 60 * 1000; // 50 minutes
// Hold off after a failed refresh so a fast poll loop cannot hammer the auth endpoint.
const FAILURE_BACKOFF_MS = 10 * 1000; // 10 seconds

const SCOPE = 'airflow/token';

class TokenManager {
    private token: string | null = null;
    private expiry = 0;
    private refresh: Promise<string> | null = null;
    private lastError: Error | null = null;
    private backoffUntil = 0;

    private async fetchToken(): Promise<string> {
        let response: Response;
        try {
            response = await fetch(env.AIRFLOW_AUTH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: env.AIRFLOW_USERNAME,
                    password: env.AIRFLOW_PASSWORD
                })
            });
        } catch (error) {
            // Never leave a stale token behind on a failed refresh.
            this.reset();
            throw new Error(`Failed to reach Airflow token endpoint: ${(error as Error).message}`);
        }

        if (!response.ok) {
            const text = await response.text().catch(() => '<unreadable body>');
            this.reset();
            throw new Error(`Failed to fetch Airflow token: ${response.status} - ${text}`);
        }

        const data = (await response.json()) as TokenResponse;
        if (!data.access_token) {
            this.reset();
            throw new Error('Airflow token endpoint returned no access_token');
        }

        this.token = data.access_token;
        this.expiry = this.computeExpiry(data);
        return this.token;
    }

    /**
     * Derive the cache expiry from the token itself so we refresh in step with
     * the real token lifetime instead of a hardcoded window. Prefers the JWT
     * `exp` claim, falls back to `expires_in`, then a conservative default.
     */
    private computeExpiry(data: TokenResponse): number {
        try {
            const { exp } = jwtDecode(data.access_token) as { exp?: number };
            if (exp) {
                this.logExpirySource('exp claim', exp * 1000);
                return exp * 1000 - EXPIRY_SKEW_MS;
            }
            console.warn(`[${SCOPE}] token decoded but carries no exp claim`);
        } catch {
            console.warn(`[${SCOPE}] token is not a decodable JWT, falling back to a lifetime estimate`);
        }

        if (data.expires_in) {
            this.logExpirySource('expires_in', Date.now() + data.expires_in * 1000);
            return Date.now() + data.expires_in * 1000 - EXPIRY_SKEW_MS;
        }

        this.logExpirySource('default estimate', Date.now() + DEFAULT_LIFETIME_MS);
        return Date.now() + DEFAULT_LIFETIME_MS - EXPIRY_SKEW_MS;
    }

    private logExpirySource(source: string, expiresAt: number): void {
        console.log(
            `[${SCOPE}] token cached from ${source}, expires ${new Date(expiresAt).toISOString()} (in ${Math.round((expiresAt - Date.now()) / 1000)}s)`
        );
    }

    private reset(): void {
        this.token = null;
        this.expiry = 0;
    }

    /**
     * Drop a token Airflow has rejected. Pass the token that failed so a refresh
     * won by another request is not thrown away.
     */
    public invalidate(staleToken?: string): void {
        if (staleToken && this.token !== staleToken) {
            return;
        }
        console.warn(`[${SCOPE}] invalidating cached token after rejection`);
        this.reset();
    }

    public async getToken(): Promise<string> {
        if (this.token && this.expiry > Date.now()) {
            return this.token;
        }

        if (this.lastError && Date.now() < this.backoffUntil) {
            throw this.lastError;
        }

        if (!this.refresh) {
            this.refresh = this.fetchToken()
                .then((token) => {
                    this.lastError = null;
                    this.backoffUntil = 0;
                    return token;
                })
                .catch((error: Error) => {
                    this.lastError = error;
                    this.backoffUntil = Date.now() + FAILURE_BACKOFF_MS;
                    throw error;
                })
                .finally(() => {
                    this.refresh = null;
                });
        }
        return this.refresh;
    }
}

export const airflowTokenManager = new TokenManager();
