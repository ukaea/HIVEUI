import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { airflowTokenManager } from '$lib/server/airflowTokenManager';

export async function POST({ request }) {
    try {
        const body = await request.json();
        const { experimentNumber, sampleNumber, runNumber } = body;
        const endpoint = `${env.AIRFLOW_URL}/api/v2/dags/${env.AIRFLOW_POSTPROCESSING_DAG_ID}/dagRuns`;
        const token = await airflowTokenManager.getToken();

        const payload = {
            conf: {
                'exp-number': String(experimentNumber),
                'sample-number': String(sampleNumber),
                'run-number': String(runNumber)
            }
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Failed to trigger DAG: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return json(data);
    } catch (error) {
        console.error('Error triggering DAG:', error);
        return json({ error: (error as Error).message }, { status: 500 });
    }
}
