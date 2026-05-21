import { env } from '$env/dynamic/private';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { readdir, readFile, stat } from 'fs/promises';
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

    try {
        const rootFolder = env.ROOT_FOLDER_LOCATION;
        if (!rootFolder) {
            throw new Error('ROOT_FOLDER_LOCATION is not set in environment variables');
        }

        const relativePath = `E-${experimentNumber}/S-${sampleNumber}/R-${runNumber}`;
        const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
        const runPath = resolve(rootFolder, sanitizedPath);

        if (!runPath.startsWith(resolve(rootFolder))) {
            throw error(403, 'Access denied: Invalid file path');
        }

        const entries = await readdir(runPath, { withFileTypes: true });
        const pulseDirs = entries.filter(
            (e) => e.isDirectory() && /^P-\d+$/.test(e.name)
        );

        const pulses = await Promise.all(
            pulseDirs.map(async (dir) => {
                const pulseNumber = parseInt(dir.name.replace('P-', ''), 10);
                const annotationPath = join(runPath, dir.name, 'pulse_manual_metadata.json');

                let annotation = null;
                try {
                    const stats = await stat(annotationPath);
                    if (stats.isFile()) {
                        const content = await readFile(annotationPath, 'utf-8');
                        annotation = JSON.parse(content);
                    }
                } catch {
                    // No annotation file yet
                }

                return {
                    pulseNumber,
                    runNumber: parseInt(runNumber, 10),
                    pulseQuality: annotation?.pulseQuality || '',
                    comment: annotation?.comment || ''
                };
            })
        );

        pulses.sort((a, b) => a.pulseNumber - b.pulseNumber);

        return json(pulses);

    } catch (err: any) {
        console.error('Error reading pulse directories:', err);
        if (err.status) throw err;
        if (err.code === 'ENOENT') return json([]);
        throw error(500, 'Internal server error reading pulse directories');
    }
};
