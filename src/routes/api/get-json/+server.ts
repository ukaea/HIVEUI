import { env } from '$env/dynamic/private';
import { fetchWithTokenRefresh } from '$lib/server/auth';
import { getAllConfigurations, getConfigurationById } from '$lib/server/db/configurationsRepository';
import { getAllRecords, getRecordById } from '$lib/services/DatabaseService';
import { getBackwardJqScript, hasJqMapping } from '$lib/services/MappingService';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { mkdir, readdir, readFile, stat } from 'fs/promises';
import jq from "node-jq";
import { extname, join, normalize, resolve } from 'path';

export const GET: RequestHandler = async ({ url, fetch, locals, request }) => {
  const endpoint = url.searchParams.get('endpoint');
  const id = url.searchParams.get('id');
  const target = endpoint?.split('/')[2] ?? '';

  // --- AUTHENTICATION CHECK ---
  if (env.AUTHN_ENABLE === 'true' && !locals.user) {
    throw error(401, 'Unauthorized: No active session');
  }

  // --- AUTHORIZATION CHECK ---
  if (env.AUTHN_ENABLE === 'true' && env.AUTHZ_ENABLE === 'true') {
    const requiredGroup = env.AUTHZ_REQUIRED_GROUP;
    const userGroups = (locals.user as any)?.groups || [];
    if (requiredGroup && !userGroups.includes(requiredGroup)) {
      throw error(403, 'Forbidden: Insufficient permissions');
    }
  }

  if (!endpoint) {
    return json({ success: false, message: 'No endpoint provided' }, { status: 400 });
  }

  // --- BRANCH 1: Local File System ---
  if (endpoint.startsWith('/local/')) {
    const rootFolder = env.ROOT_FOLDER_LOCATION;
    if (!rootFolder) throw error(500, 'ROOT_FOLDER_LOCATION not set');

    const relativePath = endpoint.replace(/^\/local\//, '');
    const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    const dirPath = resolve(rootFolder, sanitizedPath);
    const fullPath = id ? resolve(dirPath, `${id}.json`) : dirPath;

    if (!fullPath.startsWith(resolve(rootFolder))) {
      throw error(403, 'Access denied: Invalid file path');
    }

    try {
      const stats = await stat(fullPath);

      if (stats.isFile()) {
        if (extname(fullPath).toLowerCase() !== '.json') throw error(400, 'Only JSON allowed');
        return json(JSON.parse(await readFile(fullPath, 'utf-8')));
      }

      if (stats.isDirectory()) {
        const files = await readdir(fullPath);
        const jsonFiles = files.filter(file => extname(file).toLowerCase() === '.json');
        const results = await Promise.all(jsonFiles.map(async (filename) => {
          try {
            return JSON.parse(await readFile(join(fullPath, filename), 'utf-8'));
          } catch { return null; }
        }));
        return json(results.filter(item => item !== null));
      }
      throw error(400, 'Invalid path type');
    } catch (err: any) {
      if (err.status) throw err;
      if (err.code === 'ENOENT' && !id) {
        await mkdir(dirPath, { recursive: true });
        return json([]);
      }
      if (err.code === 'ENOENT') throw error(404, 'Local resource not found');
      throw error(500, 'Internal server error reading files');
    }
  }

  // --- BRANCH 2: Database ---
  if (endpoint.startsWith('/db/')) {
    try {
      const tableName = endpoint.replace(/^\/db\//, '');
      if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw error(400, 'Invalid table name');

      if (tableName === 'configurations') {
        if (id) {
          const record = await getConfigurationById(id);
          if (!record) throw error(404, `Record ${id} not found`);
          return json(record);
        }
        return json(await getAllConfigurations());
      }

      if (id) {
        const record = getRecordById(tableName, id);
        if (!record) throw error(404, `Record ${id} not found`);
        return json(record);
      }
      return json(getAllRecords(tableName));
    } catch (err: any) {
      if (err.status) throw err;
      throw error(500, 'Database error');
    }
  }

  // --- BRANCH 3: Remote API (Metacat) ---
  if (endpoint.startsWith('/remote/')) {
    try {
      const metacatBaseUrl = env.METACAT_URL;
      if (!metacatBaseUrl) throw new Error('METACAT_URL not set');

      // Map client-facing target to Metacat path (equipment → instruments)
      const metacatPath = target === 'equipment' ? 'instruments' : target;
      const remoteUrl = new URL(`${metacatBaseUrl.replace(/\/$/, '')}/${metacatPath}`);

      remoteUrl.searchParams.append('filter', JSON.stringify({ where: { ownerGroup: 'HIVE' } }));

      console.log(`[get-json] remote fetch target=${target} metacatPath=${metacatPath} url=${remoteUrl}`);

      const response = await fetchWithTokenRefresh(locals, (token) =>
        fetch(remoteUrl.toString(), { headers: { Authorization: `Bearer ${token}` } })
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[get-json] Metacat error for ${target} (${response.status}):`, errorBody);
        throw error(response.status, `Remote API error: ${errorBody}`);
      }

      const data = await response.json();
      const items: unknown[] = Array.isArray(data) ? data : [data];

      // Instruments / equipment: per-item mapping keyed on equipmentType
      if (target === 'equipment' || target === 'instruments') {
        console.log(`[get-json] instruments raw (${items.length} items):`, JSON.stringify(items, null, 2));

        const results: unknown[] = [];
        for (const item of items as Record<string, any>[]) {
          // Flatten .additional.equipment fields up to .additional
          const { equipment, ...restAdditional } = item?.additional ?? {};
          const normalised = { ...item, additional: { ...restAdditional, ...equipment } };

          const equipType = normalised?.additional?.equipmentType?.toLowerCase();
          const hasMappings = equipType ? hasJqMapping('backward', equipType) : false;
          console.log(`[get-json] instrument pid=${item?.pid} equipmentType=${equipType} hasMapping=${hasMappings}`);

          if (!hasMappings) {
            console.log(`[get-json] skipping instrument pid=${item?.pid} — no backward mapping for equipmentType=${equipType}`);
            continue;
          }

          const jqScript = await getBackwardJqScript(equipType);
          const mapped = await jq.run(jqScript, normalised, { input: 'json', output: 'json' });
          console.log(`[get-json] mapped instrument pid=${item?.pid}:`, JSON.stringify(mapped, null, 2));
          results.push(mapped);
        }

        console.log(`[get-json] instruments returning ${results.length}/${items.length} items`);
        return json(results);
      }

      // All other targets: apply a single backward mapping script if one exists
      if (!target || !hasJqMapping('backward', target)) {
        console.log(`[get-json] no backward mapping for target=${target}, dropping ${items.length} items`);
        return json([]);
      }

      const jqScript = await getBackwardJqScript(target);
      const mapped = await Promise.all(
        items.map(obj => jq.run(jqScript, obj as any, { input: 'json', output: 'json' }))
      );
      return json(mapped);
    } catch (err: any) {
      if (err.status) throw err;
      console.error(`[get-json] error fetching remote data for target=${target}:`, err);
      throw error(502, `Failed to fetch from remote API: ${err.message}`);
    }
  }

  throw error(400, 'Invalid endpoint prefix');
};