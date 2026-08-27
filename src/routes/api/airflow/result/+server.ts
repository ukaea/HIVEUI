import { env } from '$env/dynamic/private';
import { json, type RequestHandler } from '@sveltejs/kit';
import { airflowTokenManager } from '$lib/server/airflowTokenManager';

const DATA_TYPE_CONFIG: Record<string, { dagIdEnvKey: keyof typeof env; taskIdEnvKey: keyof typeof env }> = {
    postprocessing: {
        dagIdEnvKey: 'AIRFLOW_POSTPROCESSING_DAG_ID',
        taskIdEnvKey: 'AIRFLOW_POSTPROCESSING_TASK_ID'
    },
    ingest: {
        dagIdEnvKey: 'AIRFLOW_INGEST_DAG_ID',
        taskIdEnvKey: 'AIRFLOW_INGEST_TASK_ID'
    }
};

export const GET: RequestHandler = async ({ url }) => {
    const dagRunId = url.searchParams.get('dagRunId');
    const type = url.searchParams.get('type');
    const xcomKey = url.searchParams.get('xcomKey') ?? 'return_value';

    if (!dagRunId) {
        return json({ error: 'dagRunId is required' }, { status: 400 });
    }

    if (!type) {
        return json({ error: 'type is required' }, { status: 400 });
    }

    const config = DATA_TYPE_CONFIG[type];
    if (!config) {
        return json({ error: `Unknown type: ${type}` }, { status: 400 });
    }

    try {
        const dagId = env[config.dagIdEnvKey];
        const taskId = url.searchParams.get('taskId') ?? env[config.taskIdEnvKey];

        if (!dagId || !taskId) {
            return json(
                { error: `Missing Airflow config for type "${type}": ${config.dagIdEnvKey} and ${config.taskIdEnvKey} must be set` },
                { status: 500 }
            );
        }

        const endpoint = `${env.AIRFLOW_URL}/api/v2/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/xcomEntries/${xcomKey}`;
        const token = await airflowTokenManager.getToken();

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
        }

        const raw = await response.json();
        // Airflow wraps the value in { value: ... }
        console.log('Fetched data from Airflow:', raw);
        const data = typeof raw.value === 'string'
            ? JSON.parse(raw.value)
            : raw.value;

        console.log('Parsed data:', data);
        return json(data);
    } catch (error) {
        console.error('Error fetching airflow data:', error);
        return json({ error: (error as Error).message }, { status: 500 });
    }
};
