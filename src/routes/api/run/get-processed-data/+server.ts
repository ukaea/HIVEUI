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
    const pulseNumber = url.searchParams.get('pulseNumber');
    const sequenceNumber = url.searchParams.get('sequenceNumber');

    if (!experimentNumber || !sampleNumber || !runNumber || !pulseNumber || !sequenceNumber) {
        throw error(400, 'experimentNumber, sampleNumber, runNumber, pulseNumber, and sequenceNumber are required');
    }

    const rootFolder = env.ROOT_FOLDER_LOCATION;
    if (!rootFolder) {
        throw error(500, 'ROOT_FOLDER_LOCATION is not set');
    }

    const relativePath = `E-${experimentNumber}/S-${sampleNumber}/R-${runNumber}/P-${pulseNumber}/Seq-${sequenceNumber}/processed_metadata.json`;
    const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = resolve(rootFolder, sanitizedPath);

    if (!filePath.startsWith(resolve(rootFolder))) {
        throw error(403, 'Access denied: Invalid file path');
    }

    try {
        const content = await readFile(filePath, 'utf-8');
        return json({ sequenceNumber: parseInt(sequenceNumber, 10), ...JSON.parse(content) });
    } catch (err: any) {
        if (err.code === 'ENOENT') return json(null);
        throw error(500, 'Internal server error reading processed data');
    }
};
