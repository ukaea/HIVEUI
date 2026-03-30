import { env } from '$env/dynamic/private';

type TokenResponse = {
    access_token: string;
};

class TokenManager {
    private token: string | null = null;
    private expiry = 0;
    private refresh: Promise<string> | null = null;

    private async fetchToken(): Promise<string> {
        const response = await fetch(env.AIRFLOW_AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: env.AIRFLOW_USERNAME,
                password: env.AIRFLOW_PASSWORD
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to fetch Airflow token: ${response.status} - ${text}`);
        }

        const data = (await response.json()) as TokenResponse;
        this.token = data.access_token;
        this.expiry = Date.now() + 50 * 60 * 1000; // 50 minutes
        return this.token;
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
