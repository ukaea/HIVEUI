import { env } from '$env/dynamic/private';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { readFile } from 'fs/promises';
import { join, normalize, resolve } from 'path';

export const GET: RequestHandler = async ({ url, locals }) => {
    if (env.AUTHN_ENABLE === 'true' && !locals.user) {
        throw error(401, 'Unauthorized: No active session');
    }

    if (env.AUTHN_ENABLE === 'true' && env.AUTHZ_ENABLE === 'true') {
        const requiredGroup = env.AUTHZ_REQUIRED_GROUP;
        const userGroups = (locals.user as any)?.groups || [];
        if (requiredGroup && !userGroups.includes(requiredGroup)) {
            throw error(403, 'Forbidden: Insufficient permissions');
        }
    }

    const experimentNumber = url.searchParams.get('experimentNumber');
    const sampleNumber = url.searchParams.get('sampleNumber');
    const runNumber = url.searchParams.get('runNumber');

    if (!experimentNumber || !sampleNumber || !runNumber) {
        throw error(400, 'experimentNumber, sampleNumber, and runNumber are required');
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

    try {
        const metadataRaw = await readFile(join(runPath, 'manual_metadata.json'), 'utf-8');
        const metadata = JSON.parse(metadataRaw);
        const pulseIds: Array<[number, number]> = Array.isArray(metadata.pulseIds) ? metadata.pulseIds : [];

        const pulses = await Promise.all(
            pulseIds.map(async ([pulseNumber, sequenceNumber]) => {
                const annotationPath = join(runPath, `P-${pulseNumber}`, 'pulse_manual_metadata.json');

                let annotation = null;
                try {
                    const content = await readFile(annotationPath, 'utf-8');
                    annotation = JSON.parse(content);
                } catch {
                    // No annotation file yet
                }

                return {
                    pulseNumber,
                    sequenceNumber,
                    pulseQuality: annotation?.pulseQuality || '',
                    comment: annotation?.comment || ''
                };
            })
        );

        pulses.sort((a, b) => a.pulseNumber - b.pulseNumber);
        return json(pulses);

    } catch (err: any) {
        if (err.status) throw err;
        if (err.code === 'ENOENT') return json([]);
        throw error(500, 'Internal server error reading pulse data');
    }
};
