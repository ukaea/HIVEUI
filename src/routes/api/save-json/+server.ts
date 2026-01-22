// src/routes/api/save-json/+server.ts
import { env } from '$env/dynamic/private';
import { getForwardJqScript, hasJqMapping } from '$lib/services/MappingService';
import { upsertRecord } from '$lib/services/DatabaseService';
import { error, json } from '@sveltejs/kit';
import { mkdir, writeFile } from 'fs/promises';
import jq from "node-jq";
import { join, normalize, resolve } from 'path';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch, locals }) => {
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

    const token = locals.user?.accessToken;

    try {
        const body = await request.json();
        const { targetPath, metadata, target, id } = body;

        if (!targetPath || !metadata) {
            throw error(400, 'targetPath and metadata are required');
        }

        // --- BRANCH 1: Local File System ---
        if (targetPath.startsWith('/local/')) {
            const rootFolder = env.ROOT_FOLDER_LOCATION;
            if (!rootFolder) throw new Error('ROOT_FOLDER_LOCATION not set');

            if (!id) throw error(400, 'id is required for local save operations');

            const relativePath = targetPath.replace(/^\/local\//, '');
            const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
            const baseDir = resolve(rootFolder, sanitizedPath);

            // Security Check
            if (!baseDir.startsWith(resolve(rootFolder))) {
                throw error(403, 'Access denied: Path out of bounds');
            }

            const absolutePath = join(baseDir, `${id}.json`);

            try {
                await mkdir(baseDir, { recursive: true });
                await writeFile(absolutePath, JSON.stringify(metadata, null, 2));

                console.log('Saved local file:', absolutePath);
                return json({ success: true, message: 'Saved to local' });
            } catch (err: any) {
                console.error('Local save error:', err);
                throw error(500, `Failed to save local file: ${err.message}`);
            }
        }

        // --- BRANCH 2: Database ---
        if (targetPath.startsWith('/db/')) {
            const tableName = targetPath.replace(/^\/db\//, '');
            if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw error(400, 'Invalid table name');

            if (!id) {
                throw error(400, 'id is required for database operations');
            }

            upsertRecord(tableName, id, metadata);
            return json({ success: true, message: 'Saved to DB' });
        }

        // --- BRANCH 3: Remote API (Metacat) ---
        if (targetPath.startsWith('/remote/')) {
            const metacatBaseUrl = env.METACAT_URL;
            if (!metacatBaseUrl) throw new Error('METACAT_URL not set');

            try {
                let dataToSend = metadata;

                // Apply jq mapping if available
                if (target && hasJqMapping('forward', target)) {
                    const jqScript = await getForwardJqScript(target);
                    dataToSend = await jq.run(jqScript, metadata, { input: 'json', output: 'json' });
                }

                const remotePath = targetPath.replace(/^\/remote\//, '');
                const remoteUrl = `${metacatBaseUrl.replace(/\/$/, '')}/${remotePath}`;
                
                // Injecting the Bearer Token
                const headers: HeadersInit = { 
                    'Content-Type': 'application/json' 
                };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const response = await fetch(remoteUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(dataToSend)
                });

                if (!response.ok) throw error(response.status, `Remote save failed: ${response.statusText}`);
                
                const result = await response.json();
                return json(result);
            } catch (jqError: any) {
                console.error(`Error in remote save for ${target}:`, jqError);
                throw error(500, `Forward mapping failed for ${target}: ${jqError.message}`);
            }
        }

        throw error(400, 'Invalid targetPath prefix');
    } catch (err: any) {
        if (err.status) throw err;
        console.error('Save handler error:', err);
        throw error(500, err.message || 'Internal server error during save');
    }
};