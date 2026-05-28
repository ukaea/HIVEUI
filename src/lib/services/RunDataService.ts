import { RunMetadata } from '$lib/models/RunMetadata';
import { PulseAnnotation } from '$lib/models/PulseAnnotation';
import { ProcessMetadata } from '$lib/models/ProcessingMetadata';

export class RunDataService {

    // ─── Run endpoints (local disk) ─────────────────────────────────────
    // Runs contain top-level metadata and are persisted to the local filesystem.

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

    async saveRun(run: RunMetadata): Promise<void> {
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

    // ─── Pulse endpoints (local disk + data catalogue) ──────────────────
    // Pulses combine top-level run metadata, post-processing results from
    // the Airflow DAG, and the user's pulse annotation. The compiled pulse
    // JSON is what gets sent to the backend data catalogue during ingestion.

    async fetchPulses(experimentNumber: number, sampleNumber: number, runNumber: number): Promise<PulseAnnotation[]> {
        try {
            const params = new URLSearchParams({
                experimentNumber: String(experimentNumber),
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
        experimentNumber: number,
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

    async fetchProcessedData(
        experimentNumber: number,
        sampleNumber: number,
        runNumber: number,
        pulseNumber: number
    ): Promise<ProcessMetadata[]> {
        try {
            const params = new URLSearchParams({
                experimentNumber: String(experimentNumber),
                sampleNumber: String(sampleNumber),
                runNumber: String(runNumber),
                pulseNumber: String(pulseNumber)
            });

            const response = await fetch(`/api/run/get-processed-data?${params}`);

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const rawItems = Array.isArray(data) ? data : [data];
            return rawItems.map((json: any) => ProcessMetadata.fromJSON(json));
        } catch (error) {
            console.error('Error fetching processed data:', error);
            throw new Error('Failed to load processed data.');
        }
    }

    async triggerPostprocess(
        experimentNumber: number,
        sampleNumber: number,
        runNumber: number
    ): Promise<{ dag_run_id: string }> {
        try {
            const response = await fetch('/api/airflow/postprocess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ experimentNumber, sampleNumber, runNumber })
            });

            if (!response.ok) {
                throw new Error(`Failed to trigger postprocess DAG: ${response.status} ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error triggering postprocess DAG:', error);
            throw error;
        }
    }

    async seedTestData(
        experimentNumber: number,
        sampleNumber: number,
        runNumber: number,
        pulseCount: number = 3,
        sequenceCount: number = 2
    ): Promise<{ pulseCount: number; sequenceCount: number }> {
        try {
            const response = await fetch('/api/run/seed-test-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    experimentNumber,
                    sampleNumber,
                    runNumber,
                    pulseCount,
                    sequenceCount
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Seed test data failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Error seeding test data:', error);
            throw error;
        }
    }

    async ingestToDataCatalogue(
        runMetadata: RunMetadata,
        pulsesMetadata: Array<{ annotation: any; processedData: any }>
    ): Promise<{ dag_run_id?: string; testMode?: boolean }> {
        try {
            const response = await fetch('/api/airflow/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    runMetadata: RunMetadata.toJSON(runMetadata),
                    pulsesMetadata
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Ingestion failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Error ingesting to Data Catalogue:', error);
            throw error;
        }
    }
}
