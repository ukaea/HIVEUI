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

class TokenManager {
    private token: string | null = null;
    private expiry = 0;
    private refresh: Promise<string> | null = null;

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
            this.token = null;
            this.expiry = 0;
            throw new Error(`Failed to reach Airflow token endpoint: ${(error as Error).message}`);
        }

        if (!response.ok) {
            const text = await response.text().catch(() => '<unreadable body>');
            this.token = null;
            this.expiry = 0;
            throw new Error(`Failed to fetch Airflow token: ${response.status} - ${text}`);
        }

        const data = (await response.json()) as TokenResponse;
        if (!data.access_token) {
            this.token = null;
            this.expiry = 0;
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
                return exp * 1000 - EXPIRY_SKEW_MS;
            }
        } catch {
            // Not a decodable JWT (or opaque token) - fall through.
        }

        if (data.expires_in) {
            return Date.now() + data.expires_in * 1000 - EXPIRY_SKEW_MS;
        }

        return Date.now() + DEFAULT_LIFETIME_MS - EXPIRY_SKEW_MS;
    }

    public async getToken(): Promise<string> {
        if (this.token && this.expiry > Date.now()) {
            return this.token;
        }

        if (!this.refresh) {
            this.refresh = this.fetchToken().finally(() => {
                this.refresh = null;
            });
        }
        return this.refresh;
    }
}

export const airflowTokenManager = new TokenManager();
