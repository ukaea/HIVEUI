import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import { mkdir, writeFile } from 'fs/promises';
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
            if (requiredGroup && !(locals.user as any).groups?.includes(requiredGroup)) {
                throw error(403, 'Forbidden: Insufficient permissions');
            }
        }
    }

    try {
        const body = await request.json();
        const { experimentNumber, sampleNumber, runNumber, metadata } = body;

        if (!experimentNumber || !sampleNumber || !runNumber || !metadata) {
            throw error(400, 'experimentNumber, sampleNumber, runNumber, and metadata are required');
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

        await mkdir(fullPath, { recursive: true });
        await writeFile(join(fullPath, 'manual_metadata.json'), JSON.stringify(metadata, null, 2));

        return json({
            success: true,
            message: 'Run metadata saved',
            path: fullPath
        });

    } catch (err: any) {
        console.error('Error saving run metadata:', err);
        if (err.status) throw err;
        throw error(500, err.message);
    }
};
