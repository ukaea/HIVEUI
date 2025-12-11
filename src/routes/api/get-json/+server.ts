import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readdir, readFile } from 'fs/promises';
import { resolve, normalize, extname, join } from 'path';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const endpoint = url.searchParams.get('endpoint');

  if (!endpoint) {
    return json({ 
      success: false, 
      message: 'No endpoint provided' 
    }, { status: 400 });
  }

  // BRANCH 1: Local File System
  if (endpoint.startsWith('/local/')) {
    try {
      const rootFolder = env.ROOT_FOLDER_LOCATION;
      if (!rootFolder) {
        throw new Error('ROOT_FOLDER_LOCATION is not set in environment variables');
      }

      const relativePath = endpoint.replace(/^\/local\//, '');

      // Sanitize the path and prevent directory traversal
      const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
      const fullPath = resolve(rootFolder, sanitizedPath);

      // Security check: ensure we are still within the root folder
      if (!fullPath.startsWith(resolve(rootFolder))) {
        throw error(403, 'Access denied: Invalid file path');
      }

      // 1. Read directory contents
      const files = await readdir(fullPath);

      // 2. Filter for only .json files
      const jsonFiles = files.filter(file => extname(file).toLowerCase() === '.json');

      // 3. Read and parse all files concurrently
      const filePromises = jsonFiles.map(async (filename) => {
        const filePath = join(fullPath, filename);
        const fileContent = await readFile(filePath, 'utf-8');
        try {
            return JSON.parse(fileContent);
        } catch (parseError) {
            console.warn(`Failed to parse JSON file: ${filename}`, parseError);
            return null;
        }
      });

      const results = await Promise.all(filePromises);
      const validResults = results.filter(item => item !== null);
      return json(validResults);

    } catch (err: any) {
      console.error('Error reading local folder:', err);
      
      if (err.status) throw err; // Rethrow SvelteKit errors
      if (err.code === 'ENOENT') {
        throw error(404, 'Local folder not found');
      }
      if (err.code === 'ENOTDIR') {
        throw error(400, 'Path is not a directory');
      }
      throw error(500, 'Internal server error reading files');
    }
  }

  // BRANCH 2: Database
  if (endpoint.startsWith('/db/')) {
    try {
      if (!env.DB_URL) {
        throw new Error('DB_URL is not set in environment variables');
      }
      const tableName = endpoint.replace(/^\/db\//, '');
      if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        throw error(400, 'Invalid table name format');
      }

      // Initialize DB connection
      const db = getDb();
      const rows = db.prepare(`SELECT * FROM "${tableName}"`).all();

      return json(rows);

    } catch (err: any) {
      console.error('Database Error:', err);
      if (err.status) throw err;
      
      if (err.message && err.message.includes('no such table')) {
         throw error(404, `Table '${endpoint.replace(/^\/db\//, '')}' not found`);
      }

      throw error(500, 'Failed to retrieve data from database');
    }
  }

  // BRANCH 3: Remote API (Metacat)
  try {
    const metacatBaseUrl = env.METACAT_URL;
    if (!metacatBaseUrl) {
      throw new Error('METACAT_URL is not set in environment variables');
    }

    const remoteUrl = `${metacatBaseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
    
    const response = await fetch(remoteUrl);

    if (!response.ok) {
        // Forward the error status from the remote API
        throw error(response.status, `Remote API error: ${response.statusText}`);
    }

    const data = await response.json();
    return json(data);

  } catch (err: any) {
    console.error('Error fetching from Metacat:', err);
    if (err.status) throw err;
    throw error(502, 'Failed to fetch from remote API');
  }
};