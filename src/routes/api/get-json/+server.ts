import { env } from '$env/dynamic/private';
//import { getDb } from '$lib/services/DatabaseService';
import { error, json } from '@sveltejs/kit';
import { readdir, readFile, stat } from 'fs/promises'; // Added stat
import jq from 'node-jq';
import path, { extname, join, normalize, resolve } from 'path';
import type { RequestHandler } from './$types';


async function findPulseFiles(rootDir: string): Promise<string[]> {
  const results:string[] = [];

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, {withFileTypes: true});

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          await walk(fullPath);
        } else if (stats.isFile() && entry.name.endsWith("metadata.json")){
          results.push(fullPath);
        }
        
      }
    } catch (err: any) {
      console.error('Error reading local path:', err);
      if (err.status) throw err; 
      if (err.code === 'ENOENT') throw error(404, 'Local resource not found');
      throw error(500, 'Internal server error reading files');
    }
  }
  await walk(rootDir);
  return results;
}

  
export const GET: RequestHandler = async ({ url, fetch }) => {
  const endpoint = url.searchParams.get('endpoint');
  const isPulse = url.searchParams.get('isPulse');
  const id  = url.searchParams.get('id');
  const requestType = url.searchParams.get('requestType') ?? '';

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

      // Scenario B: It's a Directory (Current behavior)
      if (stats.isDirectory()) {
        // Scenario B1: It's a Pulse Directory
        if (isPulse){
          const jsonPaths = await findPulseFiles(fullPath);
          const results = await Promise.all(
            jsonPaths.map( async (jsonPath) =>{
              const filename = path.basename(jsonPath)
              try {
                  const fileContent = await readFile(jsonPath, 'utf-8');
                  //console.log("this is pulse path", fileContent)
                  return JSON.parse(fileContent);
                } catch (parseError) {
                  console.warn(`Failed to parse JSON file: ${filename}`, parseError);
                  return null;
                }
              }
            ) 
          );
          return json(results.filter(item => item !== null));
        } else {
          // Scenario B2: It's not a Pulse Directory
          const files = await readdir(fullPath);
          const jsonFiles = files.filter(file => extname(file).toLowerCase() === '.json');
          const filePromises = jsonFiles.map(async (filename) => {
            const filePath = join(fullPath, filename);
            try {
              const fileContent = await readFile(filePath, 'utf-8');
              console.log("this is pulse path", fileContent)
              return JSON.parse(fileContent);
            } catch (parseError) {
              console.warn(`Failed to parse JSON file: ${filename}`, parseError);
              return null;
            }
          });

          const results = await Promise.all(filePromises);
          return json(results.filter(item => item !== null));
        }
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
    // try {
    //   if (!env.DB_URL) {
    //     throw new Error('DB_URL is not set in environment variables');
    //   }
    //   const tableName = endpoint.replace(/^\/db\//, '');
    //   if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
    //     throw error(400, 'Invalid table name format');
    //   }

    //   const db = getDb();
    //   const rows = db.prepare(`SELECT * FROM "${tableName}"`).all();
    //   return json(rows);

    // } catch (err: any) {
    //   console.error('Database Error:', err);
    //   if (err.status) throw err;
    //   if (err.message?.includes('no such table')) {
    //      throw error(404, `Table '${endpoint.replace(/^\/db\//, '')}' not found`);
    //   }
    //   throw error(500, 'Failed to retrieve data from database');
    // }
  }

  // --- BRANCH 3: Remote API (Metacat) ---
  if (endpoint.startsWith('/remote/')) {
    try {
      const metacatBaseUrl = env.METACAT_URL;
      if (!metacatBaseUrl) {
        throw new Error('METACAT_URL is not set in environment variables');
      }

      // Strip the "/remote/" prefix to get the actual target path
      const remotePath = endpoint.replace(/^\/remote\//, '');
      const remoteUrl = `${metacatBaseUrl.replace(/\/$/, '')}/${remotePath}`;
      
      const response = await fetch(remoteUrl);

      if (!response.ok) {
          throw error(response.status, `Remote API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      let mappedData: any;
      if (Array.isArray(data)) {
        mappedData = data.map((obj) => reverseMapping(obj, requestType))
      } else {
        mappedData = reverseMapping(data, requestType)
      }

      return json(mappedData);

    } catch (err: any) {
      console.error('Error fetching from Metacat:', err);
      if (err.status) throw err;
      throw error(502, 'Failed to fetch from remote API');
    }
  }

  // Default Fallback
  throw error(400, 'Invalid endpoint prefix. Use /local/, /db/, or /remote/');
};

async function reverseMapping(metadata:any, requestType:string) {
      if (!(requestType && metadata)) {
        throw error(400, 'request type and metadata required');
    }
  const jqFileRequest = await fetch(`${env.BASE_JQ_PATH}/reverse-metacat-mapping/hive/${requestType}.jq`)
      const jqFile = await jqFileRequest.text();
      const mappedData = await jq.run(jqFile, metadata, { input: 'json', output: 'json' });
      return mappedData;
}