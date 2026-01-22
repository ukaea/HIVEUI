<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, Drawer, MenuItem, sort, format, Logger } from 'svelte-ux';
	import { tableOrderStore, SelectField, Toggle, delay, cls, type MenuOption } from 'svelte-ux';
	import { env } from '$env/dynamic/public';
	import { ConfigurationMetadata, CombinationMetadata, EquipmentMetadata } from '$lib/models';
	import { GenericDataService } from '$lib/services/GenericDataService';

	let allConfigurations: ConfigurationMetadata[] = [];
	let selectedConfiguration: ConfigurationMetadata | null = null;

	const configurationOrder = tableOrderStore({ initialBy: 'configurationName', initialDirection: 'asc' });
	configurationOrder.subscribe(() => {
		allConfigurations = allConfigurations.sort($configurationOrder.handler);
	});

	let allEquipment: EquipmentMetadata[] = [];
	let selectedEquipment: EquipmentMetadata | null = null;

	let allCombinations: CombinationMetadata[] = [];
	let selectedCombination: CombinationMetadata | null = null;

	// Main configuration dialog
	let open = false;
	let isNewEntry = false;

	// Diagnostic creation dialog
	let combinationDialogOpen = false;
	let newCombination: CombinationMetadata | null = null;
	let isNewCombination = false;

	let localOnly = false;

	const configurationService = new GenericDataService<ConfigurationMetadata>({
		modelClass: ConfigurationMetadata,
		endpoint: '/db/configurations',
		idField: 'configurationId',
		displayName: 'configurations'
	});

	const combinationService = new GenericDataService<CombinationMetadata>({
		modelClass: CombinationMetadata,
		endpoint: '/db/combinations',
		idField: 'combinationId',
		displayName: 'combinations'
	});

	const equipmentService = new GenericDataService<EquipmentMetadata>({
		modelClass: EquipmentMetadata,
		endpoint: '/local/equipment',
		idField: 'equipmentName',
		displayName: 'equipment'
	});

	async function fetchConfigurations() {
		try {
			allConfigurations = await configurationService.fetchAll();
		} catch (error) {
			console.error('Error fetching configurations:', error);
			alert((error as Error).message);
		}
	}

	async function fetchCombinations() {
		try {
			allCombinations = await combinationService.fetchAll();
		} catch (error) {
			console.error('Error fetching diagnostics:', error);
			alert((error as Error).message);
		}
	}

	async function fetchEquipment() {
		try {
			allEquipment = await equipmentService.fetchAll();
		} catch (error) {
			console.error('Error fetching equipment:', error);
			alert((error as Error).message);
		}
	}

	async function handleConfigurationSubmit() {
		if (!selectedConfiguration || !selectedConfiguration.configurationId) {
			alert('Configuration Id is required.');
			return;
		}

		try {
			await configurationService.submit(selectedConfiguration);
			alert(isNewEntry ? 'New configuration submitted successfully!' : 'Configuration updated successfully!');
			handleModalClose();
			await fetchConfigurations();
		} catch (error) {
			console.error('Submission error:', error);
			alert(`Failed to submit configuration: ${(error as Error).message}`);
		}
	}

	async function handleCombinationSubmit() {
		if (!newCombination || !newCombination.combinationId) {
			alert('Diagnostic ID is required.');
			return;
		}

		try {
			await combinationService.submit(newCombination);
			alert(isNewCombination ? 'New diagnostic submitted successfully!' : 'Diagnostic updated successfully!');
			handleCombinationDialogClose();
			await fetchCombinations();
		} catch (error) {
			console.error('Submission error:', error);
			alert(`Failed to submit diagnostic: ${(error as Error).message}`);
		}
	}

	function handleDelete(): void {
		if (!selectedConfiguration) return;

		if (confirm(`Are you sure you want to delete configuration ${selectedConfiguration.configurationName}?`)) {
			configurationService
				.delete(selectedConfiguration)
				.then(() => {
					alert('Configuration deleted successfully');
					handleModalClose();
					fetchConfigurations();
				})
				.catch((error) => {
					console.error('Delete error:', error);
					alert(`Failed to delete configuration: ${(error as Error).message}`);
				});
		}
	}

	function handleRowClick(row: ConfigurationMetadata): void {
		selectedConfiguration = JSON.parse(JSON.stringify(row));
		isNewEntry = false;
		open = true;
	}

	function handleNewEntry(): void {
		selectedConfiguration = JSON.parse(JSON.stringify(new ConfigurationMetadata()));
		isNewEntry = true;
		open = true;
	}

	function handleModalClose() {
		open = false;
		selectedConfiguration = null;
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
		if (newCombination && !newCombination.equipment.some((eq) => eq.equipmentName === equipment.equipmentName)) {
			newCombination.equipment = [...newCombination.equipment, equipment];
		}
	}

	function removeEquipmentFromCombination(equipmentName: string) {
		if (newCombination) {
			newCombination.equipment = newCombination.equipment.filter((eq) => eq.equipmentName !== equipmentName);
		}
	}

	function removeCombinationFromConfiguration(index: number) {
		if (selectedConfiguration) {
			selectedConfiguration.equipmentCombinations = selectedConfiguration.equipmentCombinations.filter((_, i) => i !== index);
		}
	}

	onMount(() => {
		if (env.PUBLIC_LOCAL_ONLY == 'true') {
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
			data={allConfigurations}
			columns={[
				{ name: 'configurationName', align: 'left', header: 'Configuration Name' },
				{ name: 'configurationDescription', align: 'left', header: 'Description' },
				{
					name: 'equipmentCombinations',
					align: 'left',
					header: 'Diagnostics',
					format: (value) => (Array.isArray(value) ? `${value.length} diagnostics` : '0 diagnostics')
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
		<Form initial={selectedConfiguration} let:draft let:refresh let:current let:revertAll>
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
					label="Configuration Id"
					value={isNewEntry ? '' : draft.configurationId}
					on:change={(e) => {
						draft.configurationId = e.detail.value;
						refresh();
					}}
					enabled
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
					{#each draft.equipmentCombinations as combination, index (combination.combinationId)}
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
								label="Diagnostic Id"
								value={combination.combinationId}
								on:change={(e) => {
									combination.combinationId = e.detail.value;
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
								size="sm"
								class="w-20 h-12">Remove</Button
							>
						</div>
					{/each}
					<div class="flex gap-2">
						<SelectField
							label="Add Diagnostic"
							value={selectedCombination?.combinationId || ''}
							options={allCombinations.map((combination) => ({ label: combination.combinationName, value: combination.combinationId }))}
							on:change={(e) => {
								selectedCombination = allCombinations.find((combination) => combination.combinationId === e.detail.value) || null;
							}}
						/>
						<Button
							on:click={() => {
								if (selectedCombination) {
									// Check if combination is already added
									if (!draft.equipmentCombinations.some((combination) => combination.combinationId === selectedCombination.combinationId)) {
										draft.equipmentCombinations = [...draft.equipmentCombinations, selectedCombination];
										console.log('Diagnostic added:', selectedCombination);
									} else {
										alert('Diagnostic already added to this configuration.');
									}

									selectedCombination = null;
									current = draft;
									refresh();
								}
							}}
							variant="fill"
							color="primary"
							size="sm"
							class="w-24 h-12">Add</Button
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
							selectedConfiguration = current;
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

<!-- Diagnostic Creation Dialog -->
<Dialog open={combinationDialogOpen} on:close={handleCombinationDialogClose} class="combinationInputDialog">
	<div slot="title">Create New Diagnostic</div>
	<div class="p-4">
		<Form initial={newCombination} let:draft let:refresh let:current let:revertAll>
			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1">Diagnostic Details</h4>
				<TextField
					label="Diagnostic Name"
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
					label="Diagnostic ID"
					value={isNewCombination ? '' : draft?.combinationId || ''}
					on:change={(e) => {
						if (draft) {
							draft.combinationId = e.detail.value;
							newCombination = draft;
							refresh();
						}
					}}
				/>
			</div>

			<div class="p-4 gap-4">
				<h4 class="col-span-2 mt-1 mb-4">Equipment</h4>
				<div class="space-y-3">
					{#each draft.equipment as equipment, index (equipment.equipmentName)}
						<div class="flex items-center gap-2">
							<div class="flex-grow">
								<TextField
									label="Equipment Name"
									value={equipment.equipmentName}
									on:change={(e) => {
										equipment.equipmentName = e.detail.value;
										refresh();
									}}
								/>
							</div>
							<Button
								on:click={() => {
									draft.equipment = draft.equipment.filter((_, i) => i !== index);
									current = draft;
									refresh();
								}}
								variant="outline"
								color="danger"
								size="sm"
								class="w-20 h-12"
								>Remove
							</Button>
						</div>
					{/each}
					<div class="flex items-center gap-2">
						<SelectField
							label="Add Equipment"
							value={selectedEquipment?.equipmentName || ''}
							options={allEquipment.map((equipment) => ({ label: equipment.equipmentName, value: equipment.equipmentName }))}
							on:change={(e) => {
								selectedEquipment = allEquipment.find((equipment) => equipment.equipmentName === e.detail.value) || null;
							}}
						/>
						<Button
							on:click={() => {
								if (selectedEquipment) {
									// Check if equipment is already added
									if (!draft.equipment.some((equipment) => equipment.equipmentName === selectedEquipment.equipmentName)) {
										draft.equipment = [...draft.equipment, selectedEquipment];
									} else {
										alert('Equipment already added to this diagnostic.');
									}

									selectedEquipment = null;
									current = draft;
									refresh();
								}
							}}
							variant="fill"
							color="primary"
							size="sm"
							class="w-24 h-12">Add</Button
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
