// src/routes/api/save-json/+server.ts
import { env } from '$env/dynamic/private';
import { fetchWithTokenRefresh } from '$lib/auth';
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


    try {
        const body = await request.json();
        const { targetPath, metadata, id } = body;
        const target = targetPath.split('/')[2];

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

            // Schema validation if SCHEMA_REGISTRY_URL is configured
            const schemaRegistryUrl = env.SCHEMA_REGISTRY_URL;
            if (schemaRegistryUrl) {
                try {
                    const schemaType = target || relativePath.split('/')[0] || 'default';
                    const validationResponse = await fetch(schemaRegistryUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            schemaType,
                            data: metadata
                        })
                    });

                    if (!validationResponse.ok) {
                        const errorText = await validationResponse.text();
                        throw error(validationResponse.status, `Schema registry error: ${errorText}`);
                    }

                    const validationResult = await validationResponse.json();
                    if (!validationResult.valid) {
                        const errorMessages = validationResult.errors?.join(', ') || 'Unknown validation error';
                        throw error(400, `Schema validation failed: ${errorMessages}`);
                    }
                } catch (err: any) {
                    if (err.status) throw err;
                    console.error('Schema validation error:', err);
                    throw error(502, `Failed to validate against schema registry: ${err.message}`);
                }
            }

            // Security Check
            if (!baseDir.startsWith(resolve(rootFolder))) {
                throw error(403, 'Access denied: Path out of bounds');
            }

            const absolutePath = join(baseDir, `${id}.json`);

            try {
                await mkdir(baseDir, { recursive: true });
                await writeFile(absolutePath, JSON.stringify(metadata, null, 2));

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
            console.log("TARGETPATH: ", targetPath)
            console.log("TARGET: ", target)
            if (!metacatBaseUrl) throw new Error('METACAT_URL not set');

            try {
                let dataToSend = metadata;

                // Add schemaVersion before mapping
                metadata["schemaVersion"] = "1.0.0";

                // Apply jq mapping if available
                if (target && hasJqMapping('forward', target)) {
                    const jqScript = await getForwardJqScript(target);
                    console.log("JQSCRIPT: ", jqScript)
                    dataToSend = await jq.run(jqScript, metadata, { input: 'json', output: 'json' });

                    if (target == "experiments")
                    {
                        dataToSend["facilityExperimentId"] = String(dataToSend["facilityExperimentId"]);
                    }


                    //DEBUG
                    console.log("DATATOSEND: ", dataToSend)
                }

                const remotePath = targetPath.replace(/^\/remote\//, '');
                const remoteUrl = `${metacatBaseUrl.replace(/\/$/, '')}/${remotePath}`;

                const response = await fetchWithTokenRefresh(locals.user, request.headers, (token) =>
                    fetch(remoteUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify(dataToSend)
                    })
                );

                if (!response.ok) {
                    const errorBody = await response.text();
                    console.error(`Metacat error for ${target} (${response.status}):`, errorBody);
                    throw error(response.status, `Remote save failed: ${errorBody}`);
                }

                const result = await response.json();
                return json(result);
            } catch (err: any) {
                if (err.status) throw err;
                console.error(`Error in remote save for ${target}:`, err);
                throw error(500, `Remote save failed for ${target}: ${err.message}`);
            }
        }

        throw error(400, 'Invalid targetPath prefix');
    } catch (err: any) {
        if (err.status) throw err;
        console.error('Save handler error:', err);
        throw error(500, err.message || 'Internal server error during save');
    }
};