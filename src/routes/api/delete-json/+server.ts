// src/routes/api/delete-json/+server.ts
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { rm } from 'fs/promises';
import { resolve, normalize } from 'path';
import { env } from '$env/dynamic/private';
import { fetchWithTokenRefresh } from '$lib/server/auth';
import { deleteRecord } from '$lib/services/DatabaseService';

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


    try {
        const { targetPath, id } = await request.json();

        if (!targetPath) {
            throw error(400, 'targetPath is required');
        }

        // --- BRANCH 1: Local File System ---
        if (targetPath.startsWith('/local/')) {
            const rootFolder = env.ROOT_FOLDER_LOCATION;
            if (!rootFolder) throw error(500, 'ROOT_FOLDER_LOCATION not configured');
            if (!id) throw error(400, 'ID is required for local delete');

            const baseDir = resolve(
                rootFolder,
                normalize(targetPath.replace(/^\/local\//, '')).replace(/^(\.\.[\/\\])+/, '')
            );

            const absolutePath = resolve(baseDir, `${id}.json`);

            // Security check: ensure we are still within the root folder
            if (!absolutePath.startsWith(resolve(rootFolder))) {
                throw error(403, 'Access denied: Invalid file path');
            }

            console.log('Deleting local file:', absolutePath);

            try {
                await rm(absolutePath, { force: true });
                return json({ success: true });
            } catch (err: any) {
                console.error('Local unlink error:', err);
                throw error(500, `Failed to delete local file: ${err.message}`);
            }
        }

        // --- BRANCH 2: Database ---
        if (targetPath.startsWith('/db/')) {
            const tableName = targetPath.replace(/^\/db\//, '');
            if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
                throw error(400, 'Invalid table name format');
            }
            if (!id) {
                throw error(400, 'id is required for database delete operations');
            }
            deleteRecord(tableName, id);
            return json({ success: true });
        }

        // --- BRANCH 3: Remote API (Metacat) ---
        if (targetPath.startsWith('/remote/')) {
            const metacatBaseUrl = env.METACAT_URL;
            if (!metacatBaseUrl) throw error(500, 'METACAT_URL not configured');

            const remotePath = targetPath.replace(/^\/remote\//, '');
            const remoteUrl = `${metacatBaseUrl.replace(/\/$/, '')}/${remotePath}`;
            
            const response = await fetchWithTokenRefresh(locals, (token) =>
                fetch(remoteUrl, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
                })
            );

            if (!response.ok) throw error(response.status, `Remote delete failed: ${response.statusText}`);
            return json({ success: true });
        }

        throw error(400, 'Invalid prefix. Use /local/, /db/, or /remote/');
    } catch (err: any) {
        if (err.status) throw err;
        console.error('Delete handler error:', err);
        throw error(500, 'Delete failed');
    }
};