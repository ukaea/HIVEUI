<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, DateField } from 'svelte-ux';
	import { tableOrderStore } from 'svelte-ux';
	import { page } from '$app/stores';
	import { PUBLIC_METACAT_URL, PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';

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
		experimentStart: string;
		experimentEnd: string;
		experimentType: string;
		sampleCooling: string;
		constructor() {
			this.campaignID = '';
			this.experimentID = '';
			this.leadInvestigator = new Person();
			this.customer = '';
			this.experimentStart = '';
			this.experimentEnd = '';
			this.experimentType = '';
			this.sampleCooling = '';
		}
	}

	let sortedData: ExperimentMetadata[] = [];
	const order = tableOrderStore({ initialBy: 'experimentID', initialDirection: 'asc' });
	let open = false;
	let selectedMetadata: ExperimentMetadata | null = null;
	let isNewEntry = false;

	function mapScicatToExperiment(apiResponse: any): ExperimentMetadata {
		const metadata = new ExperimentMetadata();

		metadata.experimentID = apiResponse.proposalId || '';
		metadata.campaignID = ''; // Not available in the API response

		metadata.leadInvestigator = {
			firstName: apiResponse.pi_firstname || '',
			lastName: apiResponse.pi_lastname || '',
			email: apiResponse.pi_email || ''
		};

		metadata.customer = '';

		// Handle MeasurementPeriodList
		if (apiResponse.MeasurementPeriodList && apiResponse.MeasurementPeriodList.length > 0) {
			const measurement = apiResponse.MeasurementPeriodList[0];
			metadata.experimentStart = measurement.start || '';
			metadata.experimentEnd = measurement.end || '';
		}

		metadata.sampleCooling = '';
		return metadata;
	}

	function mapExperimentToScicat(metadata: ExperimentMetadata): any {
		return {
			proposalId: metadata.experimentID,
			pi_firstname: metadata.leadInvestigator.firstName,
			pi_lastname: metadata.leadInvestigator.lastName,
			pi_email: metadata.leadInvestigator.email,
			email: metadata.leadInvestigator.email,
			ownerGroup: metadata.customer || 'default_group',
			title: metadata.experimentType || 'Untitled Experiment',
			MeasurementPeriodList: [
				{
					start: metadata.experimentStart,
					end: metadata.experimentEnd,
					instrument: metadata.experimentType
				}
			],

			abstract: '',
			sampleCooling: metadata.sampleCooling,
			campaignId: metadata.campaignID
		};
	}

	async function fetchProposals() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}
			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/proposals?filter=%7B%7D`, {
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});
			if (!response.ok) throw new Error('Failed to fetch proposals');
			const data = await response.json();
			// Map the API response to ExperimentMetadata
			sortedData = data.map(mapScicatToExperiment).sort($order.handler);
		} catch (error) {
			console.error('Error fetching proposals:', error);
			alert('Failed to load proposals. Please try again later.');
		}
	}

	async function handleMetadataSubmit(event: CustomEvent<ExperimentMetadata>) {
		const rawMetadata = event.detail;
		console.log('Raw metadata:', rawMetadata);

		try {
			await handleFileSubmission(rawMetadata);
		} catch (error) {
			console.error('File submission failed:', error);
		}

		try {
			await handleAPISubmission(rawMetadata, isNewEntry);
			handleModalClose();
		} catch (error) {
			console.error('API submission failed:', error);
		}
	}

	async function handleFileSubmission(rawMetadata: ExperimentMetadata): Promise<void> {
		try {
			const experimentID = rawMetadata.experimentID;
			const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/experiments/`;
			const fileName = `${experimentID}.json`;

			const saveMetadata = {
				targetPath: `${filePath}/${fileName}`,
				metadata: rawMetadata
			};

			const fileResponse = await fetch('/api/save-json', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(saveMetadata)
			});

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

			const mappedMetadata = mapExperimentToScicat(rawMetadata);
			console.log('Mapped metadata:', mappedMetadata);

			const url = `${PUBLIC_METACAT_URL}/api/v1/proposals?schema=any`;
			const method = isNewEntry ? 'POST' : 'POST';
			const endpointResponse = await fetch(url, {
				method: method,
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify(mappedMetadata)
			});

			if (!endpointResponse.ok) throw new Error('Failed to save proposal to endpoint');

			console.log('Proposal submitted to API successfully');
			alert(isNewEntry ? 'New proposal submitted successfully!' : 'Proposal updated successfully!');

			await fetchProposals(); // Refresh the data
		} catch (error) {
			console.error('Error submitting proposal to API:', error);
			alert(`Failed to submit proposal to API: ${error.message}`);
			throw error; // Re-throw the error if you want calling code to handle it
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
		fetchProposals();
	});
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
				{ name: 'experimentType', align: 'left', header: 'Experiment Type' },
				{ name: 'experimentStart', align: 'left', header: 'Experiment Start' },
				{ name: 'sampleCooling', align: 'left', header: 'Sample Cooling' }
			]}
			{order}
			on:cellClick={(e) => handleRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>
</div>

<Dialog {open} on:close={handleModalClose}>
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
					value={draft.experimentStart}
					on:change={(e) => {
						draft.experimentStart = e.detail.value;
						refresh();
					}}
				/>
				<DateField
					label="Experiment End"
					type="datetime-local"
					value={draft.experimentEnd}
					on:change={(e) => {
						draft.experimentEnd = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Experiment Type"
					value={draft.experimentType}
					on:change={(e) => {
						draft.experimentType = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Customer"
					value={draft.customer}
					on:change={(e) => {
						draft.customer = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Sample Cooling"
					value={draft.sampleCooling}
					on:change={(e) => {
						draft.sampleCooling = e.detail.value;
						refresh();
					}}
				/>
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

			<div class="flex justify-end gap-2 mt-4">
				<Button on:click={() => commit()} variant="fill">Save</Button>
				<Button on:click={handleModalClose}>Cancel</Button>
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
