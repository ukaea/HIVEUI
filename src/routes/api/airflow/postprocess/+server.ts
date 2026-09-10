import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { airflowTokenManager } from '$lib/server/airflowTokenManager';

const SCOPE = 'airflow/postprocess';

export async function POST({ request }) {
    const startedAt = Date.now();
    try {
        const body = await request.json();
        const { experimentNumber, sampleNumber, runNumber } = body;

        console.log(
            `[${SCOPE}] request E-${experimentNumber}/S-${sampleNumber}/R-${runNumber}`
        );

        if (!env.AIRFLOW_URL || !env.AIRFLOW_POSTPROCESSING_DAG_ID) {
            console.error(
                `[${SCOPE}] missing config AIRFLOW_URL=${env.AIRFLOW_URL ? 'set' : 'unset'} AIRFLOW_POSTPROCESSING_DAG_ID=${env.AIRFLOW_POSTPROCESSING_DAG_ID ? 'set' : 'unset'}`
            );
            throw new Error('Airflow postprocessing is not configured');
        }

        const endpoint = `${env.AIRFLOW_URL}/api/v2/dags/${env.AIRFLOW_POSTPROCESSING_DAG_ID}/dagRuns`;

        console.log(`[${SCOPE}] requesting Airflow token`);
        const token = await airflowTokenManager.getToken();
        console.log(`[${SCOPE}] token acquired`);

        const payload = {
            logical_date: new Date().toISOString(),
            conf: {
                'exp-number': String(experimentNumber),
                'sample-number': String(sampleNumber),
                'run-number': String(runNumber)
            }
        };

        console.log(`[${SCOPE}] triggering DAG endpoint=${endpoint} payload:`, JSON.stringify(payload));

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload),
        });

        console.log(`[${SCOPE}] Airflow responded ${response.status} ${response.statusText} in ${Date.now() - startedAt}ms`);

        if (!response.ok) {
            const errorBody = await response.text().catch(() => '<unreadable body>');
            console.error(`[${SCOPE}] DAG trigger failed (${response.status}):`, errorBody);
            throw new Error(`Failed to trigger DAG: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(
            `[${SCOPE}] DAG triggered dag_run_id=${data?.dag_run_id ?? 'unknown'} state=${data?.state ?? 'unknown'} total=${Date.now() - startedAt}ms`
        );
        return json(data);
    } catch (error) {
        console.error(`[${SCOPE}] error triggering DAG after ${Date.now() - startedAt}ms:`, error);
        return json({ error: (error as Error).message }, { status: 500 });
    }
}
