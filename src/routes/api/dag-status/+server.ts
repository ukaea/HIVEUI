import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
    const dagRunId = url.searchParams.get('dagRunId');

    if (!dagRunId) {
        return json({ error: 'dagRunId is required' }, { status: 400 });
    }

    try {
        const credentials = btoa(`${env.AIRFLOW_USERNAME}:${env.AIRFLOW_PASSWORD}`);
        const endpoint = `${env.AIRFLOW_URL}/api/v1/dags/${env.AIRFLOW_DAG_ID}/dagRuns/${dagRunId}`;

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'Authorization': `Basic ${credentials}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch DAG status: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return json(data);
    } catch (error) {
        console.error('Error fetching DAG status:', error);
        return json({ error: (error as Error).message }, { status: 500 });
    }
};
