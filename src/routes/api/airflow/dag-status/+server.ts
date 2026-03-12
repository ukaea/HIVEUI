import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { airflowTokenManager } from '../../token-manager/+server';
import type { RequestHandler } from './$types';


// type dagState = "queued" | "running" | "success" | "failed" | "up_for_retry" 
//                 | "up_for_reschedule" | "paused" | "none";

// type dagStateRespponse = {
//       dag_run_id: string,
//       dag_id: string,
//       duration: string,
//       state: dagState,
// }

export const GET: RequestHandler = async ({ url }) => {
    const dagRunId = url.searchParams.get('dagRunId');
    const intervalMs = 5000;
    const timeoutMs = 10 * 60 * 1000;
    const start = Date.now();
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    if (!dagRunId) {
        return json({ error: 'dagRunId is required' }, { status: 400 });
    }

    try {
        const endpoint = `${env.AIRFLOW_URL}/api/v1/dags/${env.AIRFLOW_DAG_ID}/dagRuns/${dagRunId}`;
        const token = airflowTokenManager.getToken()
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'Authorization': `Basic ${token}`
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch DAG status: ${response.status} ${response.statusText}`);
        }
        const dagData = (await response.json()) 
        if (dagData.state === "success" || dagData.state === "failed" ) {
            return dagData
        }

        if (Date.now() - start > timeoutMs) {
            throw new Error(
                `Timeout waiting for DAG run ${dagData.dag_run_id}, last_state=${dagData.state}`
            )
        }
        await sleep(intervalMs)

    } catch (error) {
        console.error('Error fetching DAG status:', error);
        return json({ error: (error as Error).message }, { status: 500 });
    }
};