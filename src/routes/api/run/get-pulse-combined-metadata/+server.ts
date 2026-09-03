import { env } from '$env/dynamic/private';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { join, normalize, resolve } from 'path';

const SCOPE = 'get-pulse-combined-metadata';

export const POST: RequestHandler = async ({ request, locals }) => {
    if (env.AUTHN_ENABLE === 'true' && !locals.user) {
        throw error(401, 'Unauthorized: No active session');
    }

    if (env.AUTHN_ENABLE === 'true' && env.AUTHZ_ENABLE === 'true') {
        const requiredGroup = env.AUTHZ_REQUIRED_GROUP;
        if (requiredGroup && !(locals.user as any)?.groups?.includes(requiredGroup)) {
            throw error(403, 'Forbidden: Insufficient permissions');
        }
    }

    const { runMetadata } = await request.json();

    if (!runMetadata?.experimentNumber || !runMetadata?.sampleNumber || !runMetadata?.runNumber) {
        throw error(400, 'runMetadata with experimentNumber, sampleNumber, and runNumber is required');
    }

    const { experimentNumber, sampleNumber, runNumber } = runMetadata;

    const pulseList = Array.isArray(runMetadata.pulseMap) ? runMetadata.pulseMap : [];

    console.log(
        `[${SCOPE}] request E-${experimentNumber}/S-${sampleNumber}/R-${runNumber} pulses=${pulseList.length}`
    );

    if (pulseList.length === 0) {
        console.warn(`[${SCOPE}] runMetadata.pulseMap is empty — no pulse files will be read`);
    }

    const rootFolder = env.ROOT_FOLDER_LOCATION;
    if (!rootFolder) {
        console.error(`[${SCOPE}] ROOT_FOLDER_LOCATION is not set`);
        throw error(500, 'ROOT_FOLDER_LOCATION is not set');
    }

    const relativePath = `E-${experimentNumber}/S-${sampleNumber}/R-${runNumber}`;
    const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    const runPath = resolve(rootFolder, sanitizedPath);

    if (!runPath.startsWith(resolve(rootFolder))) {
        console.error(`[${SCOPE}] rejected path outside root rootFolder=${rootFolder} runPath=${runPath}`);
        throw error(403, 'Access denied: Invalid file path');
    }

    console.log(`[${SCOPE}] reading from runPath=${runPath}`);

    const pulses = await Promise.all(
        pulseList.map(async ({ pulseId, seqId }: { pulseId: number; seqId: number }) => {
            // Postprocess output lives at the sequence level.
            const processedPath = join(runPath, `P-${pulseId}`, `Seq-${seqId}`, 'processed_metadata.json');
            console.log(`[${SCOPE}] reading processed data P-${pulseId}/Seq-${seqId} path=${processedPath}`);

            const processedData = await readFile(processedPath, 'utf-8')
                .then(JSON.parse)
                .catch((err) => {
                    console.error(
                        `[${SCOPE}] failed to read processed data P-${pulseId}/Seq-${seqId} path=${processedPath}:`,
                        err?.code ?? err?.message ?? err
                    );
                    return null;
                });

            // Annotations are saved at the pulse level by save-pulse-annotation.
            const annotationPath = join(runPath, `P-${pulseId}`, 'pulse_manual_metadata.json');
            const annotationData = await readFile(annotationPath, 'utf-8')
                .then(JSON.parse)
                .catch((err) => {
                    console.error(
                        `[${SCOPE}] failed to read annotation P-${pulseId} path=${annotationPath}:`,
                        err?.code ?? err?.message ?? err
                    );
                    return null;
                });

            return { pulseId, seqId, processedData, annotationData };
        })
    );

    pulses.sort((a, b) => a.pulseId - b.pulseId);

    const withProcessed = pulses.filter((pulse) => pulse.processedData !== null).length;
    const withAnnotation = pulses.filter((pulse) => pulse.annotationData !== null).length;
    console.log(
        `[${SCOPE}] returning ${pulses.length} pulses for E-${experimentNumber}/S-${sampleNumber}/R-${runNumber} (processed=${withProcessed}, annotated=${withAnnotation})`
    );

    return json(pulses);
};
