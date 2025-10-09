import { PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';
import { json } from '@sveltejs/kit';
import { existsSync } from 'fs';
import path, { normalize, resolve } from 'path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const targetPath = url.searchParams.get('path');
    if (!targetPath) {
      return json({ 
        success: false, 
        message: 'No path provided' 
      }, { status: 400 });
    }

    const rootFolder = PUBLIC_ROOT_FOLDER_LOCATION;
    if (!rootFolder) {
      throw new Error('PUBLIC_ROOT_FOLDER_LOCATION is not set');
    }

    const sanitizedPath = normalize(targetPath).replace(/^(\.\.[\/\\])+/, '');
    const targetFile = resolve(rootFolder, sanitizedPath);

    if (!targetFile.startsWith(rootFolder)) {
      return json({ 
        success: false, 
        message: 'Invalid directory path' 
      }, { status: 403 });
    }
    if (!targetFile.endsWith('.json')) {
        console.error("file does not end with .json")
    }

    if (!existsSync(targetFile)){
        console.log('Not a file', targetFile);
    } 
    
    const filename = path.basename(targetFile);
    return json({
        success: true,
        path: sanitizedPath,
        filename: filename
    })

  } catch (error) {
    console.error('Error reading directory:', error);
    
    if (error.code === 'ENOENT') {
      return json({ 
        success: false, 
        message: 'Directory not found' 
      }, { status: 404 });
    }

    return json({ 
      success: false, 
      message: 'Error reading directory' 
    }, { status: 500 });
  }
};

