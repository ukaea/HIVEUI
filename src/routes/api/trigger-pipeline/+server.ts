import { json } from '@sveltejs/kit';
import { AIRFLOW_URL, AIRFLOW_DAG_ID, AIRFLOW_USERNAME, AIRFLOW_PASSWORD } from '$env/static/private';

export async function POST({ request }) {
    try {
        const { directory, inputfile } = await request.json();
        const credentials = btoa(`${AIRFLOW_USERNAME}:${AIRFLOW_PASSWORD}`);
        const endpoint = `${AIRFLOW_URL}/api/v1/dags/${AIRFLOW_DAG_ID}/dagRuns`;

        const payload = {
            conf: {
                directory,
                inputfile,
            },
        };

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
                "Authorization": `Basic ${credentials}`
            },
            body: JSON.stringify({}) // empty body, parameters not currently being parsed
            //body: JSON.stringify(payload), 
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
