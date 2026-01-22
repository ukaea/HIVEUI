// src/routes/api/save-json/+server.ts
import { env } from '$env/dynamic/private';
import { getForwardJqScript, hasJqMapping } from '$lib/services/MappingService';
import { upsertRecord } from '$lib/services/DatabaseService';
import { error, json } from '@sveltejs/kit';
import { mkdir, writeFile } from 'fs/promises';
import jq from "node-jq";
import { join, normalize, resolve } from 'path';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch }) => {
    try {
        const body = await request.json();
        const { targetPath, metadata, target, id } = body;

        if (!targetPath || !metadata) {
            throw error(400, 'targetPath and metadata are required');
        }

        // BRANCH 1: Local File System
        if (targetPath.startsWith('/local/')) {
            const rootFolder = env.ROOT_FOLDER_LOCATION;
            if (!rootFolder) throw new Error('ROOT_FOLDER_LOCATION not set');

            if (!id) throw error(400, 'id is required for local save operations');

            // 1. Resolve the base directory from targetPath
            const relativePath = targetPath.replace(/^\/local\//, '');
            const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
            const baseDir = resolve(rootFolder, sanitizedPath);

            // 2. Security Check: Prevent escaping the root folder
            if (!baseDir.startsWith(resolve(rootFolder))) {
                throw error(403, 'Access denied');
            }

            // 3. Construct the final file path using the ID
            const absolutePath = join(baseDir, `${id}.json`);

            try {
                // 4. Create the directory if it doesn't exist
                await mkdir(baseDir, { recursive: true });

                // 5. Write the file
                await writeFile(absolutePath, JSON.stringify(metadata, null, 2));

                console.log('Saved local file:', absolutePath);
                return json({ success: true, message: 'Saved to local' });
            } catch (err: any) {
                console.error('Local save error:', err);
                throw error(500, `Failed to save local file: ${err.message}`);
            }
        }

        // BRANCH 2: Database
        if (targetPath.startsWith('/db/')) {
            const tableName = targetPath.replace(/^\/db\//, '');
            if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw error(400, 'Invalid table name');

            if (!id) {
                throw error(400, 'id is required for database operations');
            }

            // Store entire metadata as JSON in the data column
            upsertRecord(tableName, id, metadata);

            return json({ success: true, message: 'Saved to DB' });
        }

        // BRANCH 3: Remote
        if (targetPath.startsWith('/remote/')) {
            const metacatBaseUrl = env.METACAT_URL;
            if (!metacatBaseUrl) throw new Error('METACAT_URL not set');

            try {
                let dataToSend = metadata;

                // Apply jq mapping if available for this target
                if (target && hasJqMapping('forward', target)) {
                    const jqScript = await getForwardJqScript(target);
                    dataToSend = await jq.run(jqScript, metadata, { input: 'json', output: 'json' });
                }

                const remoteUrl = `${metacatBaseUrl.replace(/\/$/, '')}/${targetPath.replace(/^\/remote\//, '')}`;
                const response = await fetch(remoteUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dataToSend)
                });

                if (!response.ok) throw error(response.status, 'Remote save failed');
                return json(await response.json());
            } catch (jqError) {
                console.error(`Error in remote save for ${target}:`, jqError);
                throw new Error(`Forward mapping failed for ${target}`);
            }
        }

        throw error(400, 'Invalid targetPath prefix');
    } catch (err: any) {
        if (err.status) throw err;
        console.error(err);
        throw error(500, err.message);
    }
};