import { env } from '$env/dynamic/private';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { rm } from 'fs/promises';
import { normalize, resolve } from 'path';

export const POST: RequestHandler = async ({ request, locals }) => {
    // --- AUTHENTICATION & AUTHORIZATION ---
    if (env.AUTHN_ENABLE === 'true') {
        if (!locals.user) {
            throw error(401, 'Unauthorized: No active session');
        }

        if (env.AUTHZ_ENABLE === 'true') {
            const requiredGroup = env.AUTHZ_REQUIRED_GROUP;
            if (requiredGroup && !(locals.user as any).groups?.includes(requiredGroup)) {
                throw error(403, 'Forbidden: Insufficient permissions');
            }
        }
    }

    try {
        const body = await request.json();
        const { experimentNumber, sampleNumber, runNumber } = body;

        if (!experimentNumber || !sampleNumber || !runNumber) {
            throw error(400, 'experimentNumber, sampleNumber, and runNumber are required');
        }

        const rootFolder = env.ROOT_FOLDER_LOCATION;
        if (!rootFolder) {
            throw new Error('ROOT_FOLDER_LOCATION is not set in environment variables');
        }

        const experimentDir = `E-${experimentNumber}`;
        const sampleDir = `S-${sampleNumber}`;
        const runDir = `R-${runNumber}`;
        const relativePath = `${experimentDir}/${sampleDir}/${runDir}`;

        const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
        const fullPath = resolve(rootFolder, sanitizedPath);

        if (!fullPath.startsWith(resolve(rootFolder))) {
            throw error(403, 'Access denied: Invalid file path');
        }

        await rm(fullPath, { recursive: true, force: true });

        return json({
            success: true,
            message: 'Run deleted',
            path: fullPath
        });

    } catch (err: any) {
        console.error('Error deleting run:', err);
        if (err.status) throw err;
        if (err.code === 'ENOENT') {
            throw error(404, 'Run directory not found');
        }
        throw error(500, err.message);
    }
};
