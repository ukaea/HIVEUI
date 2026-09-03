import { env } from '$env/dynamic/private';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { join, normalize, resolve } from 'path';
import { normalizePulseMap } from '$lib/models/RunMetadata';

const SCOPE = 'get-postprocessed-data';

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
    const { postprocessResult } = body;

    if (!postprocessResult?.experimentId || !postprocessResult?.sampleId || !postprocessResult?.runId || !postprocessResult?.pulses) {
        throw error(400, 'postprocessResult with experimentId, sampleId, runId, and pulses is required');
    }

    const { experimentId, sampleId, runId } = postprocessResult;

    console.log(
        `[${SCOPE}] request E-${experimentId}/S-${sampleId}/R-${runId} pulses=${postprocessResult.pulses.length}`
    );

    const rootFolder = env.ROOT_FOLDER_LOCATION;
    if (!rootFolder) {
        console.error(`[${SCOPE}] ROOT_FOLDER_LOCATION is not set`);
        throw error(500, 'ROOT_FOLDER_LOCATION is not set');
    }

    const relativePath = `E-${experimentId}/S-${sampleId}/R-${runId}`;
    const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    const runPath = resolve(rootFolder, sanitizedPath);

    if (!runPath.startsWith(resolve(rootFolder))) {
        console.error(`[${SCOPE}] rejected path outside root rootFolder=${rootFolder} runPath=${runPath}`);
        throw error(403, 'Access denied: Invalid file path');
    }

    console.log(`[${SCOPE}] reading from runPath=${runPath}`);

    const pulseList = normalizePulseMap(postprocessResult.pulses);

    if (pulseList.length < postprocessResult.pulses.length) {
        console.warn(
            `[${SCOPE}] ignored ${postprocessResult.pulses.length - pulseList.length}/${postprocessResult.pulses.length} pulses with no usable pulseId/seqId`
        );
    }

    const pulses = await Promise.all(
        pulseList.map(async ({ pulseId, seqId }) => {
            const processedPath = join(runPath, `P-${pulseId}`, `Seq-${seqId}`, 'processed_metadata.json');
            console.log(`[${SCOPE}] reading P-${pulseId}/Seq-${seqId} path=${processedPath}`);

            const processedData = await readFile(processedPath, 'utf-8')
                .then(JSON.parse)
                .catch((err) => {
                    console.error(
                        `[${SCOPE}] failed to read P-${pulseId}/Seq-${seqId} path=${processedPath}:`,
                        err?.code ?? err?.message ?? err
                    );
                    return null;
                });

            return { pulseId, seqId, processedData };
        })
    );

    pulses.sort((a, b) => a.pulseId - b.pulseId);

    const resolved = pulses.filter((pulse) => pulse.processedData !== null).length;
    console.log(
        `[${SCOPE}] returning ${resolved}/${pulses.length} pulses with processed data for E-${experimentId}/S-${sampleId}/R-${runId}`
    );

    return json({
        experimentId,
        sampleId,
        runId,
        pulses
    });
};
