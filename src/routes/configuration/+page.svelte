<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, Drawer, MenuItem, sort, format, Logger } from 'svelte-ux';
	import { tableOrderStore, SelectField, Toggle, delay, cls, type MenuOption } from 'svelte-ux';
	import { page } from '$app/stores';
	import { PUBLIC_LOCAL_ONLY, PUBLIC_METACAT_URL, PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';
	import { getJsonFiles, getJsonContent } from '$lib/jsonUtils';
	import { ConfigurationMetadata, CombinationMetadata } from '$lib/models';

	let sortedData: ConfigurationMetadata[] = [];
	const configurationOrder = tableOrderStore({ initialBy: 'configurationName', initialDirection: 'asc' });

	configurationOrder.subscribe(() => {
		sortedData = sortedData.sort($configurationOrder.handler);
	});

	let allEquipment: any[] = [];
	let allCombinations: CombinationMetadata[] = [];
	let selectedEquipment: any = null;
	let selectedCombination: CombinationMetadata | null = null;

	// Main configuration dialog
	let open = false;
	let selectedMetadata: ConfigurationMetadata | null = null;
	let isNewEntry = false;

	// Combination creation dialog
	let combinationDialogOpen = false;
	let newCombination: CombinationMetadata | null = null;
	let isNewCombination = false;

	let localOnly = false;

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
				sortedData = configurations.sort($configurationOrder.handler);
				return;
			}

			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/configurations`, { headers: { Authorization: `Bearer ${accessToken}` } });

			if (!response.ok) throw new Error('Failed to fetch configurations');
			const data = await response.json();
			const configurations = await Promise.all(data.map(ConfigurationMetadata.fromJSON));
			sortedData = configurations.sort($configurationOrder.handler);
		} catch (error) {
			console.error('Error fetching configurations:', error);
			alert('Failed to load configurations. Please try again later.');
		}
	}

	async function fetchCombinations() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			if (localOnly) {
				const files = await getJsonFiles('combinations');
				const combinationData = await Promise.all(files.map((filename: string) => getJsonContent('combinations/' + filename)));
				const combinations = await Promise.all(combinationData.map(CombinationMetadata.fromJSON));
				allCombinations = combinations;
				return;
			}

			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/combinations`, { headers: { Authorization: `Bearer ${accessToken}` } });

			if (!response.ok) throw new Error('Failed to fetch combinations');
			const data = await response.json();
			const combinations = await Promise.all(data.map(CombinationMetadata.fromJSON));
			allCombinations = combinations;
		} catch (error) {
			console.error('Error fetching combinations:', error);
			alert('Failed to load combinations. Please try again later.');
		}
	}

	async function fetchEquipment() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			if (localOnly) {
				const files = await getJsonFiles('equipment');
				const equipmentData = await Promise.all(files.map((filename: string) => getJsonContent('equipment/' + filename)));

				allEquipment = equipmentData.map((data: any) => {
					const equipmentType = data.equipmentType || 'unknown';
					let name = '';
					let make = '';
					let model = '';

					if (data.deviceInformation) {
						make = data.deviceInformation.make || '';
						model = data.deviceInformation.model || '';
						name = `${make} ${model}`.trim();
					} else if (equipmentType === 'thermocouple') {
						name = `${data.tcType || 'Thermocouple'} - ${data.location || 'Unknown Location'}`;
						make = data.tcType || '';
						model = data.attachment || '';
					}

					return {
						...data,
						equipmentName: name || `${equipmentType} - ${data.equipmentUUID || 'No UUID'}`,
						equipmentType: equipmentType,
						make: make,
						model: model
					};
				});
				return;
			}

			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/equipment`, { headers: { Authorization: `Bearer ${accessToken}` } });

			if (!response.ok) throw new Error('Failed to fetch equipment');
			const data = await response.json();
			allEquipment = data;
		} catch (error) {
			console.error('Error fetching equipment:', error);
			alert('Failed to load equipment. Please try again later.');
		}
	}

	async function handleConfigurationSubmit() {
		const rawMetadata = selectedMetadata;
		if (!rawMetadata || !rawMetadata.configurationUUID) {
			alert('Configuration UUID is required.');
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
			await fetchConfigurations();
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
			const configurationUUID = rawMetadata.configurationUUID;
			const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/configurations/`;
			const fileName = `${configurationUUID}.json`;
			let cleanedMetadata = ConfigurationMetadata.toJSON(rawMetadata);
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

	async function handleAPISubmission(rawMetadata: ConfigurationMetadata, isNewEntry: boolean): Promise<void> {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			const mappedMetadata = ConfigurationMetadata.toJSON(rawMetadata);
			const url = `${PUBLIC_METACAT_URL}/api/v1/configurations?schema=any`;
			const method = isNewEntry ? 'POST' : 'POST';
			const endpointResponse = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(mappedMetadata) });

			if (!endpointResponse.ok) throw new Error('Failed to save configuration to endpoint');

			console.log('Configuration submitted to API successfully');
			alert(isNewEntry ? 'New configuration submitted successfully!' : 'Configuration updated successfully!');
		} catch (error) {
			console.error('Error submitting configuration to API:', error);
			alert(`Failed to submit configuration to API: ${error.message}`);
			throw error;
		}
	}

	async function handleCombinationSubmit() {
		if (!newCombination || !newCombination.combinationUUID) {
			alert('Combination UUID is required.');
			return;
		}

		try {
			await handleCombinationFileSubmission(newCombination);

			if (!localOnly) {
				await handleCombinationAPISubmission(newCombination, isNewCombination);
			}

			handleCombinationDialogClose();
			alert('Combination created successfully!');
			await fetchCombinations();
		} catch (error) {
			console.error('Error submitting combination:', error);
		}
	}

	async function handleCombinationFileSubmission(rawMetadata: CombinationMetadata): Promise<void> {
		try {
			const combinationUUID = rawMetadata.combinationUUID;
			const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/combinations/`;
			const fileName = `${combinationUUID}.json`;
			let cleanedMetadata = CombinationMetadata.toJSON(rawMetadata);
			const saveMetadata = { targetPath: `${filePath}/${fileName}`, metadata: cleanedMetadata };

			const fileResponse = await fetch('/api/save-json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(saveMetadata) });

			if (!fileResponse.ok) {
				const errorData = await fileResponse.json();
				throw new Error(`Failed to save combination file: ${errorData.message}`);
			}

			console.log('Combination file saved successfully');
		} catch (error) {
			console.error('Error saving combination file:', error);
			alert(`Failed to save combination file: ${error.message}`);
			throw error;
		}
	}

	async function handleCombinationAPISubmission(rawMetadata: CombinationMetadata, isNewEntry: boolean): Promise<void> {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			const mappedMetadata = CombinationMetadata.toJSON(rawMetadata);
			const url = `${PUBLIC_METACAT_URL}/api/v1/combinations?schema=any`;
			const method = isNewEntry ? 'POST' : 'POST';
			const endpointResponse = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(mappedMetadata) });

			if (!endpointResponse.ok) throw new Error('Failed to save combination to endpoint');

			console.log('Combination submitted to API successfully');
		} catch (error) {
			console.error('Error submitting combination to API:', error);
			alert(`Failed to submit combination to API: ${error.message}`);
			throw error;
		}
	}

	function handleDelete(): void {
		if (!selectedMetadata) return;

		if (confirm(`Are you sure you want to delete the configuration with UUID: ${selectedMetadata.configurationUUID}?`)) {
			if (localOnly) {
				const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/configurations/${selectedMetadata.configurationUUID}.json`;
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
			} else {
				const accessToken = $page.data.session?.sessionToken;
				fetch(`${PUBLIC_METACAT_URL}/api/v1/configurations/${selectedMetadata.configurationUUID}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
					.then((response) => {
						if (!response.ok) throw new Error('Failed to delete configuration from API');
						alert('Configuration deleted successfully');
						fetchConfigurations();
					})
					.catch((error) => {
						console.error('Error deleting configuration from API:', error);
						alert(`Failed to delete configuration: ${error.message}`);
					});
			}
			handleModalClose();
		}
	}

	function handleRowClick(row: ConfigurationMetadata): void {
		selectedMetadata = JSON.parse(JSON.stringify(row));
		isNewEntry = false;
		open = true;
	}

	function handleNewEntry(): void {
		selectedMetadata = JSON.parse(JSON.stringify(new ConfigurationMetadata()));
		isNewEntry = true;
		open = true;
	}

	function handleModalClose() {
		open = false;
		selectedMetadata = null;
		isNewEntry = false;
	}

	function handleNewCombination(): void {
		newCombination = JSON.parse(JSON.stringify(new CombinationMetadata()));
		isNewCombination = true;
		selectedEquipment = null;
		combinationDialogOpen = true;
	}

	function handleCombinationDialogClose() {
		combinationDialogOpen = false;
		newCombination = null;
		selectedEquipment = null;
		isNewCombination = false;
	}

	function handleFormCancel() {
		handleModalClose();
	}

	function handleCombinationFormCancel() {
		handleCombinationDialogClose();
	}

	function addEquipmentToCombination(equipment: any) {
		if (newCombination && !newCombination.equipment.some((eq) => eq.equipmentUUID === equipment.equipmentUUID)) {
			newCombination.equipment = [...newCombination.equipment, equipment];
		}
	}

	function removeEquipmentFromCombination(equipmentUUID: string) {
		if (newCombination) {
			newCombination.equipment = newCombination.equipment.filter((eq) => eq.equipmentUUID !== equipmentUUID);
		}
	}

	function removeCombinationFromConfiguration(index: number) {
		if (selectedMetadata) {
			selectedMetadata.equipmentCombinations = selectedMetadata.equipmentCombinations.filter((_, i) => i !== index);
		}
	}

	onMount(() => {
		if (PUBLIC_LOCAL_ONLY == 'true') {
			localOnly = true;
		}
		fetchConfigurations();
		fetchCombinations();
		fetchEquipment();
	});
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<div class="mb-4 flex justify-between items-center">
		<h2 class="text-2xl font-bold">Configurations</h2>
		<div>
			<Button on:click={handleNewEntry} variant="fill">New Configuration</Button>
			<Button on:click={handleNewCombination} variant="fill">New Diagnostic</Button>
		</div>
	</div>
	<div class="table-container">
		<Table
			data={sortedData}
			columns={[
				{ name: 'configurationName', align: 'left', header: 'Configuration Name' },
				{ name: 'configurationDescription', align: 'left', header: 'Description' },
				{
					name: 'equipmentCombinations',
					align: 'left',
					header: 'Equipment Combinations',
					format: (value) => (Array.isArray(value) ? `${value.length} combinations` : '0 combinations')
				}
			]}
			order={configurationOrder}
			on:cellClick={(e) => handleRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>
</div>

<Dialog {open} on:close={handleModalClose} class="configurationInputDialog">
	<div slot="title">{isNewEntry ? 'Create New Configuration' : 'Edit Configuration'}</div>
	<div class="p-4">
		<Form initial={selectedMetadata} let:draft let:refresh let:current let:revertAll>
			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1">Configuration Details</h4>
				<TextField
					label="Configuration Name"
					value={draft.configurationName}
					on:change={(e) => {
						draft.configurationName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Configuration UUID"
					value={isNewEntry ? (draft.configurationUUID = crypto.randomUUID()) : draft.configurationUUID}
					on:change={(e) => {
						draft.configurationUUID = e.detail.value;
						refresh();
					}}
				/>
				<div class="col-span-2">
					<TextField
						label="Description"
						value={draft.configurationDescription}
						on:change={(e) => {
							draft.configurationDescription = e.detail.value;
							refresh();
						}}
					/>
				</div>
			</div>

			<div class="p-4 gap-4">
				<h4 class="col-span-2 mt-1 mb-4">Equipment Diagnostic</h4>
				<div class="space-y-3">
					{#each draft.equipmentCombinations as combination, index (combination.combinationUUID)}
						<div class="flex gap-2">
							<TextField
								label="Diagnostic Name"
								value={combination.combinationName}
								on:change={(e) => {
									combination.combinationName = e.detail.value;
									refresh();
								}}
							/>
							<TextField
								label="Diagnostic UUID"
								value={combination.combinationUUID}
								on:change={(e) => {
									combination.combinationUUID = e.detail.value;
									refresh();
								}}
							/>
							<Button
								on:click={() => {
									draft.equipmentCombinations = draft.equipmentCombinations.filter((_, i) => i !== index);
									current = draft;
									refresh();
								}}
								variant="outline"
								color="danger"
								size="sm">Remove</Button
							>
						</div>
					{/each}
					<div class="flex gap-2">
						<SelectField
							label="Add Combination"
							value={selectedCombination?.combinationUUID || ''}
							options={allCombinations.map((combination) => ({ label: combination.combinationName, value: combination.combinationUUID }))}
							on:change={(e) => {
								selectedCombination = allCombinations.find((combination) => combination.combinationUUID === e.detail.value) || null;
							}}
						/>
						<Button
							on:click={() => {
								if (selectedCombination) {
									// Check if combination is already added
									if (!draft.equipmentCombinations.some((combination) => combination.combinationUUID === selectedCombination.combinationUUID)) {
										draft.equipmentCombinations = [...draft.equipmentCombinations, selectedCombination];
										console.log('Combination added:', selectedCombination);
									} else {
										alert('Combination already added to this configuration.');
									}

									selectedCombination = null;
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
							handleConfigurationSubmit();
						}}
						variant="fill">Save</Button
					>
					<Button
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

<!-- Combination Creation Dialog -->
<Dialog open={combinationDialogOpen} on:close={handleCombinationDialogClose} class="combinationInputDialog">
	<div slot="title">Create New Equipment Combination</div>
	<div class="p-4">
		<Form initial={newCombination} let:draft let:refresh let:current let:revertAll>
			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1">Combination Details</h4>
				<TextField
					label="Combination Name"
					value={draft?.combinationName || ''}
					on:change={(e) => {
						if (draft) {
							draft.combinationName = e.detail.value;
							newCombination = draft;
							refresh();
						}
					}}
				/>
				<TextField
					label="Combination UUID"
					value={isNewCombination ? (draft ? (draft.combinationUUID = crypto.randomUUID()) : '') : draft?.combinationUUID || ''}
					on:change={(e) => {
						if (draft) {
							draft.combinationUUID = e.detail.value;
							newCombination = draft;
							refresh();
						}
					}}
				/>
			</div>

			<div class="p-4 gap-4">
				<h4 class="col-span-2 mt-1 mb-4">Equipment</h4>
				<div class="space-y-3">
					{#each draft.equipment as equipment, index (equipment.equipmentUUID)}
						<div class="flex gap-2">
							<TextField
								label="Equipment Name"
								value={equipment.equipmentName}
								on:change={(e) => {
									equipment.equipmentName = e.detail.value;
									refresh();
								}}
							/>
							<TextField
								label="Equipment UUID"
								value={equipment.equipmentUUID}
								on:change={(e) => {
									equipment.equipmentUUID = e.detail.value;
									refresh();
								}}
							/>
							<Button
								on:click={() => {
									draft.equipment = draft.equipment.filter((_, i) => i !== index);
									current = draft;
									refresh();
								}}
								variant="outline"
								color="danger"
								size="sm">Remove</Button
							>
						</div>
					{/each}
					<div class="flex gap-2">
						<SelectField
							label="Add Equipment"
							value={selectedEquipment?.equipmentUUID || ''}
							options={allEquipment.map((equipment) => ({ label: equipment.equipmentName, value: equipment.equipmentUUID }))}
							on:change={(e) => {
								selectedEquipment = allEquipment.find((equipment) => equipment.equipmentUUID === e.detail.value) || null;
							}}
						/>
						<Button
							on:click={() => {
								if (selectedEquipment) {
									// Check if equipment is already added
									if (!draft.equipment.some((equipment) => equipment.equipmentUUID === selectedEquipment.equipmentUUID)) {
										draft.equipment = [...draft.equipment, selectedEquipment];
									} else {
										alert('Equipment already added to this configuration.');
									}

									selectedEquipment = null;
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

			<div class="flex gap-2 mt-4 justify-end">
				<Button
					on:click={() => {
						newCombination = current;
						handleCombinationSubmit();
					}}
					variant="fill">Save</Button
				>
				<Button
					on:click={() => {
						revertAll();
						handleCombinationFormCancel();
					}}>Cancel</Button
				>
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

	:global(.configurationInputDialog) {
		max-height: 90vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	:global(.combinationInputDialog) {
		max-height: 90vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
</style>
