// $lib/services/PulseDataService.ts

import type { MetadataModel } from './GenericDataService';

/**
 * Configuration for a pulse data type
 */
export interface PulseTypeConfig<T> {
    modelClass: MetadataModel<T>;
    endpoint: string;
    idField: keyof T;
    displayName: string;
    experimentField: keyof T;
    sampleField: keyof T;
    isPulse: boolean;
}

/**
 * Pulse-specific data service for CRUD operations on pulse metadata
 */
export class PulseDataService<T> {
    private config: PulseTypeConfig<T>;

    constructor(config: PulseTypeConfig<T>) {
        this.config = config;
    }

    /**
     * Fetch all pulse items. Handles the pulse-specific directory traversal.
     */
    async fetchAll(sortHandler?: (a: T, b: T) => number): Promise<T[]> {
        try {
            const url = `/api/pulse/get-pulse?endpoint=${encodeURIComponent(this.config.endpoint)}`;

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            const rawItems = Array.isArray(data) ? data : [data];

            const items = await Promise.all(
                rawItems.map((json: any) => this.config.modelClass.fromJSON(json))
            );

            return sortHandler ? items.sort(sortHandler) : items;
        } catch (error) {
            console.error(`Error fetching ${this.config.displayName}:`, error);
            throw new Error(`Failed to load ${this.config.displayName}.`);
        }
    }

    /**
     * Fetch a single pulse item by id.
     */
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
     * Submit pulse metadata with optional post-processing.
     */
    async submitPulse(item: T, postProcess: boolean = false): Promise<T | void> {
        const cleanedData = this.config.modelClass.toJSON(item);

        const experimentNumber = item[this.config.experimentField];
        const sampleNumber = item[this.config.sampleField];
        const pulseNumber = item[this.config.idField];

        try {
            const response = await fetch('/api/pulse/save-pulse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    experimentNumber,
                    sampleNumber,
                    pulseNumber,
                    metadata: cleanedData
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
            const experimentDir = `E-${experimentNumber}`;
            const sampleDir = `S-${sampleNumber}`;
            const pulseDir = `P-${pulseNumber}`;
            const processedTargetPath = `${this.config.endpoint}${experimentDir}/${sampleDir}/${pulseDir}/processed/`;

            try {
                const resp = await fetch('/api/create-dir', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ targetPath: processedTargetPath })
                });
                const { processPath } = await resp.json();

                const postProcessData = await this.fetchPostProcessData(processPath);
                return this.config.modelClass.fromJSON(postProcessData);
            } catch (error) {
                console.error(`Error executing postprocessing.`, error);
                throw new Error(`Failed to execute postprocessing.`);
            }
        }
    }

    /**
     * Fetch post-processed data from a specific filepath.
     */
    async fetchPostProcessData(filepath: string): Promise<T> {
        if (!filepath) {
            throw new Error("Must supply filepath");
        }
        const id = "manual-metadata";
        const url = `/api/get-json?endpoint=${encodeURIComponent(filepath)}&id=${encodeURIComponent(id)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    }

    /**
     * Delete a pulse item.
     */
    async delete(item: T): Promise<void> {
        const id = item[this.config.idField];

        const experimentDir = `E-${item[this.config.experimentField]}`;
        const sampleDir = `S-${item[this.config.sampleField]}`;
        const pulseDir = `P-${item[this.config.idField]}`;

        let targetPath = `${this.config.endpoint}${experimentDir}/${sampleDir}/${pulseDir}/raw/manual-metadata.json`;

        try {
            const response = await fetch('/api/delete-json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetPath,
                    id
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
