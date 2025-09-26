
export async function getJsonFiles(directory: string, filename?: string) {
	try {
		let url: string;
		if (filename) {
			const fullPath = `${directory}/${filename}`
			url = `/api/get-json-file?path=${encodeURIComponent(fullPath)}`
		} else {
			url = `/api/get-json-list?path=${encodeURIComponent(directory)}`
		}
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch file list: ${response.statusText}`);
		}

		const data = await response.json();
		if (!data.success) {
			throw new Error(data.message || 'Failed to fetch file list');
		}

		return filename? data.file : data.files;
	} catch (error) {
		console.error('Error fetching file list:', error);
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