import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { resolve } from 'path';
import type { RequestHandler } from './$types';


export const GET: RequestHandler = async ({ url }) => {
  try {
    const filePath = url.searchParams.get("filepath")
    if (!filePath) {
      return json({ 
        success: false, 
        message: 'No file path provided'
      }, { status: 400 });
    }

    const rootFolder = env.BASE_JQ_URL;
    if (!rootFolder) {
      throw new Error('JQ root path not set');
    }

    const fullPath = resolve(rootFolder, filePath);

    if (!fullPath.startsWith(rootFolder)) {
      return json({ 
        success: false, 
        message: 'Invalid file path' 
      }, { status: 403 });
    }
    
    const response = await fetch(fullPath);

    if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
    }

    const data = await response.text();
    return json(data);


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