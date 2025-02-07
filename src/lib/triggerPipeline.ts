export interface TriggerDAGResponse {
    dag_run_id: string;
    conf: Record<string, unknown>;
    state: string;
    execution_date: string;
}

export async function triggerDAG(directory: string, inputfile: string): Promise<TriggerDAGResponse> {
    const response = await fetch('/api/trigger-pipeline', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ directory, inputfile }),
    });

    if (!response.ok) {
        throw new Error(`Failed to trigger DAG: ${response.status} ${response.statusText}`);
    }

    return response.json();
}
