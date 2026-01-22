import { env } from '$env/dynamic/private';
import { getAllRecords, getRecordById } from '$lib/services/DatabaseService';
import { getBackwardJqScript, hasJqMapping } from '$lib/services/MappingService';
import { error, json } from '@sveltejs/kit';
import { readdir, readFile, stat } from 'fs/promises';
import jq from "node-jq";
import { extname, join, normalize, resolve } from 'path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const endpoint = url.searchParams.get('endpoint');
  const id = url.searchParams.get('id');
  const target = url.searchParams.get('target') ?? '';

  if (!endpoint) {
    return json({ 
      success: false, 
      message: 'No endpoint provided' 
    }, { status: 400 });
  }

  // --- BRANCH 1: Local File System ---
  if (endpoint.startsWith('/local/')) {
    try {
      const rootFolder = env.ROOT_FOLDER_LOCATION;
      if (!rootFolder) {
        throw new Error('ROOT_FOLDER_LOCATION is not set in environment variables');
      }

      const relativePath = endpoint.replace(/^\/local\//, '');
      const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
      let fullPath: string;

      if (id) {
        fullPath = resolve(rootFolder, sanitizedPath, `${id}.json`);
      } else {
        fullPath = resolve(rootFolder, sanitizedPath);
      }
      // Security check: ensure we are still within the root folder
      if (!fullPath.startsWith(resolve(rootFolder))) {
        throw error(403, 'Access denied: Invalid file path');
      }

      const stats = await stat(fullPath);

      // Scenario A: It's a single File
      if (stats.isFile()) {
        if (extname(fullPath).toLowerCase() !== '.json') {
          throw error(400, 'Only JSON files can be requested');
        }
        const fileContent = await readFile(fullPath, 'utf-8');
        return json(JSON.parse(fileContent));
      }

      // Scenario B: It's a Directory
      if (stats.isDirectory()) {
        const files = await readdir(fullPath);
        const jsonFiles = files.filter(file => extname(file).toLowerCase() === '.json');
        const filePromises = jsonFiles.map(async (filename) => {
          const filePath = join(fullPath, filename);
          try {
            const fileContent = await readFile(filePath, 'utf-8');
            return JSON.parse(fileContent);
          } catch (parseError) {
            console.warn(`Failed to parse JSON file: ${filename}`, parseError);
            return null;
          }
        });

        const results = await Promise.all(filePromises);
        return json(results.filter(item => item !== null));
      }
      throw error(400, 'Path is neither a file nor a directory');

    } catch (err: any) {
      console.error('Error reading local path:', err);
      if (err.status) throw err; 
      if (err.code === 'ENOENT') throw error(404, 'Local resource not found');
      throw error(500, 'Internal server error reading files');
    }
  }

  // --- BRANCH 2: Database ---
  if (endpoint.startsWith('/db/')) {
    try {
      const tableName = endpoint.replace(/^\/db\//, '');
      if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        throw error(400, 'Invalid table name format');
      }

      // If an id is provided, fetch a single record
      if (id) {
        const record = getRecordById(tableName, id);
        if (!record) {
          throw error(404, `Record with id '${id}' not found in table '${tableName}'`);
        }
        return json(record);
      }

      // Otherwise, fetch all records
      const rows = getAllRecords(tableName);
      return json(rows);

    } catch (err: any) {
      console.error('Database Error:', err);
      if (err.status) throw err;
      if (err.message?.includes('no such table')) {
         throw error(404, `Table '${endpoint.replace(/^\/db\//, '')}' not found`);
      }
      throw error(500, 'Failed to retrieve data from database');
    }
  }

  // --- BRANCH 3: Remote API (Metacat) ---
  if (endpoint.startsWith('/remote/')) {
    try {
      const metacatBaseUrl = env.METACAT_URL;
      if (!metacatBaseUrl) {
        throw new Error('METACAT_URL is not set in environment variables');
      }

      const remotePath = endpoint.replace(/^\/remote\//, '');
      const remoteUrl = `${metacatBaseUrl.replace(/\/$/, '')}/${remotePath}`;
      
      const response = await fetch(remoteUrl);

      if (!response.ok) {
          throw error(response.status, `Remote API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Check if jq mapping exists for this target
      if (!target || !hasJqMapping('backward', target)) {
        // No mapping needed, return raw data
        return json(data);
      }

      try {
        // Lazy load the jq script (fetches from remote only if not cached)
        const jqScript = await getBackwardJqScript(target);

        let mappedData: any;
        if (Array.isArray(data)) {
          mappedData = await Promise.all(
            data.map(async (obj) =>
              jq.run(jqScript, obj, { input: 'json', output: 'json' })
            )
          );
        } else {
          mappedData = await jq.run(jqScript, data, { input: 'json', output: 'json' });
        }
        return json(mappedData);
      } catch (jqError) {
        console.error(`Error mapping ${target} with jq script:`, jqError);
        throw new Error(`Backward mapping failed for ${target}`);
      }

    } catch (err: any) {
      console.error('Error fetching from Metacat:', err);
      if (err.status) throw err;
      throw error(502, 'Failed to fetch from remote API');
    }
  }

  // Default Fallback
  throw error(400, 'Invalid endpoint prefix. Use /local/, /db/, or /remote/');
};