
export async function getJsonFiles(directory: string, filename?: string) {
	try {
		const response = await fetch(`/api/get-json-list?path=${encodeURIComponent(directory)}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch file list: ${response.statusText}`);
		}

		const data = await response.json();
		if (!data.success) {
			throw new Error(data.message || 'Failed to fetch file list');
		}

		return data.files;
	} catch (error) {
		console.error('Error fetching file list:', error);
		throw error;
	}
}


export async function  getJsonFile(directory:string, filename:string) {
	try{
		const fullFilename = filename.endsWith('.json') ? filename : `${filename}.json`;

		const filePath = `${directory}/${fullFilename}`;

		const response = await fetch(`/api/get-json-file?path=${encodeURIComponent(filePath)}`);

		if (!response.ok) {
			console.log("failed to fetch file:", response.statusText)
			throw new Error(`Failed to fetch file: ${response.statusText}`);
		}
		const data = await response.json();

		if (!data.success) {
			throw new Error(data.message || 'Failed to fetch file')
		}
		return data.filename

	} catch (error) {
		console.error('Error fetching file', error);
		throw error;
	}
	
}

export async function getJsonContent(filename: string) {
	try {
		const response = await fetch(`/api/get-json?filename=${encodeURIComponent(filename)}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch file content: ${response.statusText}`);
		}

		const data = await response.json();
		if (!data.success) {
			throw new Error(data.message || 'Failed to fetch file content');
		}

		return data.data;
	} catch (error) {
		console.error('Error fetching file content:', error);
		throw error;
	}
}