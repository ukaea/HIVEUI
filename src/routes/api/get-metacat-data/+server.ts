import { PUBLIC_METACAT_URL } from '$env/static/public';
import { json } from '@sveltejs/kit';
import { resolve } from 'path';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  try {
    const requestURL = url.searchParams.get("requestURL");

    if (!requestURL) {
      throw new Error('Request Url is not set');
    }

    const endpoint = resolve(PUBLIC_METACAT_URL, requestURL)
    
    const response  = await fetch(endpoint);
    const jsonData = await response.json();

    return json(jsonData)

  } catch (error) {
    console.error('Error reading JSON file:', error);
    
    if (error.code === 'ENOENT') {
      return json({ 
        success: false, 
        message: 'File not found' 
      }, { status: 404 });
    }

    return json({ 
      success: false, 
      message: 'Error reading file' 
    }, { status: 500 });
  }
};