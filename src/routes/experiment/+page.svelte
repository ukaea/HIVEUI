<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, DateField, Drawer, MenuItem } from 'svelte-ux';
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

	class ExperimentMetadata {
		campaignID: string;
		experimentID: string;
		leadInvestigator: Person;
		customer: string;
		experimentStart: Date;
		experimentEnd: string;
		experimentType: string;
		sampleCooling: string;
		coilID: string;
		constructor() {
			this.campaignID = '';
			this.experimentID = '';
			this.leadInvestigator = new Person();
			this.customer = '';
			this.experimentStart = new Date();
			this.experimentEnd = '';
			this.experimentType = '';
			this.sampleCooling = '';
			this.coilID = '';
		}
	}

	let sortedData: ExperimentMetadata[] = [];
	const order = tableOrderStore({ initialBy: 'experimentID', initialDirection: 'asc' });
	let open = false;
	let selectedMetadata: ExperimentMetadata | null = null;
	let isNewEntry = false;
	let localOnly = false;

	function mapJSONToExperiment(apiResponse: any): ExperimentMetadata {
		const metadata = new ExperimentMetadata();
		const mapped = Object.assign(metadata, apiResponse);

		// Convert date strings to Date objects
		if (mapped.experimentStart) {
			mapped.experimentStart = new Date(mapped.experimentStart);
		}
		if (mapped.experimentEnd) {
			mapped.experimentEnd = new Date(mapped.experimentEnd);
		}

		return mapped;
	}

	function mapExperimentToJSON(metadata: ExperimentMetadata): any {
		return { ...metadata };
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
				sortedData = data.map(mapJSONToExperiment).sort($order.handler);

				// Log the sorted data and type of each entry
				console.log('Sorted Data:', sortedData);
				return;
			}

			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/proposals`, { headers: { Authorization: `Bearer ${accessToken}` } });

			if (!response.ok) throw new Error('Failed to fetch proposals');
			const data = await response.json();
			sortedData = data.map(mapJSONToExperiment).sort($order.handler);
		} catch (error) {
			console.error('Error fetching proposals:', error);
			alert('Failed to load proposals. Please try again later.');
		}
	}

	async function handleMetadataSubmit(event: CustomEvent<ExperimentMetadata>) {
		const rawMetadata = event.detail;
		try {
			await handleFileSubmission(rawMetadata);
		} catch (error) {
			console.error('File submission failed:', error);
		}

		if (localOnly) {
			handleModalClose();
			await fetchExperiments(); // Refresh the data
			return;
		}

		try {
			await handleAPISubmission(rawMetadata, isNewEntry);
			handleModalClose();
			await fetchExperiments();
		} catch (error) {
			console.error('API submission failed:', error);
		}
	}

	async function handleFileSubmission(rawMetadata: ExperimentMetadata): Promise<void> {
		try {
			const experimentID = rawMetadata.experimentID;
			const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/experiments/`;
			const fileName = `${experimentID}.json`;

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

	async function handleAPISubmission(rawMetadata: ExperimentMetadata, isNewEntry: boolean): Promise<void> {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			const mappedMetadata = mapExperimentToJSON(rawMetadata);
			console.log('Mapped metadata:', mappedMetadata);

			const url = `${PUBLIC_METACAT_URL}/api/v1/proposals?schema=any`;
			const method = isNewEntry ? 'POST' : 'POST';
			const endpointResponse = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(mappedMetadata) });

			if (!endpointResponse.ok) throw new Error('Failed to save proposal to endpoint');

			console.log('Proposal submitted to API successfully');
			alert(isNewEntry ? 'New proposal submitted successfully!' : 'Proposal updated successfully!');
		} catch (error) {
			console.error('Error submitting proposal to API:', error);
			alert(`Failed to submit proposal to API: ${error.message}`);
			throw error; // Re-throw the error if you want calling code to handle it
		}
	}

	function handleDelete(): void {
		if (!selectedMetadata) return;

		if (confirm(`Are you sure you want to delete the experiment with ID: ${selectedMetadata.experimentID}?`)) {
			if (localOnly) {
				const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/experiments/${selectedMetadata.experimentID}.json`;
				fetch('/api/delete-json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetPath: filePath }) })
					.then((response) => {
						if (!response.ok) throw new Error('Failed to delete local file');
						alert('Experiment deleted successfully');
						fetchExperiments();
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
						fetchExperiments();
					})
					.catch((error) => {
						console.error('Error deleting proposal from API:', error);
						alert(`Failed to delete experiment: ${error.message}`);
					});
			}
			handleModalClose();
		}
	}

	function handleRowClick(row: ExperimentMetadata): void {
		selectedMetadata = { ...row };
		isNewEntry = false;
		open = true;
	}

	function handleNewEntry(): void {
		selectedMetadata = { ...new ExperimentMetadata() };
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
	});
	let experimentOptions: MenuOption[] = [
		{ label: 'Induction', value: 'Induction' },
		{ label: 'Direct Current', value: 'Direct Current' }
	];
	let sampleCoolingOptions: MenuOption[] = [
		{ label: 'Yes', value: true },
		{ label: 'No', value: false }
	];
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<div class="mb-4 flex justify-between items-center">
		<h2 class="text-2xl font-bold">Experiment Metadata</h2>
		<Button on:click={handleNewEntry} variant="fill">New Experiment</Button>
	</div>
	<div class="table-container">
		<Table
			data={sortedData}
			columns={[
				{ name: 'experimentID', align: 'left', header: 'Experiment ID' },
				{ name: 'campaignID', align: 'left', header: 'Campaign ID' },
				{
					name: 'leadInvestigator',
					align: 'left',
					header: 'Lead Investigator',
					// @ts-expect-error
					format: (value) => {
						if (!value || !value.firstName || !value.lastName) return '';
						return value.firstName + ' ' + value.lastName;
					}
				},
				{ name: 'customer', align: 'left', header: 'Customer' },
				{ name: 'experimentType', align: 'left', header: 'Experiment Type' },
				{
					name: 'experimentStart',
					align: 'left',
					header: 'Experiment Start',
					// @ts-expect-error
					format: (value) => {
						if (!value) return '';
						const date = new Date(value);
						return date.toLocaleDateString('en-GB', {
							day: '2-digit',
							month: '2-digit',
							year: 'numeric'
						});
					}
				},
				{
					name: 'experimentEnd',
					align: 'left',
					header: 'Experiment End',
					// @ts-expect-error
					format: (value) => {
						if (!value) return '';
						const date = new Date(value);
						return date.toLocaleDateString('en-GB', {
							day: '2-digit',
							month: '2-digit',
							year: 'numeric'
						});
					}
				},
			]}
			{order}
			on:cellClick={(e) => handleRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>
</div>

<Dialog {open} on:close={handleModalClose} class="experimentInputDialog">
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
					format="dd/MM/yyyy"
					picker
					clearable
					value={draft.experimentStart}
					on:change={(e) => {
						draft.experimentStart = e.detail.value;
						refresh();
					}}
				/>
				<DateField
					label="Experiment End"
					format="dd/MM/yyyy"
					picker
					clearable
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
</Dialog>

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
