<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, DateField, Drawer, MenuItem, map } from 'svelte-ux';
	import { tableOrderStore, SelectField, Toggle, delay, cls, type MenuOption } from 'svelte-ux';
	import { page } from '$app/stores';
	import { PUBLIC_LOCAL_ONLY, PUBLIC_METACAT_URL, PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';
	import { getJsonFiles, getJsonContent } from '$lib/jsonUtils';

	class DiagnosticSelectMetadata {
		diagnosticID: string;
		constructor() {
			this.diagnosticID = '';
		}
	}

	class DiagnosticPortPair {
		diagnosticID: string;
		port: string;

		constructor() {
			this.diagnosticID = '';
			this.port = '';
		}
	}

	class ConfigurationData {
		diagnosticPortPairs: DiagnosticPortPair[];

		constructor() {
			this.diagnosticPortPairs = [];
		}
	}

	class ConfigurationMetadata {
		configurationID: string;
		configurationName: string;
		configurationDescription: string;
		configurationData: ConfigurationData;

		constructor() {
			this.configurationID = '';
			this.configurationName = '';
			this.configurationDescription = '';
			this.configurationData = new ConfigurationData();
		}
	}

	let sortedData: ConfigurationMetadata[] = [];
	let sortedDiagnostics: DiagnosticSelectMetadata[] = [];
	let diagnosticOptions: MenuOption[] = [];
	const order = tableOrderStore({ initialBy: 'configurationID', initialDirection: 'asc' });

	order.subscribe((value) => {
		sortedData = sortedData.sort($order.handler);
	});

	let open = false;
	let selectedMetadata: ConfigurationMetadata | null = null;
	let isNewEntry = false;
	let localOnly = false;

	function mapJSONToConfiguration(apiResponse: any): ConfigurationMetadata {
		const metadata = new ConfigurationMetadata();
		return Object.assign(metadata, apiResponse);
	}

	function mapConfigurationToJSON(metadata: ConfigurationMetadata): any {
		return { ...metadata };
	}

	function mapToDiagnostic(apiResponse: any): DiagnosticSelectMetadata {
		const metadata = new DiagnosticSelectMetadata();
		// Assume all fields are valid
		return Object.assign(metadata, apiResponse);
	}

	async function fetchDiagnostics() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			if (localOnly) {
				const files = await getJsonFiles('diagnostics');
				const data = await Promise.all(files.map((filename: string) => getJsonContent('diagnostics/' + filename)));
				sortedDiagnostics = data.map(mapToDiagnostic);
				diagnosticOptions = sortedDiagnostics.map((diagnostic) => {
					return { label: diagnostic.diagnosticID, value: diagnostic.diagnosticID };
				});
				console.log('Diagnostics loaded:', sortedDiagnostics);
				return;
			}
		} catch (error) {
			console.error('Error fetching diagnostics:', error);
			alert('Failed to load diagnostics. Please try again later.');
		}
	}

	async function fetchConfigurations() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			if (localOnly) {
				const files = await getJsonFiles('configurations');
				const data = await Promise.all(files.map((filename: string) => getJsonContent('configurations/' + filename)));
				sortedData = data.map(mapJSONToConfiguration).sort($order.handler);
				return;
			}
		} catch (error) {
			console.error('Error fetching configurations:', error);
			alert('Failed to load configurations. Please try again later.');
		}
	}

	async function handleMetadataSubmit(event: CustomEvent<ConfigurationMetadata>) {
		const rawMetadata = event.detail;
		try {
			await handleFileSubmission(rawMetadata);
		} catch (error) {
			console.error('File submission failed:', error);
		}

		if (localOnly) {
			handleModalClose();
			await fetchConfigurations(); // Refresh the data
			return;
		}

		try {
			await handleAPISubmission(rawMetadata, isNewEntry);
			handleModalClose();
			await fetchConfigurations();
		} catch (error) {
			console.error('API submission failed:', error);
		}
	}

	async function handleFileSubmission(rawMetadata: ConfigurationMetadata): Promise<void> {
		try {
			const configurationID = rawMetadata.configurationID;
			const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/configurations/`;
			const fileName = `${configurationID}.json`;

			const saveMetadata = { targetPath: `${filePath}/${fileName}`, metadata: rawMetadata };

			const fileResponse = await fetch('/api/save-json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saveMetadata) });

			if (!fileResponse.ok) {
				const errorData = await fileResponse.json();
				throw new Error(`Failed to save metadata file: ${errorData.message}`);
			}

			console.log('Metadata file saved successfully');
			alert('Metadata file saved successfully');
		} catch (error) {
			console.error('Error saving metadata file:', error);
			alert(`Failed to save metadata file: ${error.message}`);
			throw error;
		}
	}

	async function handleAPISubmission(rawMetadata: ConfigurationMetadata, isNewEntry: boolean): Promise<void> {
		try {
			// Implement later
			// const accessToken = $page.data.session?.sessionToken;
			// if (!accessToken) {
			// 	throw new Error('No access token available');
			// }
			// const mappedMetadata = mapConfigurationToJSON(rawMetadata);
			// console.log('Mapped metadata:', mappedMetadata);
			// const url = `${PUBLIC_METACAT_URL}/api/v1/proposals?schema=any`;
			// const method = isNewEntry ? 'POST' : 'POST';
			// const endpointResponse = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(mappedMetadata) });
			// if (!endpointResponse.ok) throw new Error('Failed to save proposal to endpoint');
			// console.log('Proposal submitted to API successfully');
			// alert(isNewEntry ? 'New proposal submitted successfully!' : 'Proposal updated successfully!');
		} catch (error) {
			// console.error('Error submitting proposal to API:', error);
			// alert(`Failed to submit proposal to API: ${error.message}`);
			// throw error; // Re-throw the error if you want calling code to handle it
		}
	}

	function handleDelete(): void {
		if (!selectedMetadata) return;

		if (confirm(`Are you sure you want to delete the configuration with ID: ${selectedMetadata.configurationID}?`)) {
			if (localOnly) {
				const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/configurations/${selectedMetadata.configurationID}.json`;
				fetch('/api/delete-json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetPath: filePath }) })
					.then((response) => {
						if (!response.ok) throw new Error('Failed to delete local file');
						alert('Configuration deleted successfully');
						fetchConfigurations();
					})
					.catch((error) => {
						console.error('Error deleting local file:', error);
						alert(`Failed to delete configuration: ${error.message}`);
					});
			}

			handleModalClose();
		}
	}

	function handleRowClick(row: ConfigurationMetadata): void {
		selectedMetadata = { ...row };
		isNewEntry = false;
		open = true;
	}

	function handleNewEntry(): void {
		selectedMetadata = { ...new ConfigurationMetadata() };
		isNewEntry = true;
		open = true;
	}

	function handleModalClose() {
		open = false;
		selectedMetadata = null;
		isNewEntry = false;
	}

	let newDiagnosticID = '';
	let newPort = '';

	onMount(() => {
		if (PUBLIC_LOCAL_ONLY == 'true') {
			localOnly = true;
		}

		fetchDiagnostics();
		fetchConfigurations();
	});
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<div class="mb-4 flex justify-between items-center">
		<h2 class="text-2xl font-bold">Configuration Metadata</h2>
		<Button on:click={handleNewEntry} variant="fill">New Configuration</Button>
	</div>
	<div class="table-container">
		<Table
			data={sortedData}
			columns={[
				{ name: 'configurationID', align: 'left', header: 'ID' },
				{ name: 'configurationName', align: 'left', header: 'Name' },
				{ name: 'configurationDescription', align: 'left', header: 'Description' }
			]}
			{order}
			on:cellClick={(e) => handleRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>
</div>

<Dialog {open} on:close={handleModalClose} class="configurationInputDialog">
	<div slot="title">{isNewEntry ? 'Create New Configuration' : 'Edit Configuration Metadata'}</div>
	<div class="p-4">
		<Form initial={selectedMetadata} on:change={handleMetadataSubmit} let:commit let:draft let:refresh>
			<div class="p-4 grid grid-cols-2 gap-4">
				<h3 class="col-span-3 font-bold mt-4">Configuration Information</h3>
				<TextField
					label="Configuration ID"
					value={draft.configurationID}
					on:change={(e) => {
						draft.configurationID = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Configuration Name"
					value={draft.configurationName}
					on:change={(e) => {
						draft.configurationName = e.detail.value;
						refresh();
					}}
				/>
				<div class="col-span-2">
					<TextField
						label="Configuration Description"
						multiline
						classes={{ input: 'h-[100px]' }}
						value={draft.configurationDescription}
						on:change={(e) => {
							draft.configurationDescription = e.detail.value;
							refresh();
						}}
					/>
				</div>

				<h3 class="col-span-2 font-bold mt-4">Diagnostics</h3>
				<div class="col-span-2">
					<div class="p-4">
						{#each draft.configurationData.diagnosticPortPairs as pair, index (index)}
							<div class="flex gap-4 items-center mb-4">
								<div class="flex-1">
									<SelectField
										label="Diagnostic ID"
										options={diagnosticOptions}
										value={pair.diagnosticID}
										on:change={(e) => {
											draft.configurationData.diagnosticPortPairs[index].diagnosticID = e.detail.value;
											refresh();
										}}
										placeholder="Select diagnostic"
									/>
								</div>
								<div class="flex-1">
									<TextField
										label="Port"
										value={pair.port}
										on:change={(e) => {
											draft.configurationData.diagnosticPortPairs[index].port = e.detail.value;
											refresh();
										}}
										placeholder="Enter port"
									/>
								</div>
								<button
									type="button"
									on:click={() => {
										draft.configurationData.diagnosticPortPairs = draft.configurationData.diagnosticPortPairs.filter((_, i) => i !== index);
										refresh();
									}}
									class="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 self-end mb-1"
								>
									Delete
								</button>
							</div>
						{/each}

						<!-- Blank fields for adding new pair -->
						<div class="flex gap-4 items-center mb-4 border-t pt-4">
							<div class="flex-1">
								<SelectField
									label="New Diagnostic ID"
									options={diagnosticOptions}
									value={newDiagnosticID}
									on:change={(e) => {
										newDiagnosticID = e.detail.value;
									}}
									placeholder="Select diagnostic"
								/>
							</div>
							<div class="flex-1">
								<TextField
									label="New Port"
									value={newPort}
									on:change={(e) => {
										newPort = e.detail.value ?? '';
									}}
									placeholder="Enter port"
								/>
							</div>
							<Button
								on:click={() => {
									if (newDiagnosticID && newPort) {
										draft.configurationData.diagnosticPortPairs = [...draft.configurationData.diagnosticPortPairs, { diagnosticID: newDiagnosticID, port: newPort }];
										newDiagnosticID = '';
										newPort = '';
										refresh();
									}
								}}
								variant="outline"
								disabled={!newDiagnosticID || !newPort}
							>
								Add
							</Button>
						</div>
					</div>
				</div>
			</div>
			<div class="flex gap-2 mt-4 {!isNewEntry ? 'justify-between' : 'justify-end'}">
				{#if !isNewEntry}
					<div>
						<Button on:click={handleDelete} variant="outline" color="danger">Delete</Button>
					</div>
				{/if}
				<div class="flex gap-2">
					<Button on:click={() => commit()} variant="fill">Save</Button>
					<Button on:click={handleModalClose}>Cancel</Button>
				</div>
			</div>
		</Form>
	</div>
</Dialog>

<style>
	.table-container {
		background-color: white;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		border-radius: 0.5rem;
		overflow-x: auto;
	}

	:global(.experimentInputDialog) {
		max-height: 90vh;
		overflow: hidden;
	}
</style>
