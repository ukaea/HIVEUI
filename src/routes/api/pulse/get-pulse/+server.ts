import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import { readdir, readFile, stat } from 'fs/promises';
import path, { join, normalize, resolve } from 'path';
import type { RequestHandler } from './$types';

async function findPulseFiles(rootDir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          await walk(fullPath);
        } else if (stats.isFile() && entry.name.endsWith("metadata.json")) {
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

export const GET: RequestHandler = async ({ url, locals }) => {
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

  const endpoint = url.searchParams.get('endpoint');

  if (!endpoint) {
    return json({
      success: false,
      message: 'No endpoint provided'
    }, { status: 400 });
  }

  if (!endpoint.startsWith('/local/')) {
    throw error(400, 'Pulse endpoint must start with /local/');
  }

  try {
    const rootFolder = env.ROOT_FOLDER_LOCATION;
    if (!rootFolder) {
      throw new Error('ROOT_FOLDER_LOCATION is not set in environment variables');
    }

    const relativePath = endpoint.replace(/^\/local\//, '');
    const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = resolve(rootFolder, sanitizedPath);

    // Security check: ensure we are still within the root folder
    if (!fullPath.startsWith(resolve(rootFolder))) {
      throw error(403, 'Access denied: Invalid file path');
    }

    const stats = await stat(fullPath);

    if (!stats.isDirectory()) {
      throw error(400, 'Pulse endpoint must point to a directory');
    }

    const jsonPaths = await findPulseFiles(fullPath);
    const results = await Promise.all(
      jsonPaths.map(async (jsonPath) => {
        const filename = path.basename(jsonPath);
        try {
          const fileContent = await readFile(jsonPath, 'utf-8');
          return JSON.parse(fileContent);
        } catch (parseError) {
          console.warn(`Failed to parse JSON file: ${filename}`, parseError);
          return null;
        }
      })
    );

    return json(results.filter(item => item !== null));

  } catch (err: any) {
    console.error('Error reading pulse files:', err);
    if (err.status) throw err;
    if (err.code === 'ENOENT') throw error(404, 'Pulse directory not found');
    throw error(500, 'Internal server error reading pulse files');
  }
};
