// $lib/services/GenericDataService.ts


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
export interface GenericTypeConfig<T> {
    modelClass: MetadataModel<T>;
    endpoint: string; // e.g., "/local/configs", "/db/users", or "/remote/metacat/items"
    idField: keyof T;
    displayName: string;
}

/**
 * Configuration for a pulse data type
 */

export interface PulseTypeConfg<T> {
    modelClass: MetadataModel<T>;
    endpoint: string;
    idField: keyof T;
    displayName: string;
    experimentField: keyof T;
    sampleField: keyof T;
    isPulse: boolean;
}

type DataTypeConfig<T> = GenericTypeConfig<T> | PulseTypeConfg<T>;

/**
 * Generic data service for CRUD operations using unified backend gateways
 */
export class GenericDataService<T> {
    private config: DataTypeConfig<T>;

    constructor(config: DataTypeConfig<T>) {
        this.config = config;
    }

    /**
     * Fetch items. Handles files, folders, DB rows, or Remote API responses
     * based on the config.endpoint prefix.
     */
    async fetchAll(sortHandler?: (a: T, b: T) => number): Promise<T[]> {
        try {
            let url: string;

            if ("isPulse" in this.config) {
                url = `/api/get-json?endpoint=${encodeURIComponent(this.config.endpoint)}` +
                    `&isPulse=${encodeURIComponent(this.config.isPulse)}&target=${encodeURIComponent(this.config.displayName)}`;
            } else {
                url = `/api/get-json?endpoint=${encodeURIComponent(this.config.endpoint)}`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // The backend might return a single object (if a specific file was requested)
            // or an array (if a folder, table, or remote list was requested).
            const rawItems = Array.isArray(data) ? data : [data];

            // Hydrate raw JSON into Model instances
            const items = await Promise.all(
                rawItems.map((json: any) => this.config.modelClass.fromJSON(json))
            );

            return sortHandler ? items.sort(sortHandler) : items;
        } catch (error) {
            console.error(`Error fetching ${this.config.displayName}:`, error);
            throw new Error(`Failed to load ${this.config.displayName}.`);
        }
    }

    async fetchOne(id: string): Promise<T> {
        try {
            const url = `/api/get-json?endpoint=${encodeURIComponent(this.config.endpoint)}&id=${encodeURIComponent(id)}` +
                        `&target=${encodeURIComponent(this.config.displayName)}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return this.config.modelClass.fromJSON(data);
        } catch (error) {
            console.error(`Error fetching ${this.config.displayName} with ID ${id}:`, error);
            throw new Error(`Failed to load ${this.config.displayName} with ID ${id}.`);
        }
    }

    /**
     * Submit (create or update) an item.
     */
    async submit(item: T): Promise<void> {
        const id = item[this.config.idField];
        if (!id) throw new Error(`${String(this.config.idField)} is required.`);

        const cleanedData = this.config.modelClass.toJSON(item);

        // For Local storage, we ensure the path points to a specific .json file
        let targetPath = this.config.endpoint;
        if (targetPath.startsWith('/local/') && !targetPath.endsWith('.json')) {
            targetPath = `${targetPath.replace(/\/$/, '')}/${id}.json`;
        }

        try {
            const response = await fetch('/api/save-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetPath: targetPath,
                    metadata: cleanedData,
                    target: this.config.displayName
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Save failed');
            }
        } catch (error) {
            console.error(`Error saving ${this.config.displayName}:`, error);
            throw error;
        }
    }

    async submitPulse(item: T, postProcess:boolean=false) {
        const id = item[this.config.idField];
        if (!("isPulse" in this.config)) {
            throw new Error("Cann only save Pulse metadata")
        };

        const cleanedData = this.config.modelClass.toJSON(item);

        // For Local pulse storage, add the expNumber, sampleNumber, pulseNumber to dir path
        const experimentDir = `E-${item[this.config.experimentField]}`;
        const sampleDir = `S-${item[this.config.sampleField]}`;
        const pulseDir = `P-${item[this.config.idField]}`;

        let pulseTargetPath = `${this.config.endpoint}${experimentDir}/${sampleDir}/${pulseDir}/raw`

        if (pulseTargetPath.startsWith('/local/') && !pulseTargetPath.endsWith('.json')) {
            pulseTargetPath = `${pulseTargetPath.replace(/\/$/, '')}/manual-metadata.json`;
        }

        try {
            const response = await fetch('/api/save-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetPath: pulseTargetPath,
                    metadata: cleanedData,
                    target: this.config.displayName
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Save failed');
            }
        } catch (error) {
            console.error(`Error saving ${this.config.displayName}:`, error);
            throw error;
        }
        
        if (postProcess) {
            const processedTargetPath = `${this.config.endpoint}${experimentDir}/${sampleDir}/${pulseDir}/processed/`;

            try {
                const resp = await fetch('/api/create-dir', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetPath: processedTargetPath })
                });
                const { processPath } = await resp.json();
                // processpath (directory to save postprocessed file) will be passed to airflow pipeline
                

                const postProcessData = await this.fetchPostProcessData(processPath);
                return this.config.modelClass.fromJSON(postProcessData);
            } catch (error) {
            console.error(`Error executing postprocessing.`, error);
            throw new Error(`Failed to execute postprocessing.`);
            }
        }
    }

    async fetchPostProcessData(filepath: string): Promise<T> {

        if (!filepath) {
            throw new Error("Must supply filepath")
        };
        const id = "manual-metadata";
        const url = `/api/get-json?endpoint=${encodeURIComponent(filepath)}&id=${encodeURIComponent(id)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data
    }

    /**
     * Delete an item. 
     */
    async delete(item: T): Promise<void> {
        const id = item[this.config.idField];
        let targetPath = this.config.endpoint;
        
        // Ensure path resolves to the specific file for local cleanup
        if (targetPath.startsWith('/local/') && !targetPath.endsWith('.json')) {
            targetPath = `${targetPath.replace(/\/$/, '')}/${id}.json`;
        }

        try {
            const response = await fetch('/api/delete-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    targetPath,
                    id // ID is provided for DB/Remote identification
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to delete ${this.config.displayName}`);
            }
        } catch (error) {
            console.error(`Error deleting ${this.config.displayName}:`, error);
            throw error;
        }
    }
}