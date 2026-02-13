import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function POST({ request }) {
    try {
        const body = await request.json();
        const { directory, inputfile, experimentNumber, sampleNumber, runNumber } = body;
        const credentials = btoa(`${env.AIRFLOW_USERNAME}:${env.AIRFLOW_PASSWORD}`);
        const endpoint = `${env.AIRFLOW_URL}/api/v1/dags/${env.AIRFLOW_DAG_ID}/dagRuns`;

        const payload = {
            conf: {
                directory,
                inputfile,
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
                "Authorization": `Basic ${credentials}`
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
