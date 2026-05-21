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
    const pulseNumber = url.searchParams.get('pulseNumber');

    if (!experimentNumber || !sampleNumber || !runNumber || !pulseNumber) {
        throw error(400, 'experimentNumber, sampleNumber, runNumber, and pulseNumber are required');
    }

    try {
        const rootFolder = env.ROOT_FOLDER_LOCATION;
        if (!rootFolder) {
            throw new Error('ROOT_FOLDER_LOCATION is not set in environment variables');
        }

        const relativePath = `E-${experimentNumber}/S-${sampleNumber}/R-${runNumber}/P-${pulseNumber}`;
        const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
        const pulsePath = resolve(rootFolder, sanitizedPath);

        if (!pulsePath.startsWith(resolve(rootFolder))) {
            throw error(403, 'Access denied: Invalid file path');
        }

        const entries = await readdir(pulsePath, { withFileTypes: true });
        const seqDirs = entries
            .filter((e) => e.isDirectory() && /^Seq-\d+$/.test(e.name))
            .sort((a, b) => {
                const numA = parseInt(a.name.replace('Seq-', ''), 10);
                const numB = parseInt(b.name.replace('Seq-', ''), 10);
                return numA - numB;
            });

        const sequences = await Promise.all(
            seqDirs.map(async (dir) => {
                const sequenceNumber = parseInt(dir.name.replace('Seq-', ''), 10);
                const metadataPath = join(pulsePath, dir.name, 'processed_metadata.json');

                try {
                    const stats = await stat(metadataPath);
                    if (stats.isFile()) {
                        const content = await readFile(metadataPath, 'utf-8');
                        return {
                            sequenceNumber,
                            ...JSON.parse(content)
                        };
                    }
                } catch {
                    // No processed_metadata.json in this sequence
                }

                return null;
            })
        );

        return json(sequences.filter((s) => s !== null));

    } catch (err: any) {
        console.error('Error reading processed data:', err);
        if (err.status) throw err;
        if (err.code === 'ENOENT') return json([]);
        throw error(500, 'Internal server error reading processed data');
    }
};
