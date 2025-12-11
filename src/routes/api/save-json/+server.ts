import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, access, constants, mkdir } from 'fs/promises';
import { join, resolve, relative, normalize, basename, dirname, extname } from 'path';
import { env } from '$env/dynamic/private'; // Switched to private for security/consistency
import { getDb } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, fetch }) => {
  try {
    const body = await request.json();
    // Validate basic structure
    if (!body || typeof body !== 'object' || !body.targetPath || !body.metadata) {
       throw error(400, 'Invalid JSON structure: "targetPath" and "metadata" are required.');
    }

    const { targetPath, metadata } = body;

    // =========================================================
    // BRANCH 1: Local File System (starts with /local/)
    // =========================================================
    if (targetPath.startsWith('/local/')) {
        const rootFolder = env.ROOT_FOLDER_LOCATION;
        if (!rootFolder) {
            throw new Error('ROOT_FOLDER_LOCATION is not set in environment variables');
        }

        const relativePath = targetPath.replace(/^\/local\//, '');
        const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
        const absoluteTargetPath = resolve(rootFolder, sanitizedPath);

        // Security Check
        if (!absoluteTargetPath.startsWith(resolve(rootFolder))) {
            throw error(403, 'Access denied: Target path is outside root folder');
        }

        // Determine filename and directory
        let fileName, directory;
        if (extname(absoluteTargetPath).toLowerCase() === '.json') {
            fileName = basename(absoluteTargetPath);
            directory = dirname(absoluteTargetPath);
        } else {
            // If path is a folder, generate a timestamped filename
            fileName = `hive_metadata_${Date.now()}.json`;
            directory = absoluteTargetPath;
        }

        // Create directory if missing
        try {
            await mkdir(directory, { recursive: true });
        } catch (err) {
            console.error('Error creating directory:', err);
            throw error(500, 'Failed to create target directory');
        }

        // Write File
        const filePath = join(directory, fileName);
        await writeFile(filePath, JSON.stringify(metadata, null, 2));

        return json({ 
            success: true, 
            message: 'Saved to local file system',
            path: relative(rootFolder, filePath)
        });
    }

    // =========================================================
    // BRANCH 2: Database (starts with /db/)
    // =========================================================
    if (targetPath.startsWith('/db/')) {
        if (!env.DB_URL) {
            throw new Error('DB_URL is not set in environment variables');
        }

        const tableName = targetPath.replace(/^\/db\//, '');

        // Security: Validate table name (alphanumeric only)
        if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
            throw error(400, 'Invalid table name format');
        }

        if (Object.keys(metadata).length === 0) {
            throw error(400, 'No metadata provided to save');
        }

        const db = getDb();
        
        // Construct SQL Insert
        // NOTE: This performs a standard INSERT. If you need Upsert (Insert or Replace),
        // you can change 'INSERT INTO' to 'INSERT OR REPLACE INTO' (SQLite specific).
        const keys = Object.keys(metadata);
        const placeholders = keys.map(() => '?').join(', ');
        const columns = keys.map(k => `"${k}"`).join(', '); // Quote columns for safety
        
        const sql = `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders})`;

        try {
            const info = db.prepare(sql).run(...Object.values(metadata));
            
            return json({
                success: true,
                message: 'Saved to database',
                id: info.lastInsertRowid,
                changes: info.changes
            });
        } catch (dbErr: any) {
            console.error('Database Write Error:', dbErr);
            // Handle unique constraint violations typically found in "Save" operations
            if (dbErr.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                throw error(409, 'Duplicate entry: Data violates unique constraint');
            }
            throw error(500, 'Database write failed');
        }
    }

    // =========================================================
    // BRANCH 3: Remote API (Default)
    // =========================================================
    const metacatBaseUrl = env.METACAT_URL;
    if (!metacatBaseUrl) {
        throw new Error('METACAT_URL is not set');
    }

    // Construct Remote URL
    const remoteUrl = `${metacatBaseUrl.replace(/\/$/, '')}/${targetPath.replace(/^\//, '')}`;

    const response = await fetch(remoteUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
    });

    if (!response.ok) {
        throw error(response.status, `Remote API save failed: ${response.statusText}`);
    }

    // Return whatever the remote API returns, or a success wrapper
    const responseData = await response.json().catch(() => ({})); // Handle empty responses gracefully
    return json({
        success: true,
        message: 'Saved to remote API',
        data: responseData
    });

  } catch (err: any) {
    console.error('Error in save-json:', err);
    if (err.status) throw err; // Rethrow SvelteKit errors
    
    return json({ 
        success: false, 
        message: err.message || 'Internal server error' 
    }, { status: 500 });
  }
};