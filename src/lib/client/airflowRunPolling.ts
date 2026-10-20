export interface DAGStatus {
    dag_run_id: string;
    state: string;
    execution_date: string;
    start_date: string;
    end_date: string | null;
}

export async function pollDAGStatus(dagRunId: string, dagType: 'postprocessing' | 'ingest' = 'postprocessing'): Promise<DAGStatus> {
    const response = await fetch(`/api/airflow/run-status?dagRunId=${encodeURIComponent(dagRunId)}&dagType=${dagType}`);

    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Failed to fetch DAG status: ${response.status} ${response.statusText}`);
    }

    const dagResponse = (await response.json()) as DAGStatus
    return dagResponse;
}

export async function waitForDAGCompletion(
    dagRunId: string,
    intervalMs: number = 5000,
    timeoutMs: number = 10 * 60 * 1000,
    dagType: 'postprocessing' | 'ingest' = 'postprocessing',
    onStatusUpdate?: (status: DAGStatus) => void,
    signal?: AbortSignal
): Promise<DAGStatus> {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        let timer: ReturnType<typeof setTimeout> | undefined;

        signal?.addEventListener(
            'abort',
            () => {
                clearTimeout(timer);
                reject(new Error('DAG polling cancelled'));
            },
            { once: true }
        );

        const poll = async () => {
            try {
                const status = await pollDAGStatus(dagRunId, dagType);
                if (signal?.aborted) {
                    return;
                }
                if (onStatusUpdate) {
                    onStatusUpdate(status);
                }

                if (status.state === 'success') {
                    resolve(status);
                } else if (status.state === 'failed') {
                    reject(new Error('DAG run failed'));
                } else if (Date.now() - start > timeoutMs) {
                    reject(new Error(`Timeout waiting for DAG: ${dagRunId}, last_state=${status.state}`));
                } else {
                    timer = setTimeout(poll, intervalMs);
                }
            } catch (err) {
                reject(err);
            }
        };

        poll();
    });
}
