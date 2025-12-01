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




export async function getData({ url }) {
    try {
        const response = await fetch(url, {
            method: "GET"
        });
        if (!response.ok) {
            throw new Error(`Failed to trigger DAG: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error triggering DAG:", error);
        return null; // ✅ Return something in catch
    }
}

// ✅ Correct way to call and log
getData({ url: "https://raw.githubusercontent.com/ukaea/ukaea-metadata/develop/ukaea-schema/ukaea-dataset.schema.json" })
    .then(data => {
        console.log(data); // ✅ Prints actual JSON data
    })
    .catch(error => {
        console.error('Failed:', error);
    });
