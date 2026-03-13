export interface TriggerDAGResponse {
    dag_run_id: string;
    conf: Record<string, unknown>;
    state: string;
    execution_date: string;
}

export async function triggerDAG(experimentNumber?: number, sampleNumber?: number, runNumber?: number): Promise<TriggerDAGResponse> {
    const runDir = `${experimentNumber}/${sampleNumber}/${runNumber}`
    const response = await fetch('/api/trigger-pipeline', {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ runDir }),
    });

    if (!response.ok) {
        throw new Error(`Failed to trigger DAG: ${response.status} ${response.statusText}`);
    }
    const dagResponse = (await response.json() as TriggerDAGResponse);
    return dagResponse;
}
