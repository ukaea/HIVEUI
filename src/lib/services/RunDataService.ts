import { RunMetadata } from '$lib/models/RunMetadata';
import { PulseAnnotation } from '$lib/models/PulseAnnotation';

export class RunDataService {
    async fetchAll(sortHandler?: (a: RunMetadata, b: RunMetadata) => number): Promise<RunMetadata[]> {
        try {
            const response = await fetch('/api/run/get-runs');

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const rawItems = Array.isArray(data) ? data : [data];
            const items = rawItems.map((json: any) => RunMetadata.fromJSON(json));

            return sortHandler ? items.sort(sortHandler) : items;
        } catch (error) {
            console.error('Error fetching runs:', error);
            throw new Error('Failed to load runs.');
        }
    }

    async submitRun(run: RunMetadata): Promise<void> {
        const cleanedData = RunMetadata.toJSON(run);

        try {
            const response = await fetch('/api/run/save-run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    experimentNumber: run.experimentNumber,
                    sampleNumber: run.sampleNumber,
                    runNumber: run.runNumber,
                    metadata: cleanedData
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Save failed');
            }
        } catch (error) {
            console.error('Error saving run:', error);
            throw error;
        }
    }

    async delete(run: RunMetadata): Promise<void> {
        try {
            const response = await fetch('/api/run/delete-run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    experimentNumber: run.experimentNumber,
                    sampleNumber: run.sampleNumber,
                    runNumber: run.runNumber
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to delete run');
            }
        } catch (error) {
            console.error('Error deleting run:', error);
            throw error;
        }
    }

    async fetchPulses(experimentNumber: string, sampleNumber: number, runNumber: number): Promise<PulseAnnotation[]> {
        try {
            const params = new URLSearchParams({
                experimentNumber,
                sampleNumber: String(sampleNumber),
                runNumber: String(runNumber)
            });

            const response = await fetch(`/api/run/get-pulses?${params}`);

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const rawItems = Array.isArray(data) ? data : [data];
            return rawItems.map((json: any) => PulseAnnotation.fromJSON(json));
        } catch (error) {
            console.error('Error fetching pulses:', error);
            throw new Error('Failed to load pulses.');
        }
    }

    async savePulseAnnotation(
        experimentNumber: string,
        sampleNumber: number,
        runNumber: number,
        annotation: PulseAnnotation
    ): Promise<void> {
        const cleanedData = PulseAnnotation.toJSON(annotation);

        try {
            const response = await fetch('/api/run/save-pulse-annotation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    experimentNumber,
                    sampleNumber,
                    runNumber,
                    pulseNumber: annotation.pulseNumber,
                    annotation: cleanedData
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Save annotation failed');
            }
        } catch (error) {
            console.error('Error saving pulse annotation:', error);
            throw error;
        }
    }
}
