import { env } from '$env/dynamic/private';
import { getAllRecords, getRecordById } from '$lib/services/DatabaseService';
import { getBackwardJqScript, hasJqMapping } from '$lib/services/MappingService';
import { error, json } from '@sveltejs/kit';
import { readdir, readFile, stat } from 'fs/promises';
import jq from "node-jq";
import { extname, join, normalize, resolve } from 'path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch, locals }) => {
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

  const token = (locals.user as any)?.accessToken;
  console.log('Token:', token);
  if (!endpoint) {
    return json({ success: false, message: 'No endpoint provided' }, { status: 400 });
  }

  // --- BRANCH 1: Local File System ---
  if (endpoint.startsWith('/local/')) {
    try {
      const rootFolder = env.ROOT_FOLDER_LOCATION;
      if (!rootFolder) throw new Error('ROOT_FOLDER_LOCATION not set');

      const relativePath = endpoint.replace(/^\/local\//, '');
      const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
      let fullPath = id ? resolve(rootFolder, sanitizedPath, `${id}.json`) : resolve(rootFolder, sanitizedPath);

      if (!fullPath.startsWith(resolve(rootFolder))) {
        throw error(403, 'Access denied: Invalid file path');
      }

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
      if (err.code === 'ENOENT') throw error(404, 'Local resource not found');
      throw error(500, 'Internal server error reading files');
    }
  }

  // --- BRANCH 2: Database ---
  if (endpoint.startsWith('/db/')) {
    try {
      const tableName = endpoint.replace(/^\/db\//, '');
      if (!/^[a-zA-Z0-9_]+$/.test(tableName)) throw error(400, 'Invalid table name');

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

      const remotePath = endpoint.replace(/^\/remote\//, '');
      const remoteUrl = `${metacatBaseUrl.replace(/\/$/, '')}/${remotePath}`;

      console.log(`Fetching remote URL: ${remoteUrl}`);

      interface QueryFilter {
        where: {
          [key: string]: string | number | boolean | object;
        };
      }

      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = new URL(remoteUrl);

      if (target == "experiments") {
        const filterFields: QueryFilter = {
          where: {}
        };
        url.searchParams.append('filter', JSON.stringify(filterFields));
      }

      if (target == "instruments") {
        const filterFields: QueryFilter = {
          where: {}
        };
        url.searchParams.append('filter', JSON.stringify(filterFields));
      }

      // 3. Execute the fetch call
      const response: Response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Metacat error for ${target} (${response.status}):`, errorBody);
        throw error(response.status, `Remote API error: ${errorBody}`);
      }

      const data = await response.json();

      // Instruments: apply per-instrument backward mapping based on equipmentType
      if (target === 'instruments') {
        const mappedData = await Promise.all(
          (Array.isArray(data) ? data : [data]).map(async (item) => {
            const equipType = item?.additional?.equipmentType?.toLowerCase();
            if (equipType && hasJqMapping('backward', equipType)) {
              const jqScript = await getBackwardJqScript(equipType);
              return jq.run(jqScript, item, { input: 'json', output: 'json' });
            }
            return item; // no mapping available, return as-is
          })
        );
        return json(mappedData);
      }

      if (!target || !hasJqMapping('backward', target)) return json(data);

      const jqScript = await getBackwardJqScript(target);
      let mappedData = Array.isArray(data)
        ? await Promise.all(data.map(obj => jq.run(jqScript, obj, { input: 'json', output: 'json' })))
        : await jq.run(jqScript, data, { input: 'json', output: 'json' });

      return json(mappedData);
    } catch (err: any) {
      if (err.status) throw err;
      console.error(`Error fetching remote data for ${target}:`, err);
      throw error(502, `Failed to fetch from remote API: ${err.message}`);
    }
  }

  throw error(400, 'Invalid endpoint prefix');
};