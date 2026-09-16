import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { airflowFetch } from '$lib/server/airflowFetch';


export const GET: RequestHandler = async ({ url }) => {
    const dagRunId = url.searchParams.get('dagRunId');
    const dagType = url.searchParams.get('dagType') || 'postprocessing';

    if (!dagRunId) {
        return json({ error: 'dagRunId is required' }, { status: 400 });
    }

    try {
        const dagId = dagType === 'ingest' ? env.AIRFLOW_INGEST_DAG_ID : env.AIRFLOW_POSTPROCESSING_DAG_ID;
        const endpoint = `${env.AIRFLOW_URL}/api/v2/dags/${dagId}/dagRuns/${dagRunId}`;
        const response = await airflowFetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch DAG status: ${response.status} ${response.statusText}`);
        }

        const dagData = await response.json();
        return json(dagData);
    } catch (error) {
        console.error('Error fetching DAG status:', error);
        return json({ error: (error as Error).message }, { status: 500 });
    }
};
