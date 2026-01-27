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

let processpath: string | null = null;
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
    async submitPulse(item: T): Promise<T | void> {
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
    }

    /**
     * Fetch post-processed data from a specific filepath.
     */
    async executePostprocess(item: T): Promise<T> {

        const cleanedData = this.config.modelClass.toJSON(item);
        const experimentNumber = item[this.config.experimentField];
        const sampleNumber = item[this.config.sampleField];
        const pulseNumber = item[this.config.idField];

        try {
            const response = await fetch('/api/create-dir', {
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

            const { path } = await response.json();

            // adding postprocess path to pulse metadata
            item.processPath = path;

            await this.submitPulse(item)

        } catch (error) {
            console.error(`Error creating process folder ${this.config.displayName}:`, error);
            throw error;
        }
    }

    async fetchProcessedData(processPath: string): Promise<T | null>{
        try {
            const filename = "processed-metadata"

            // if (!item.processPath) {
            //     // treat as no data for case where the postprocess 
            //     // has not been triggered and path not added to pulse metadata
            //     return null
            // }
            const url = `/api/get-json?endpoint=${encodeURIComponent(processPath)}&id=${encodeURIComponent(filename)}`;
            const response = await fetch(url);

            if (response.status === 404) {
                // File not found / treat as no data. For cause where a pulse is saved but not postprocessing
                return null;
            }

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return this.config.modelClass.fromJSON(data);
        } catch (error) {
            console.error(`Error fetching ${this.config.displayName}:`, error);
            throw new Error(`Failed to load ${this.config.displayName}.`);
        }
    }
    /**
     * Delete a pulse item.
     */
    async delete(item: T): Promise<void> {
        const experimentNumber = item[this.config.experimentField];
        const sampleNumber = item[this.config.sampleField];
        const pulseNumber = item[this.config.idField];

        try {
            const response = await fetch('/api/pulse/delete-pulse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    experimentNumber,
                    sampleNumber,
                    pulseNumber
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to delete ${this.config.displayName}`);
            }
        } catch (error) {
            console.error(`Error deleting ${this.config.displayName}:`, error);
            throw error;
        }
    }
}



export async function great() {
    return null
}