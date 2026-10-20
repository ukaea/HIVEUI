import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { airflowFetch } from '$lib/server/airflowFetch';

const SCOPE = 'airflow/cancel';

// Airflow has no dedicated "cancel" for a DAG run; marking it failed stops
// queued tasks from being scheduled and terminates the running ones.
export const POST: RequestHandler = async ({ request }) => {
    try {
        const { dagRunId } = await request.json();

        if (!dagRunId) {
            return json({ error: 'dagRunId is required' }, { status: 400 });
        }

        if (!env.AIRFLOW_URL || !env.AIRFLOW_POSTPROCESSING_DAG_ID) {
            throw new Error('Airflow postprocessing is not configured');
        }

        const endpoint = `${env.AIRFLOW_URL}/api/v2/dags/${encodeURIComponent(env.AIRFLOW_POSTPROCESSING_DAG_ID)}/dagRuns/${encodeURIComponent(dagRunId)}`;

        console.log(`[${SCOPE}] marking dag_run_id=${dagRunId} as failed`);

        const response = await airflowFetch(endpoint, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ state: 'failed' })
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '<unreadable body>');
            console.error(`[${SCOPE}] cancel failed (${response.status}):`, errorBody);
            throw new Error(`Failed to cancel DAG run: ${response.status} ${response.statusText}`);
        }

        return json(await response.json());
    } catch (error) {
        console.error(`[${SCOPE}] error cancelling DAG run:`, error);
        return json({ error: (error as Error).message }, { status: 500 });
    }
};
