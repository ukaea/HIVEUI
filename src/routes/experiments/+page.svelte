<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, DateField, Drawer, MenuItem, sort, format, Logger } from 'svelte-ux';
	import { tableOrderStore, SelectField, Toggle, delay, cls, type MenuOption } from 'svelte-ux';
	import { page } from '$app/stores';
	import { PUBLIC_LOCAL_ONLY, PUBLIC_METACAT_URL, PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';
	import { getJsonFiles, getJsonContent } from '$lib/jsonUtils';
	import { ExperimentMetadata, HeatingTypeMetadata, PersonMetadata, CustomerMetadata, ConfigurationMetadata } from '$lib/models';

	let sortedData: ExperimentMetadata[] = [];
	let allConfigurations: ConfigurationMetadata[] = [];
	let selectedConfiguration: ConfigurationMetadata | null = null;

	const experimentOrder = tableOrderStore({ initialBy: 'experimentName', initialDirection: 'asc' });
	const configurationOrder = tableOrderStore({ initialBy: 'configurationName', initialDirection: 'asc' });

	experimentOrder.subscribe(() => {
		sortedData = sortedData.sort($experimentOrder.handler);
	});

	configurationOrder.subscribe(() => {
		allConfigurations = allConfigurations.sort($configurationOrder.handler);
	});


	let open = false;
	let selectedMetadata: ExperimentMetadata | null = null;
	let isNewEntry = false;
	let localOnly = false;

	const heatingTypeOptions: MenuOption[] = Object.values(HeatingTypeMetadata).map((type) => ({
		label: type,
		value: type
	}));

	async function fetchExperiments() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			if (localOnly) {
				const files = await getJsonFiles('experiments');
				const experimentData = await Promise.all(files.map((filename: string) => getJsonContent('experiments/' + filename)));
				const experiments = await Promise.all(experimentData.map(ExperimentMetadata.fromJSON));
				sortedData = experiments.sort($experimentOrder.handler);
				return;
			}

			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/experiments`, { headers: { Authorization: `Bearer ${accessToken}` } });

			if (!response.ok) throw new Error('Failed to fetch experiments');
			const data = await response.json();
			sortedData = data.map(ExperimentMetadata.fromJSON).sort($experimentOrder.handler);
		} catch (error) {
			console.error('Error fetching experiments:', error);
			alert('Failed to load experiments. Please try again later.');
		}
	}

	async function handleMetadataSubmit() {
		const rawMetadata = selectedMetadata;
		if (!rawMetadata || !rawMetadata.experimentUUID) {
			alert('Experiment UUID is required.');
			return;
		}
		console.log('Submitting metadata:', rawMetadata);
		try {
			await handleFileSubmission(rawMetadata);
		} catch (error) {
			console.error('File submission failed:', error);
		}

		if (localOnly) {
			handleModalClose();
			await fetchExperiments();
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
			const experimentUUID = rawMetadata.experimentUUID;
			const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/experiments/`;
			const fileName = `${experimentUUID}.json`;
			let cleanedMetadata = ExperimentMetadata.toJSON(rawMetadata);
			const saveMetadata = { targetPath: `${filePath}/${fileName}`, metadata: cleanedMetadata };

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

			const mappedMetadata = ExperimentMetadata.toJSON(rawMetadata);
			const url = `${PUBLIC_METACAT_URL}/api/v1/experiments?schema=any`;
			const method = isNewEntry ? 'POST' : 'POST';
			const endpointResponse = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(mappedMetadata) });

			if (!endpointResponse.ok) throw new Error('Failed to save experiment to endpoint');

			console.log('Experiment submitted to API successfully');
			alert(isNewEntry ? 'New experiment submitted successfully!' : 'Experiment updated successfully!');
		} catch (error) {
			console.error('Error submitting experiment to API:', error);
			alert(`Failed to submit experiment to API: ${error.message}`);
			throw error;
		}
	}

	function handleDelete(): void {
		if (!selectedMetadata) return;

		if (confirm(`Are you sure you want to delete the experiment with UUID: ${selectedMetadata.experimentUUID}?`)) {
			if (localOnly) {
				const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/experiments/${selectedMetadata.experimentUUID}.json`;
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
				fetch(`${PUBLIC_METACAT_URL}/api/v1/experiments/${selectedMetadata.experimentUUID}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
					.then((response) => {
						if (!response.ok) throw new Error('Failed to delete experiment from API');
						alert('Experiment deleted successfully');
						fetchExperiments();
					})
					.catch((error) => {
						console.error('Error deleting experiment from API:', error);
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

	function handleFormCancel() {
		handleModalClose();
	}

	onMount(() => {
		if (PUBLIC_LOCAL_ONLY == 'true') {
			localOnly = true;
		}
		fetchExperiments();
		fetchConfigurations();
	});

	async function fetchConfigurations() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			if (localOnly) {
				const files = await getJsonFiles('configurations');
				const configurationData = await Promise.all(files.map((filename: string) => getJsonContent('configurations/' + filename)));
				const configurations = await Promise.all(configurationData.map(ConfigurationMetadata.fromJSON));
				allConfigurations = configurations.sort($configurationOrder.handler);
				return;
			}

			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/experiments`, { headers: { Authorization: `Bearer ${accessToken}` } });

			if (!response.ok) throw new Error('Failed to fetch experiments');
			const data = await response.json();
			sortedData = data.map(ExperimentMetadata.fromJSON).sort($experimentOrder.handler);
		} catch (error) {
			console.error('Error fetching experiments:', error);
			alert('Failed to load experiments. Please try again later.');
		}
	}
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<div class="mb-4 flex justify-between items-center">
		<h2 class="text-2xl font-bold">Experiments</h2>
		<Button on:click={handleNewEntry} variant="fill">New Experiment</Button>
	</div>
	<div class="table-container">
		<Table
			data={sortedData}
			columns={[
				{ name: 'experimentName', align: 'left', header: 'Experiment Name' },
				{ name: 'customer.organization', align: 'left', header: 'Customer' },
				{ name: 'coilName', align: 'left', header: 'Coil Name' },
				{ name: 'leadInvestigator.email', align: 'left', header: 'Lead Investigator' },
				{ name: 'heatingType', align: 'left', header: 'Heating Type' },
				{
					name: 'experimentStart',
					align: 'left',
					header: 'Start Date',
					// @ts-expect-error
					format: (value) => {
						if (!value) return '';
						const date = new Date(value);
						return (
							date.toLocaleDateString('en-GB', {
								day: '2-digit',
								month: '2-digit',
								year: 'numeric'
							}) +
							' (' +
							date.toLocaleTimeString('en-GB', {
								hour: '2-digit',
								minute: '2-digit'
							}) +
							')'
						);
					}
				}
			]}
			order={experimentOrder}
			on:cellClick={(e) => handleRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>
</div>

<Dialog {open} on:close={handleModalClose} class="experimentInputDialog">
	<div slot="title">{isNewEntry ? 'Create New Experiment' : 'Edit Experiment Metadata'}</div>
	<div class="p-4">
		<Form initial={selectedMetadata} let:draft let:refresh let:current let:revertAll>
			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1">Customer Information</h4>
				<div class="col-span-2">
					<TextField
						label="Organization Name"
						value={draft.customer.organization}
						on:change={(e) => {
							draft.customer.organization = e.detail.value;
							refresh();
						}}
					/>
				</div>

				<TextField
					label="Contact First Name"
					value={draft.customer.contactPerson.firstName}
					on:change={(e) => {
						draft.customer.contactPerson.firstName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Contact Last Name"
					value={draft.customer.contactPerson.lastName}
					on:change={(e) => {
						draft.customer.contactPerson.lastName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Contact Email"
					value={draft.customer.contactPerson.email}
					on:change={(e) => {
						draft.customer.contactPerson.email = e.detail.value;
						refresh();
					}}
				/>
			</div>

			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1">Lead Investigator</h4>
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

			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1">Experiment Details</h4>
				<TextField
					label="Experiment Name"
					value={draft.experimentName}
					on:change={(e) => {
						draft.experimentName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Experiment UUID"
					value={isNewEntry ? (draft.experimentUUID = crypto.randomUUID()) : draft.experimentUUID}
					on:change={(e) => {
						draft.experimentUUID = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Coil Name"
					value={draft.coilName}
					on:change={(e) => {
						draft.coilName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Coil UUID"
					value={draft.coilUUID}
					on:change={(e) => {
						draft.coilUUID = e.detail.value;
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
					label="Heating Type"
					value={draft.heatingType}
					options={heatingTypeOptions}
					on:change={(e) => {
						draft.heatingType = e.detail.value;
						refresh();
					}}
				/>
				<SelectField
					label="Sample Cooling"
					value={draft.sampleCooling}
					options={[
						{ label: 'Enabled', value: true },
						{ label: 'Disabled', value: false }
					]}
					on:change={(e) => {
						draft.sampleCooling = e.detail.value;
						refresh();
					}}
				/>
			</div>

			<div class="p-4 gap-4">
				<h4 class="col-span-2 mt-1 mb-4">Configurations</h4>
				<div class="space-y-3">
					{#each draft.configurations as config, index (config.configurationUUID)}
						<div class="flex gap-2">
							<TextField
								label="Configuration Name"
								value={config.configurationName}
								on:change={(e) => {
									config.configurationName = e.detail.value;
									refresh();
								}}
							/>
							<TextField
								label="Configuration UUID"
								value={config.configurationUUID}
								on:change={(e) => {
									config.configurationUUID = e.detail.value;
									refresh();
								}}
							/>
							<Button
								on:click={() => {
									draft.configurations = draft.configurations.filter((_, i) => i !== index);
									current = draft;
									refresh();
								}}
								variant="outline"
								color="danger">Delete</Button
							>
						</div>
					{/each}
					<div class="flex gap-2">
						<SelectField
							label="Add Configuration"
							value={selectedConfiguration?.configurationUUID || ''}
							options={allConfigurations.map((config) => ({ label: config.configurationName, value: config.configurationUUID }))}
							on:change={(e) => {
								selectedConfiguration = allConfigurations.find((config) => config.configurationUUID === e.detail.value) || null;
							}}
						/>
						<Button
							on:click={() => {
								if (selectedConfiguration) {
									// Check if configuration is already added
									if (!draft.configurations.some((config) => config.configurationUUID === selectedConfiguration.configurationUUID)) {
										draft.configurations = [...draft.configurations, selectedConfiguration];
									} else {
										alert('Configuration already added to this experiment.');
									}

									selectedConfiguration = null;
									current = draft;
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
					<Button
						on:click={() => {
							selectedMetadata = current;
							handleMetadataSubmit();
						}}
						variant="fill">Save</Button
					><Button
						on:click={() => {
							revertAll();
							handleFormCancel();
						}}
						style={{ marginLeft: 'auto' }}>Cancel</Button
					>
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
