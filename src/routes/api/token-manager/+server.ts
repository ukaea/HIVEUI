import { env } from '$env/dynamic/private';

type Credentials = {
    username: string,
    password: string
}

type tokenResponse = {
    access_token: string
}

export class TokenManger {
    private creds: Credentials;
    private token: string | null = null;
    private expiry = 0;
    private refresh: Promise<string> | null = null;

    constructor (creds: Credentials){
        this.creds = creds
    }   


    private async fetchToken(): Promise<string> {
        try {
            const response = await fetch(env.AIRFLOW_AUTH_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(this.creds)
            })

            if (!response.ok) {
                const text = response.text()
                throw new Error (`Failed to fetch token ${response.status} - ${text}`)
            }
            const data = (await response.json()) as tokenResponse

            this.token = data.access_token

            // expiry time set to 50 min.
            this.expiry = Date.now() + 3000 * 1000;
            return this.token

        } catch (error) {
            console.error("Error fetching token:", error)
            throw error
        }
    }

    public async getToken() {
        if (this.token && this.expiry < Date.now()) {
            return this.token;
        }

        if (!this.refresh) {
            // refreshing token.
            this.refresh = this.fetchToken()
        }
        const token = await this.refresh;
        this.refresh = null;

        return this.token;
    }
}

export const airflowTokenManager = new TokenManger(
        {username: env.AIRFLOW_USERNAME, 
        password: env.AIRFLOW_PASSWORD}
        )