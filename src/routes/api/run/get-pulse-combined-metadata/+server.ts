import { env } from '$env/dynamic/private';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { join, normalize, resolve } from 'path';

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

    // The pulse map is serialized by RunMetadata.toJSON under `postProcessResult`.
    const pulseList = Array.isArray(runMetadata.pulseMap)
        ? runMetadata.pulseMap
        : Array.isArray(runMetadata.postProcessResult)
            ? runMetadata.postProcessResult
            : [];

    const rootFolder = env.ROOT_FOLDER_LOCATION;
    if (!rootFolder) {
        throw error(500, 'ROOT_FOLDER_LOCATION is not set');
    }

    const relativePath = `E-${experimentNumber}/S-${sampleNumber}/R-${runNumber}`;
    const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    const runPath = resolve(rootFolder, sanitizedPath);

    if (!runPath.startsWith(resolve(rootFolder))) {
        throw error(403, 'Access denied: Invalid file path');
    }

    const pulses = await Promise.all(
        pulseList.map(async ({ pulseNumber, sequenceNumber }: { pulseNumber: number; sequenceNumber: number }) => {
            // Postprocess output lives at the sequence level.
            const processedPath = join(runPath, `P-${pulseNumber}`, `Seq-${sequenceNumber}`, 'processed_metadata.json');
            const processedData = await readFile(processedPath, 'utf-8').then(JSON.parse).catch(() => null);

            // Annotations are saved at the pulse level by save-pulse-annotation.
            const annotationPath = join(runPath, `P-${pulseNumber}`, 'pulse_manual_metadata.json');
            const annotationData = await readFile(annotationPath, 'utf-8').then(JSON.parse).catch(() => null);

            return { pulseNumber, sequenceNumber, processedData, annotationData };
        })
    );

    pulses.sort((a, b) => a.pulseNumber - b.pulseNumber);

    return json(pulses);
};
