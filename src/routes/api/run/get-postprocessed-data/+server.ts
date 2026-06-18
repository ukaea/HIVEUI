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

    const body = await request.json();
    const { experimentNumber, sampleNumber, runNumber, postprocessResult } = body;

    if (!experimentNumber || !sampleNumber || !runNumber || !postprocessResult?.pulses) {
        throw error(400, 'experimentNumber, sampleNumber, runNumber, and postprocessResult are required');
    }

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
        postprocessResult.pulses.map(async ({ pulseNumber, sequenceNumber }: { pulseNumber: number; sequenceNumber: number }) => {
            const processedPath = join(runPath, `P-${pulseNumber}`, `Seq-${sequenceNumber}`, 'processed_metadata.json');
            const processedData = await readFile(processedPath, 'utf-8').then(JSON.parse).catch(() => null);

            return { pulseNumber, sequenceNumber, processedData };
        })
    );

    pulses.sort((a, b) => a.pulseNumber - b.pulseNumber);

    return json({
        experimentNumber,
        sampleNumber,
        runNumber,
        pulses
    });
};
