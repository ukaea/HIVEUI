export interface DAGStatus {
    dag_run_id: string;
    state: string;
    execution_date: string;
    start_date: string;
    end_date: string | null;
}

export async function pollDAGStatus(dagRunId: string): Promise<DAGStatus> {
    const response = await fetch(`/api/airflow/dag-status?dagRunId=${encodeURIComponent(dagRunId)}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch DAG status: ${response.status} ${response.statusText}`);
    }

    const dagResponse = (await response.json()) as DAGStatus
    return dagResponse;
}

export async function waitForDAGCompletion(
    dagRunId: string,
    intervalMs: number = 5000,
    timeoutMs: number = 10 * 60 * 1000,
    onStatusUpdate?: (status: DAGStatus) => void
): Promise<DAGStatus> {
    return new Promise((resolve, reject) => {
        const poll = async () => {
            const start = Date.now()
            try {
                const status = await pollDAGStatus(dagRunId);
                if (onStatusUpdate) {
                    onStatusUpdate(status);
                }

                if (status.state === 'success') {
                    resolve(status);
                } else if (status.state === 'failed') {
                    reject(new Error('DAG run failed'));
                } else if (Date.now() - start > timeoutMs){
                    reject(new Error(`Timeout waiting for Dag: ${dagRunId} run, last_state=${status.state}`))
                } else {
                    setTimeout(poll, intervalMs);
                }
            } catch (err) {
                reject(err);
            }
        };

        poll();
    });
}