<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, DateField, Drawer, MenuItem, map } from 'svelte-ux';
	import { tableOrderStore, SelectField, Toggle, delay, cls, type MenuOption } from 'svelte-ux';
	import { page } from '$app/stores';
	import { PUBLIC_LOCAL_ONLY, PUBLIC_METACAT_URL, PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';
	import { getJsonFiles, getJsonContent } from '$lib/jsonUtils';

	class Person {
		firstName: string;
		lastName: string;
		email: string;

		constructor() {
			this.firstName = '';
			this.lastName = '';
			this.email = '';
		}
	}

	class ExperimentSelectMetadata {
		experimentID: string;
		constructor() {
			this.experimentID = '';
		}
	}

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
		configurationExperiment: string;
		configurationData: ConfigurationData;

		constructor() {
			this.configurationID = '';
			this.configurationName = '';
			this.configurationDescription = '';
			this.configurationExperiment = '';
			this.configurationData = new ConfigurationData();
		}
	}

	let sortedData: ConfigurationMetadata[] = [];
	let sortedExperiments: ExperimentSelectMetadata[] = [];
	let sortedDiagnostics: DiagnosticSelectMetadata[] = [];
	let experimentOptions: MenuOption[] = [];
	let diagnosticOptions: MenuOption[] = [];
	const order = tableOrderStore({ initialBy: 'configurationID', initialDirection: 'asc' });
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

	function mapToExperiment(apiResponse: any): ExperimentSelectMetadata {
		const metadata = new ExperimentSelectMetadata();
		// Assume all fields are valid
		return Object.assign(metadata, apiResponse);
	}

	function mapToDiagnostic(apiResponse: any): DiagnosticSelectMetadata {
		const metadata = new DiagnosticSelectMetadata();
		// Assume all fields are valid
		return Object.assign(metadata, apiResponse);
	}

	async function fetchExperiments() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			if (localOnly) {
				const files = await getJsonFiles('experiments');
				const data = await Promise.all(files.map((filename: string) => getJsonContent('experiments/' + filename)));
				sortedExperiments = data.map(mapToExperiment).sort($order.handler);
				experimentOptions = sortedExperiments.map((experiment) => {
					return { label: experiment.experimentID, value: experiment.experimentID };
				});
				return;
			}

			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/proposals?filter=%7B%7D`, { headers: { Authorization: `Bearer ${accessToken}` } });

			if (!response.ok) throw new Error('Failed to fetch proposals');
			const data = await response.json();
			// Map the API response to ExperimentMetadata
			sortedExperiments = data.map(mapToExperiment).sort($order.handler);
			experimentOptions = sortedExperiments.map((experiment) => {
				return { label: experiment.experimentID, value: experiment.experimentID };
			});
		} catch (error) {
			console.error('Error fetching proposals:', error);
			alert('Failed to load proposals. Please try again later.');
		}
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
				sortedDiagnostics = data.map(mapToDiagnostic).sort($order.handler);
				diagnosticOptions = sortedDiagnostics.map((diagnostic) => {
					return { label: diagnostic.diagnosticID, value: diagnostic.diagnosticID };
				});
				return;
			}

			//FIX
			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/proposals?filter=%7B%7D`, { headers: { Authorization: `Bearer ${accessToken}` } });

			if (!response.ok) throw new Error('Failed to fetch proposals');
			const data = await response.json();
			// Map the API response to ExperimentMetadata
			sortedExperiments = data.map(mapToExperiment).sort($order.handler);
			experimentOptions = sortedExperiments.map((experiment) => {
				return { label: experiment.experimentID, value: experiment.experimentID };
			});
		} catch (error) {
			console.error('Error fetching proposals:', error);
			alert('Failed to load proposals. Please try again later.');
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

			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/proposals`, { headers: { Authorization: `Bearer ${accessToken}` } });

			if (!response.ok) throw new Error('Failed to fetch proposals');
			const data = await response.json();
			sortedData = data.map(mapJSONToConfiguration).sort($order.handler);
		} catch (error) {
			console.error('Error fetching proposals:', error);
			alert('Failed to load proposals. Please try again later.');
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
						alert('Experiment deleted successfully');
						fetchConfigurations();
					})
					.catch((error) => {
						console.error('Error deleting local file:', error);
						alert(`Failed to delete experiment: ${error.message}`);
					});
			} else {
				const accessToken = $page.data.session?.sessionToken;
				fetch(`${PUBLIC_METACAT_URL}/api/v1/proposals/${selectedMetadata.experimentID}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
					.then((response) => {
						if (!response.ok) throw new Error('Failed to delete proposal from API');
						alert('Experiment deleted successfully');
						fetchConfigurations();
					})
					.catch((error) => {
						console.error('Error deleting proposal from API:', error);
						alert(`Failed to delete experiment: ${error.message}`);
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

	onMount(() => {
		if (PUBLIC_LOCAL_ONLY == 'true') {
			localOnly = true;
		}
		fetchExperiments();
		fetchDiagnostics();
		fetchConfigurations();
	});
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<div class="mb-4 flex justify-between items-center">
		<h2 class="text-2xl font-bold">Configuration Metadata</h2>
		<!-- <Button on:click={handleNewEntry} variant="fill">New Configuration</Button> -->
	</div>
	
	Coming soon

	<!-- <div class="space-y-6">
		{#each sortedData as configuration}
			<div class="bg-white rounded-lg shadow-md p-4">
				<div class="mb-4 border-b pb-3">
					<div class="flex justify-between items-start">
						<div>
							<h3 class="text-lg font-semibold text-gray-800">{configuration.configurationName}</h3>
							<p class="text-sm text-gray-600">ID: {configuration.configurationID}</p>
							<p class="text-sm text-gray-600">Experiment: {configuration.configurationExperiment}</p>
							{#if configuration.configurationDescription}
								<p class="text-sm text-gray-500 mt-1">{configuration.configurationDescription}</p>
							{/if}
						</div>
						<Button 
							on:click={() => handleRowClick(configuration)} 
							variant="outline"
							class="text-sm"
						>
							Edit
						</Button>
					</div>
				</div>

				<div class="table-container">
					<h4 class="text-md font-medium text-gray-700 mb-2">Diagnostic Configuration</h4>
					{#if configuration.configurationData.diagnosticPortPairs.length > 0}
						<Table
							data={configuration.configurationData.diagnosticPortPairs}
							columns={[
								{ name: 'diagnosticID', align: 'left', header: 'Diagnostic ID' },
								{ name: 'port', align: 'left', header: 'Port' }
							]}
							class="styled-table diagnostic-pairs-table"
						/>
					{:else}
						<div class="text-gray-500 text-sm italic py-2">
							No diagnostic port pairs configured
						</div>
					{/if}
				</div>
			</div>
		{/each}

		{#if sortedData.length === 0}
			<div class="text-center text-gray-500 py-8">
				<p>No configurations found</p>
			</div>
		{/if}
	</div> -->
</div>

<!-- <Dialog {open} on:close={handleModalClose} class="experimentInputDialog">
	<div slot="title">{isNewEntry ? 'Create New Experiment' : 'Edit Experiment Metadata'}</div>
	<div class="p-4">
		<Form initial={selectedMetadata} on:change={handleMetadataSubmit} let:commit let:draft let:refresh>
			<div class="p-4 grid grid-cols-2 gap-4">
				<TextField
					label="Experiment ID"
					value={draft.experimentID}
					on:change={(e) => {
						draft.experimentID = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Campaign ID"
					value={draft.campaignID}
					on:change={(e) => {
						draft.campaignID = e.detail.value;
						refresh();
					}}
				/>
				<DateField
					label="Experiment Start"
					type="datetime-local"
					format="dd/mm/yyyy"
					value={draft.experimentStart}
					on:change={(e) => {
						draft.experimentStart = e.detail.value;
						refresh();
					}}
				/>
				<DateField
					label="Experiment End"
					type="datetime-local"
					format="dd/mm/yyyy"
					value={draft.experimentEnd}
					on:change={(e) => {
						draft.experimentEnd = e.detail.value;
						refresh();
					}}
				/>
				<SelectField
					options={experimentOptions}
					label="Experiment Type"
					value={draft.experimentType}
					autoplacement={false}
					on:change={(e) => {
						draft.experimentType = e.detail.value;
						refresh();
					}}
				/>
				{#if draft.experimentType == 'Induction'}
					<TextField
						label="Coil ID"
						value={draft.coilID}
						on:change={(e) => {
							draft.coilID = e.detail.value;
							refresh();
						}}
					/>
				{/if}
				<TextField
					label="Customer"
					value={draft.customer}
					on:change={(e) => {
						draft.customer = e.detail.value;
						refresh();
					}}
				/>
				<br />
				<h4 class="col-span-2 mt-1">Lead Investigator</h4>
				<div class="col-span-2 grid grid-cols-3 gap-4">
					<TextField
						label="First Name"
						value={draft.leadInvestigator.firstName}
						on:change={(e) => {
							draft.leadInvestigator.firstName = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Last Name"
						value={draft.leadInvestigator.lastName}
						on:change={(e) => {
							draft.leadInvestigator.lastName = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Email"
						value={draft.leadInvestigator.email}
						on:change={(e) => {
							draft.leadInvestigator.email = e.detail.value;
							refresh();
						}}
					/>
				</div>
				<SelectField
					options={sampleCoolingOptions}
					label="Sample Cooling"
					value={draft.sampleCooling}
					on:change={(e) => {
						draft.sampleCooling = e.detail.value;
						refresh();
					}}
				/>
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
</Dialog> -->

<style>
	.table-container {
		background-color: white;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		border-radius: 0.5rem;
		overflow: hidden;
	}

	:global(.experimentInputDialog) {
		max-height: 900px;
		overflow: hidden;
	}

	:global(.styled-table) {
		width: 100%;
		border-collapse: collapse;
	}

	:global(.styled-table th) {
		background-color: #2563eb;
		color: white;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.75rem 1.5rem;
		text-align: left;
	}

	:global(.styled-table td) {
		padding: 1rem 1.5rem;
		color: #1f2937;
	}

	:global(.styled-table tr:nth-child(even)) {
		background-color: #f9fafb;
	}

	:global(.styled-table tr:hover) {
		background-color: #f3f4f6;
	}
</style>
