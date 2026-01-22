// src/routes/api/delete-json/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rm } from 'fs/promises';
import { resolve, normalize } from 'path';
import { env } from '$env/dynamic/private';
import { deleteRecord } from '$lib/services/DatabaseService';

export const POST: RequestHandler = async ({ request, fetch }) => {
    try {
        const { targetPath, id } = await request.json();

        // Local Branch
        if (targetPath.startsWith('/local/')) {
            const rootFolder = env.ROOT_FOLDER_LOCATION;
            if (!rootFolder) throw error(500, 'ROOT_FOLDER_LOCATION not configured');
            if (!id) throw error(400, 'ID is required for local delete');

            // 1. Resolve the base directory
            const baseDir = resolve(
                rootFolder,
                normalize(targetPath.replace(/^\/local\//, '')).replace(/^(\.\.[\/\\])+/, '')
            );

            // 2. Append the ID and extension (e.g., .json)
            const absolutePath = resolve(baseDir, `${id}.json`);

            console.log('Deleting local file:', absolutePath);

            try {
                await rm(absolutePath, { force: true });
                return json({ success: true });
            } catch (err: any) {
                console.error('Local unlink error:', err);
                throw error(500, `Failed to delete local file: ${err.message}`);
            }
        }

        // DB Branch
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

        // Remote Branch
        if (targetPath.startsWith('/remote/')) {
            const remoteUrl = `${env.METACAT_URL?.replace(/\/$/, '')}/${targetPath.replace(/^\/remote\//, '')}`;
            const response = await fetch(remoteUrl, { method: 'DELETE' });
            if (!response.ok) throw error(response.status, 'Remote delete failed');
            return json({ success: true });
        }

        throw error(400, 'Invalid prefix');
    } catch (err: any) {
        if (err.status) throw err;
        throw error(500, 'Delete failed');
    }
};