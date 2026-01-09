// src/routes/api/delete-json/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { unlink } from 'fs/promises';
import { resolve, normalize } from 'path';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/services/DatabaseService';

export const POST: RequestHandler = async ({ request, fetch }) => {
    try {
        const { targetPath, id } = await request.json();

        // Local Branch
        if (targetPath.startsWith('/local/')) {
            const rootFolder = env.ROOT_FOLDER_LOCATION;
            const absolutePath = resolve(rootFolder!, normalize(targetPath.replace(/^\/local\//, '')).replace(/^(\.\.[\/\\])+/, ''));
            
            await unlink(absolutePath);
            return json({ success: true });
        }

        // DB Branch
        if (targetPath.startsWith('/db/')) {
            // const tableName = targetPath.replace(/^\/db\//, '');
            // const db = getDb();
            // // Assumes a column named 'id' exists. Adjust if your idField varies.
            // db.prepare(`DELETE FROM "${tableName}" WHERE id = ?`).run(id);
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