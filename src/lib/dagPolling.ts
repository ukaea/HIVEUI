export interface DAGStatus {
    dag_run_id: string;
    state: string;
    execution_date: string;
    start_date: string;
    end_date: string | null;
}

export async function pollDAGStatus(dagRunId: string): Promise<DAGStatus> {
    const response = await fetch(`/api/dag-status?dagRunId=${encodeURIComponent(dagRunId)}`);

    if (!response.ok) {
        throw new Error(`Failed to fetch DAG status: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

export async function waitForDAGCompletion(
    dagRunId: string,
    intervalMs: number = 5000,
    onStatusUpdate?: (status: DAGStatus) => void
): Promise<DAGStatus> {
    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                const status = await pollDAGStatus(dagRunId);
                if (onStatusUpdate) {
                    onStatusUpdate(status);
                }

                if (status.state === 'success') {
                    resolve(status);
                } else if (status.state === 'failed') {
                    reject(new Error('DAG run failed'));
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
