import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import { rm } from 'fs/promises';
import { join, normalize, resolve } from 'path';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
    // --- AUTHENTICATION & AUTHORIZATION ---
    if (env.AUTHN_ENABLE === 'true') {
        if (!locals.user) {
            throw error(401, 'Unauthorized: No active session');
        }

        if (env.AUTHZ_ENABLE === 'true') {
            const requiredGroup = env.AUTHZ_REQUIRED_GROUP;
            if (requiredGroup && !locals.user.groups.includes(requiredGroup)) {
                throw error(403, 'Forbidden: Insufficient permissions');
            }
        }
    }

    try {
        const body = await request.json();
        const { experimentNumber, sampleNumber, pulseNumber } = body;

        if (!experimentNumber || !sampleNumber || !pulseNumber) {
            throw error(400, 'experimentNumber, sampleNumber, and pulseNumber are required');
        }

        const rootFolder = env.ROOT_FOLDER_LOCATION;
        if (!rootFolder) {
            throw new Error('ROOT_FOLDER_LOCATION is not set in environment variables');
        }

        // Construct pulse-specific directory path
        const experimentDir = `E-${experimentNumber}`;
        const sampleDir = `S-${sampleNumber}`;
        const pulseDir = `P-${pulseNumber}`;
        const relativePath = `HIVE/${experimentDir}/${sampleDir}/${pulseDir}/raw/manual-metadata.json`;

        const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
        const fullPath = resolve(rootFolder, sanitizedPath);

        // Security check: ensure we are still within the root folder
        if (!fullPath.startsWith(resolve(rootFolder))) {
            throw error(403, 'Access denied: Invalid file path');
        }

        // Delete the metadata file
        await rm(fullPath, { force: true });

        return json({
            success: true,
            message: 'Pulse metadata deleted',
            path: fullPath
        });

    } catch (err: any) {
        console.error('Error deleting pulse metadata:', err);
        if (err.status) throw err;
        if (err.code === 'ENOENT') {
            throw error(404, 'Pulse metadata file not found');
        }
        throw error(500, err.message);
    }
};
