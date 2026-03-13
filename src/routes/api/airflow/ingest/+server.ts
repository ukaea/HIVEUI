import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { json } from '@sveltejs/kit';
import { getRecordById } from '$lib/services/DatabaseService';
import { airflowTokenManager } from '../../token-manager/+server.js';
import { writeFile, mkdir } from 'fs/promises';
import { join, normalize, resolve } from 'path';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { runMetadata, pulsesMetadata } = await request.json();

        // Look up configuration to derive diagnostics
        const configRecord = getRecordById('configurations', runMetadata.configurationId);
        const diagnostics: string[][] = configRecord
            ? (configRecord.equipmentCombinations ?? []).map((combo: any) =>
                (combo.equipment ?? []).map((eq: any) => eq.equipmentName)
              )
            : [];

        // Build payload
        const payload = {
            mappingData: {
                schemaVersion: '1.0.0',
                ownerGroup: 'MRF',
                accessGroups: ['MRF']
            },
            runData: {
                runNumber: runMetadata.runNumber,
                sampleNumber: runMetadata.sampleNumber,
                experimentNumber: runMetadata.experimentNumber,
                configurationUUID: runMetadata.configurationId,
                operator1: runMetadata.operator1,
                operator2: runMetadata.operator2,
                heatingInformation: runMetadata.heatingInformation,
                coolantInformation: runMetadata.coolantInformation,
                diagnostics,
                schemaVersion: '1.0.0'
            },
            pulseData: pulsesMetadata.map(({ annotation, processedData }: { annotation: any; processedData: any }) => {
                const pulseStart = processedData ? new Date(processedData.pulseStartTimestamp).getTime() : 0;
                const pulseEnd = processedData ? new Date(processedData.pulseEndTimestamp).getTime() : 0;
                return {
                    pulseNumber: annotation.pulseNumber,
                    pulseQuality: annotation.pulseQuality,
                    comment: annotation.comment,
                    powerSupplyReportedPower: processedData?.powerSupplyReportedPower ?? 0,
                    pulseDuration: pulseStart && pulseEnd ? (pulseEnd - pulseStart) / 1000 : 0,
                    pulseStartTimestamp: processedData?.pulseStartTimestamp ?? null,
                    pulseEndTimestamp: processedData?.pulseEndTimestamp ?? null,
                    dataCaptureStartTimestamp: processedData?.dataCaptureStartTimestamp ?? null,
                    heatingInformation: processedData?.heatingInformation ?? null,
                    coolantInformation: processedData?.coolantInformation ?? null,
                    thermocoupleInformation: []
                };
            })
        };

        if (publicEnv.PUBLIC_RUNS_TEST_MODE === 'true') {
            console.log('TEST MODE - Ingest payload:', JSON.stringify(payload, null, 2));

            const rootFolder = env.ROOT_FOLDER_LOCATION;
            if (rootFolder) {
                const relativePath = normalize(
                    `HIVE/E-${runMetadata.experimentNumber}/S-${runMetadata.sampleNumber}/R-${runMetadata.runNumber}`
                ).replace(/^(\.\.[\/\\])+/, '');
                const runDir = resolve(rootFolder, relativePath);
                if (runDir.startsWith(resolve(rootFolder))) {
                    await mkdir(runDir, { recursive: true });
                    await writeFile(join(runDir, 'ingestPayload.json'), JSON.stringify(payload, null, 2));
                }
            }

            return json({ success: true, testMode: true });
        }

        const token = await airflowTokenManager.getToken();
        const endpoint = `${env.AIRFLOW_URL}/api/v1/dags/${env.AIRFLOW_INGEST_DAG_ID}/dagRuns`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ conf: payload })
        });

        if (!response.ok) {
            throw new Error(`Failed to trigger ingest DAG: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return json(data);
    } catch (error) {
        console.error('Error triggering ingest DAG:', error);
        return json({ error: (error as Error).message }, { status: 500 });
    }
};
