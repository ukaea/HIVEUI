// src/routes/api/save-json/+server.ts
import { env } from '$env/dynamic/private';
import { forwardJq } from '$lib/server/load-jq';
import { getDb } from '$lib/services/DatabaseService';
import { error, json } from '@sveltejs/kit';
import { mkdir, writeFile } from 'fs/promises';
import jq from "node-jq";
import { basename, dirname, extname, join, normalize, resolve } from 'path';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch }) => {
    try {
        const body = await request.json();
        const { targetPath, metadata, target } = body;

        if (!targetPath || !metadata) {
            throw error(400, 'targetPath and metadata are required');
        }

        // BRANCH 1: Local File System
        if (targetPath.startsWith('/local/')) {
            const rootFolder = env.ROOT_FOLDER_LOCATION;
            if (!rootFolder) throw new Error('ROOT_FOLDER_LOCATION not set');

            const relativePath = targetPath.replace(/^\/local\//, '');
            const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
            const absolutePath = resolve(rootFolder, sanitizedPath);

            if (!absolutePath.startsWith(resolve(rootFolder))) {
                throw error(403, 'Access denied');
            }

            const directory = extname(absolutePath) ? dirname(absolutePath) : absolutePath;
            const fileName = extname(absolutePath) ? basename(absolutePath) : `data_${Date.now()}.json`;

            await mkdir(directory, { recursive: true });
            await writeFile(join(directory, fileName), JSON.stringify(metadata, null, 2));

            return json({ success: true, message: 'Saved to local' });
        }

        // BRANCH 2: Database
        if (targetPath.startsWith('/db/')) {
            const tableName = targetPath.replace(/^\/db\//, '');
            if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw error(400, 'Invalid table name');

            const db = getDb();
            const keys = Object.keys(metadata);
            const columns = keys.map(k => `"${k}"`).join(', ');
            const placeholders = keys.map(() => '?').join(', ');
            
            // Note: Using INSERT OR REPLACE to handle updates
            const sql = `INSERT OR REPLACE INTO "${tableName}" (${columns}) VALUES (${placeholders})`;
            db.prepare(sql).run(...Object.values(metadata));

            return json({ success: true, message: 'Saved to DB' });
        }

        // BRANCH 3: Remote
        if (targetPath.startsWith('/remote/')) {
            const metacatBaseUrl = env.METACAT_URL;
            if (!metacatBaseUrl) throw new Error('METACAT_URL not set');

            const jqScript = forwardJq.get()[target]

            try {
                const mappedData = await jq.run(jqScript, metadata, { input: 'json', output: 'json' })
                const remoteUrl = `${metacatBaseUrl.replace(/\/$/, '')}/${targetPath.replace(/^\/remote\//, '')}`;
                const response = await fetch(remoteUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mappedData)
                });

                if (!response.ok) throw error(response.status, 'Remote save failed');
                return json(await response.json());
            } catch (error) {
                console.error(`Error mapping ${target} with jq script:`, error);
                throw new Error(`Forward mapping failed.`);
            }
        }

        throw error(400, 'Invalid targetPath prefix');
    } catch (err: any) {
        if (err.status) throw err;
        console.error(err);
        throw error(500, err.message);
    }
};