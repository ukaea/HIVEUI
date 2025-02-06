export interface TriggerDAGResponse {
    dag_run_id: string;
    conf: Record<string, unknown>;
    state: string;
    execution_date: string;
}

export async function triggerDAG(
    directory: string,
    inputfile: string
): Promise<TriggerDAGResponse> {
    const AIRFLOW_URL = "http://airflow.apps.l:8000";
    const DAG_ID = "HIVE-run-pulse";
    const username = "XXXXXXX";
    const password = "XXXXXXX";
    const credentials = btoa(`${username}:${password}`);

    const endpoint = `${AIRFLOW_URL}/api/v1/dags/${DAG_ID}/dagRuns`;

    const payload = {
        conf: {
            directory,
            inputfile,
        },
    };

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache",
                "Authorization": `Basic ${credentials}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`Failed to trigger DAG: ${response.status} ${response.statusText}`);
        }

        const data: TriggerDAGResponse = await response.json();
        console.log("DAG triggered successfully:", data);
        return data;
    } catch (error) {
        console.error("Error triggering DAG:", error);
        throw error;
    }
}
