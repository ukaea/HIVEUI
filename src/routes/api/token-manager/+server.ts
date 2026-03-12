import { env } from '$env/dynamic/private';


type Credentials = {
    username: string,
    password: string
}

type tokenResponse = {
    access_token: string
}

export class TokenManger {
    private static instance: TokenManger;
    private creds: Credentials;
    private token: string | null = null;
    private expiry = 0;

    private constructor (creds: Credentials){
        this.creds = creds
    }   

    public static getInstance (creds: Credentials): TokenManger {
        if (!TokenManger.instance) {
            if (!creds) {
                throw new Error("Token Manger requires credentials")
            }
            TokenManger.instance = new TokenManger(creds)
        }
        return TokenManger.instance
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
            this.expiry = Date.now() + 600 * 1000;
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
        const token = await this.fetchToken();
        return this.token;
    }
}