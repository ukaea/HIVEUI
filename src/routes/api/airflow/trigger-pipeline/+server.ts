import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { airflowTokenManager } from '../../token-manager/+server.js';

export async function POST({ request }) {
    try {
        const body = await request.json();
        const { experimentNumber, sampleNumber, runNumber } = body;
        const endpoint = `${env.AIRFLOW_URL}/api/v1/dags/${env.AIRFLOW_DAG_ID}/dagRuns`;

        const token = airflowTokenManager.getToken()

        const payload = {
            conf: {
                directory: env.AIRFLOW_DIRECTORY,
                inputfile: env.AIRFLOW_INPUT_FILE,
                ...(experimentNumber && { experimentNumber }),
                ...(sampleNumber && { sampleNumber }),
                ...(runNumber && { runNumber }),
            },
        };

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
                "Authorization": `Basic ${token}`
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Failed to trigger DAG: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return json(data);
    } catch (error) {
        console.error("Error triggering DAG:", error);
        return json({ error: (error as Error).message }, { status: 500 });
    }
}
