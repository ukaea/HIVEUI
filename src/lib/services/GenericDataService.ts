// $lib/services/GenericDataService.ts
import { authClient } from '$lib/auth-client';

const session = authClient.useSession();

/**
 * Interface that all metadata models must implement
 */
export interface MetadataModel<T> {
    fromJSON(json: any): T | Promise<T>;
    toJSON(instance: T): any;
}

/**
 * Configuration for a specific data type
 */
export interface DataTypeConfig<T> {
    modelClass: MetadataModel<T>;
    endpoint: string;
    idField: keyof T;
    displayName: string;
}

/**
 * Generic data service for CRUD operations
 */
export class GenericDataService<T> {
    private config: DataTypeConfig<T>;

    constructor(config: DataTypeConfig<T>) {
        this.config = config;
    }

    /**
     * Fetch all items
     */
    async fetchAll(
        localOnly: boolean,
        sortHandler?: (a: T, b: T) => number
    ): Promise<T[]> {
        try {
            if (localOnly) {
                return await this.fetchLocal(sortHandler);
            }

            // if (session.data == null) {
            //     throw new Error('Session is required for remote fetch');
            // }

            return await this.fetchRemote(sortHandler);
        } catch (error) {
            console.error(`Error fetching ${this.config.displayName}:`, error);
            throw new Error(`Failed to load ${this.config.displayName}. Please try again later.`);
        }
    }

    /**
     * Fetch from local files
     */
    private async fetchLocal(sortHandler?: (a: T, b: T) => number): Promise<T[]> {
        const request = await fetch(`/api/get-json?endpoint=${encodeURIComponent(this.config.endpoint)}`)
        const data = await request.json();
        const items = await Promise.all(
            data.map((json: any) => this.config.modelClass.fromJSON(json))
        );

        return sortHandler ? items.sort(sortHandler) : items;
    }

    /**
     * Fetch from remote API
     */
    private async fetchRemote(
        sortHandler?: (a: T, b: T) => number
    ): Promise<T[]> {
        //const accessToken = session.value.data?.user.accessToken;
        // if (!accessToken) {
        //     throw new Error('No access token available');
        // }

        const accessToken = "dummy-access-token"; // Placeholder for demonstration

        const fullRemoteUrl = `${this.apiBaseUrl}${this.config.endpoint}`;
        console.log(`Fetching remote data from: ${fullRemoteUrl}`);
        const proxyUrl = `/api/get-remote?requestURL=${encodeURIComponent(fullRemoteUrl)}`;

        // 3. Call the SvelteKit Server Endpoint
        const response = await fetch(proxyUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch ${this.config.displayName}`);
        }

        const data = await response.json();

        // 4. Hydrate classes on the client
        const items = await Promise.all(
            data.map((json: any) => this.config.modelClass.fromJSON(json))
        );

        return sortHandler ? items.sort(sortHandler) : items;
    }

    /**
     * Submit (create or update) an item
     */
    async submit(
        item: T,
        localOnly: boolean,
        isNewEntry: boolean
    ): Promise<void> {
        const id = item[this.config.idField];
        if (!id) {
            throw new Error(`${String(this.config.idField)} is required.`);
        }

        console.log(`Submitting ${this.config.displayName}:`, item);

        try {
            await this.handleFileSubmission(item);
        } catch (error) {
            console.error('File submission failed:', error);
            throw error;
        }

        if (!localOnly) {
            try {
                if (!$session.data) {
                    throw new Error('Session is required for remote submission');
                }
                await this.handleAPISubmission(item, isNewEntry);
            } catch (error) {
                console.error('API submission failed:', error);
                throw error;
            }
        }
    }

    /**
     * Save to local file
     */
    private async handleFileSubmission(item: T): Promise<void> {
        try {
            const id = item[this.config.idField];
            const filePath = `${this.rootFolderLocation}/${this.config.localFolder}/`;
            const fileName = `${id}.json`;
            const cleanedData = this.config.modelClass.toJSON(item);

            const saveData = {
                targetPath: `${filePath}${fileName}`,
                metadata: cleanedData
            };

            const response = await fetch('/api/save-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to save file: ${errorData.message}`);
            }

            console.log(`${this.config.displayName} file saved successfully`);
        } catch (error) {
            console.error(`Error saving ${this.config.displayName} file:`, error);
            throw error;
        }
    }

    /**
     * Submit to remote API
     */
    private async handleAPISubmission(
        item: T,
        isNewEntry: boolean
    ): Promise<void> {
        try {
            const accessToken = $session.data?.user.accessToken;
            if (!accessToken) {
                throw new Error('No access token available');
            }

            const mappedData = this.config.modelClass.toJSON(item);
            const url = `${this.apiBaseUrl}${this.config.endpoint}?schema=any`;
            const method = 'POST'; // Both create and update use POST

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify(mappedData)
            });

            if (!response.ok) {
                throw new Error(`Failed to save ${this.config.displayName} to endpoint`);
            }

            console.log(`${this.config.displayName} submitted to API successfully`);
        } catch (error) {
            console.error(`Error submitting ${this.config.displayName} to API:`, error);
            throw error;
        }
    }

    /**
     * Delete an item
     */
    async delete(
        item: T,
        localOnly: boolean,
    ): Promise<void> {
        const id = item[this.config.idField];

        if (localOnly) {
            await this.deleteLocal(id as string);
        } else {
            await this.deleteRemote(id as string);
        }
    }

    /**
     * Delete local file
     */
    private async deleteLocal(id: string): Promise<void> {
        const filePath = `${this.rootFolderLocation}/${this.config.localFolder}/${id}.json`;

        const response = await fetch('/api/delete-json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetPath: filePath })
        });

        if (!response.ok) {
            throw new Error('Failed to delete local file');
        }
    }

    /**
     * Delete from remote API
     */
    private async deleteRemote(id: string): Promise<void> {
        const accessToken = $session.data?.user.accessToken;
        if (!accessToken) {
            throw new Error('No access token available');
        }

        const response = await fetch(`${this.apiBaseUrl}${this.config.endpoint}/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            throw new Error(`Failed to delete ${this.config.displayName} from API`);
        }
    }
}