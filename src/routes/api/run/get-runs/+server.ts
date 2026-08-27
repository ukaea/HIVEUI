import { env } from '$env/dynamic/private';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { readdir, readFile, stat } from 'fs/promises';
import { join, resolve } from 'path';

async function findRunMetadataFiles(rootDir: string): Promise<string[]> {
    console.log('[get-runs] findRunMetadataFiles called with rootDir:', rootDir);
    const results: string[] = [];

    async function walk(dir: string): Promise<void> {
        console.log('[get-runs] walk: entering directory:', dir);
        try {
            const entries = await readdir(dir, { withFileTypes: true });
            console.log(`[get-runs] walk: read ${entries.length} entries in ${dir}`, entries.map(e => e.name));

            for (const entry of entries) {
                const fullPath = join(dir, entry.name);
                console.log('[get-runs] walk: stat-ing entry:', fullPath);
                const stats = await stat(fullPath);
                console.log(`[get-runs] walk: ${fullPath} -> isDirectory=${stats.isDirectory()} isFile=${stats.isFile()} size=${stats.size}`);

                if (stats.isDirectory()) {
                    console.log('[get-runs] walk: recursing into directory:', fullPath);
                    await walk(fullPath);
                    console.log('[get-runs] walk: finished recursing into directory:', fullPath);
                } else if (stats.isFile() && entry.name === 'manual_metadata.json') {
                    console.log('[get-runs] walk: MATCH manual_metadata.json at:', fullPath);
                    results.push(fullPath);
                    console.log('[get-runs] walk: results count is now:', results.length);
                } else {
                    console.log('[get-runs] walk: skipping non-matching entry:', fullPath);
                }
            }
            console.log('[get-runs] walk: leaving directory:', dir);
        } catch (err: any) {
            console.error('Error reading local path:', err);
            console.error('[get-runs] walk: failed on directory:', dir, 'code:', err?.code, 'status:', err?.status, 'message:', err?.message);
            if (err.status) throw err;
            if (err.code === 'ENOENT') throw error(404, 'Local resource not found');
            throw error(500, 'Internal server error reading files');
        }
    }

    await walk(rootDir);
    console.log(`[get-runs] findRunMetadataFiles: found ${results.length} metadata file(s):`, results);
    return results;
}

export const GET: RequestHandler = async ({ locals }) => {
    const startTime = Date.now();
    console.log('[get-runs] GET handler invoked at', new Date(startTime).toISOString());
    console.log('[get-runs] AUTHN_ENABLE:', env.AUTHN_ENABLE, 'AUTHZ_ENABLE:', env.AUTHZ_ENABLE);
    console.log('[get-runs] locals.user present:', !!locals.user);

    if (env.AUTHN_ENABLE === 'true' && !locals.user) {
        console.warn('[get-runs] Rejecting request: authentication enabled but no active session');
        throw error(401, 'Unauthorized: No active session');
    }

    if (env.AUTHN_ENABLE === 'true' && env.AUTHZ_ENABLE === 'true') {
        const requiredGroup = env.AUTHZ_REQUIRED_GROUP;
        const userGroups = (locals.user as any)?.groups || [];
        console.log('[get-runs] Authorization check - requiredGroup:', requiredGroup, 'userGroups:', userGroups);
        if (requiredGroup && !userGroups.includes(requiredGroup)) {
            console.warn('[get-runs] Rejecting request: user missing required group', requiredGroup);
            throw error(403, 'Forbidden: Insufficient permissions');
        }
        console.log('[get-runs] Authorization check passed');
    }

    try {
        const rootFolder = env.ROOT_FOLDER_LOCATION;
        console.log('[get-runs] ROOT_FOLDER_LOCATION:', rootFolder);
        if (!rootFolder) {
            console.error('[get-runs] ROOT_FOLDER_LOCATION is missing from environment');
            throw new Error('ROOT_FOLDER_LOCATION is not set in environment variables');
        }
        console.log('[get-runs] Resolved root folder path:', resolve(rootFolder));

        console.log('[get-runs] Starting metadata file scan...');
        const scanStart = Date.now();
        const jsonPaths = await findRunMetadataFiles(rootFolder);
        console.log(`[get-runs] Metadata file scan finished in ${Date.now() - scanStart}ms, ${jsonPaths.length} file(s) to parse`);

        const results = await Promise.all(
            jsonPaths.map(async (jsonPath, index) => {
                console.log(`[get-runs] [${index + 1}/${jsonPaths.length}] Reading file:`, jsonPath);
                try {
                    const fileContent = await readFile(jsonPath, 'utf-8');
                    console.log(`[get-runs] [${index + 1}/${jsonPaths.length}] Read ${fileContent.length} chars from`, jsonPath);
                    const parsed = JSON.parse(fileContent);
                    console.log(`[get-runs] [${index + 1}/${jsonPaths.length}] Parsed OK, top-level keys:`, parsed && typeof parsed === 'object' ? Object.keys(parsed) : typeof parsed);
                    return parsed;
                } catch (parseError) {
                    console.warn(`Failed to parse JSON file: ${jsonPath}`, parseError);
                    console.warn(`[get-runs] [${index + 1}/${jsonPaths.length}] Returning null for`, jsonPath);
                    return null;
                }
            })
        );
        console.log('[get-runs] All files processed. Raw result count:', results.length);

        const filtered = results.filter(item => item !== null);
        console.log(`[get-runs] Filtered out ${results.length - filtered.length} null result(s); returning ${filtered.length} run(s)`);
        console.log(`[get-runs] GET handler completed in ${Date.now() - startTime}ms`);

        return json(filtered);

    } catch (err: any) {
        console.error('Error reading run metadata files:', err);
        console.error('[get-runs] Handler failed after', Date.now() - startTime, 'ms - code:', err?.code, 'status:', err?.status, 'message:', err?.message);
        console.error('[get-runs] Stack:', err?.stack);
        if (err.status) throw err;
        if (err.code === 'ENOENT') throw error(404, 'Run directory not found');
        throw error(500, 'Internal server error reading run files');
    }
};
