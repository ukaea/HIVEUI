<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, DateField, Drawer, MenuItem, sort, format, Logger } from 'svelte-ux';
	import { tableOrderStore, SelectField, Toggle, delay, cls, type MenuOption } from 'svelte-ux';
	import { page } from '$app/stores';
	import { PUBLIC_LOCAL_ONLY, PUBLIC_METACAT_URL, PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';
	import { getJsonFiles, getJsonContent } from '$lib/jsonUtils';
	import { CampaignMetadata, ExperimentMetadata } from '$lib/models';

	let sortedData: CampaignMetadata[] = [];
	const campaignOrder = tableOrderStore({ initialBy: 'campaignName', initialDirection: 'asc' });

	campaignOrder.subscribe(() => {
		sortedData = sortedData.sort($campaignOrder.handler);
	});

	let allExperiments: ExperimentMetadata[] = [];
	let selectedExperiment: ExperimentMetadata | null = null;

	let open = false;
	let selectedMetadata: CampaignMetadata | null = null;
	let isNewEntry = false;
	let localOnly = false;

	async function fetchCampaigns() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			if (localOnly) {
				const files = await getJsonFiles('campaigns');
				const campaignData = await Promise.all(files.map((filename: string) => getJsonContent('campaigns/' + filename)));
				const campaigns = await Promise.all(campaignData.map(CampaignMetadata.fromJSON));
				sortedData = campaigns.sort($campaignOrder.handler);
				return;
			}

			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/proposals`, { headers: { Authorization: `Bearer ${accessToken}` } });

			if (!response.ok) throw new Error('Failed to fetch proposals');
			const data = await response.json();
			sortedData = data.map(CampaignMetadata.fromJSON).sort($campaignOrder.handler);
		} catch (error) {
			console.error('Error fetching proposals:', error);
			alert('Failed to load proposals. Please try again later.');
		}
	}

	async function handleMetadataSubmit(event: CustomEvent<CampaignMetadata>) {
		const rawMetadata = event.detail;
		try {
			await handleFileSubmission(rawMetadata);
		} catch (error) {
			console.error('File submission failed:', error);
		}

		if (localOnly) {
			handleModalClose();
			await fetchCampaigns(); // Refresh the data
			return;
		}

		try {
			await handleAPISubmission(rawMetadata, isNewEntry);
			handleModalClose();
			await fetchCampaigns();
		} catch (error) {
			console.error('API submission failed:', error);
		}
	}

	async function handleFileSubmission(rawMetadata: CampaignMetadata): Promise<void> {
		try {
			const campaignUUID = rawMetadata.campaignUUID;
			const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/campaigns/`;
			const fileName = `${campaignUUID}.json`;

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

	async function handleAPISubmission(rawMetadata: CampaignMetadata, isNewEntry: boolean): Promise<void> {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			const mappedMetadata = CampaignMetadata.toJSON(rawMetadata);
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

		if (confirm(`Are you sure you want to delete the campaign with UUID: ${selectedMetadata.campaignUUID}?`)) {
			if (localOnly) {
				const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/campaigns/${selectedMetadata.campaignUUID}.json`;
				fetch('/api/delete-json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetPath: filePath }) })
					.then((response) => {
						if (!response.ok) throw new Error('Failed to delete local file');
						alert('Campaign deleted successfully');
						fetchCampaigns();
					})
					.catch((error) => {
						console.error('Error deleting local file:', error);
						alert(`Failed to delete campaign: ${error.message}`);
					});
			} else {
				const accessToken = $page.data.session?.sessionToken;
				fetch(`${PUBLIC_METACAT_URL}/api/v1/proposals/${selectedMetadata.campaignUUID}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
					.then((response) => {
						if (!response.ok) throw new Error('Failed to delete proposal from API');
						alert('Campaign deleted successfully');
						fetchCampaigns();
					})
					.catch((error) => {
						console.error('Error deleting proposal from API:', error);
						alert(`Failed to delete campaign: ${error.message}`);
					});
			}
			handleModalClose();
		}
	}

	function handleRowClick(row: CampaignMetadata): void {
		selectedMetadata = { ...row };
		isNewEntry = false;
		open = true;
	}

	function handleNewEntry(): void {
		selectedMetadata = { ...new CampaignMetadata() };
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
		fetchCampaigns();
		fetchExperiments();
	});

	async function fetchExperiments() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			if (localOnly) {
				const files = await getJsonFiles('experiments');
				const experimentData = await Promise.all(files.map((filename: string) => getJsonContent('experiments/' + filename)));
				allExperiments = await Promise.all(experimentData.map(ExperimentMetadata.fromJSON));
				return;
			}

			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/proposals`, { headers: { Authorization: `Bearer ${accessToken}` } });

			if (!response.ok) throw new Error('Failed to fetch proposals');
			const data = await response.json();
			sortedData = data.map(CampaignMetadata.fromJSON).sort($campaignOrder.handler);
		} catch (error) {
			console.error('Error fetching proposals:', error);
			alert('Failed to load proposals. Please try again later.');
		}
	}
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<div class="mb-4 flex justify-between items-center">
		<h2 class="text-2xl font-bold">Campaigns</h2>
		<Button on:click={handleNewEntry} variant="fill">New Campaign</Button>
	</div>
	<div class="table-container">
		<Table
			data={sortedData}
			columns={[
				{ name: 'campaignName', align: 'left', header: 'Campaign Name' },
				{ name: 'customerOrg', align: 'left', header: 'Customer Organization' },
				{ name: 'customerContactPerson', align: 'left', header: 'Customer Contact' }
			]}
			order={campaignOrder}
			on:cellClick={(e) => handleRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>
</div>

<Dialog {open} on:close={handleModalClose} class="campaignInputDialog">
	<div slot="title">{isNewEntry ? 'Create New Campaign' : 'Edit Campaign Metadata'}</div>
	<div class="p-4">
		<Form initial={selectedMetadata} on:change={handleMetadataSubmit} let:commit let:draft let:refresh>
			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1">Campaign</h4>
				<TextField
					label="Campaign Name"
					value={draft.campaignName}
					on:change={(e) => {
						draft.campaignName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Campaign UUID"
					value={draft.campaignUUID}
					on:change={(e) => {
						draft.campaignUUID = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Customer Organization"
					value={draft.customerOrg}
					on:change={(e) => {
						draft.customerOrg = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Customer Contact"
					value={draft.customerContactPerson.email}
					on:change={(e) => {
						draft.customerContactPerson.email = e.detail.value;
						refresh();
					}}
				/>
			</div>

			<div class="p-4 gap-4">
				<h4 class="col-span-2 mt-1 mb-4">Experiments</h4>
				<div class="space-y-3">
					{#each draft.experiments as experiment, index (experiment.experimentUUID)}
						<div class="flex gap-2">
							<TextField
								label="Experiment Name"
								value={experiment.experimentName}
								on:change={(e) => {
									experiment.experimentName = e.detail.value;
									refresh();
								}}
							/>
							<TextField
								label="Experiment UUID"
								value={experiment.experimentUUID}
								on:change={(e) => {
									experiment.experimentUUID = e.detail.value;
									refresh();
								}}
							/>
							<Button
								on:click={() => {
									draft.experiments = draft.experiments.filter((_, i) => i !== index);
								}}
								variant="outline"
								color="danger">Delete</Button>
						</div>
					{/each}
					<div class="flex gap-2">
						<SelectField
							label="Add Experiment"
							options={allExperiments.map((exp) => ({ label: exp.experimentName, value: exp.experimentUUID }))}
							on:change={(e) => {
								selectedExperiment = allExperiments.find((exp) => exp.experimentUUID === e.detail.value) || null;
							}}
						/>
						<Button
							on:click={() => {
								if (selectedExperiment) {
									draft.experiments = [...draft.experiments, selectedExperiment];
									console.log('All experiments:', draft.experiments);
									refresh();
								}
							}}
							variant="fill"
							color="primary">Add</Button
						>
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

	:global(.campaignInputDialog) {
		max-height: 900px;
		overflow: hidden;
	}
</style>
