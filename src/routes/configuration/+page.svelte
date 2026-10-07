<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField} from 'svelte-ux';
	import { SelectField,} from 'svelte-ux';
	import { tableOrderStore } from '@layerstack/svelte-table';
	import { ConfigurationMetadata, DiagnosticMetadata, EquipmentMetadata } from '$lib/models';
	import { GenericDataService } from '$lib/services/GenericDataService';
	import { env } from '$env/dynamic/public';
	import { allowDigitsOnly } from '$lib/client/allowDigitsOnly';

	let allConfigurations: ConfigurationMetadata[] = [];
	let selectedConfiguration: ConfigurationMetadata | null = null;

	const configurationOrder = tableOrderStore({ initialBy: 'configurationName', initialDirection: 'asc' });
	configurationOrder.subscribe(() => {
		allConfigurations = allConfigurations.sort($configurationOrder.handler);
	});

	let allEquipment: EquipmentMetadata[] = [];
	let selectedEquipment: EquipmentMetadata | null = null;

	let allDiagnostics: DiagnosticMetadata[] = [];
	let selectedDiagnostic: DiagnosticMetadata | null = null;

	const diagnosticOrder = tableOrderStore({ initialBy: 'diagnosticName', initialDirection: 'asc' });
	diagnosticOrder.subscribe(() => {
		allDiagnostics = allDiagnostics.sort($diagnosticOrder.handler);
	});

	// Main configuration dialog
	let open = false;
	let isNewEntry = false;

	// Diagnostic creation dialog
	let diagnosticDialogOpen = false;
	let newDiagnostic: DiagnosticMetadata | null = null;
	let isNewDiagnostic = false;

	const configurationService = new GenericDataService<ConfigurationMetadata>({
		modelClass: ConfigurationMetadata,
		endpoint: '/db/configurations',
		idField: 'configurationId',
		displayName: 'configurations'
	});

	const diagnosticService = new GenericDataService<DiagnosticMetadata>({
		modelClass: DiagnosticMetadata,
		endpoint: '/db/diagnostics',
		idField: 'diagnosticNumber',
		displayName: 'diagnostics'
	});

	const equipmentService = new GenericDataService<EquipmentMetadata>({
		modelClass: EquipmentMetadata,
		endpoint: env.PUBLIC_LOCAL_ONLY === 'true' ? '/local/equipment' : '/remote/instruments',
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

	async function fetchDiagnostics() {
		try {
			allDiagnostics = await diagnosticService.fetchAll();
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
		if (!selectedConfiguration) return;

		const parseResult = ConfigurationMetadata.schema.safeParse(selectedConfiguration);
		if (!parseResult.success) {
			console.error('Validation errors:', parseResult.error.issues);
			return;
		}

		const configurationId = selectedConfiguration.configurationId.trim();
		if (isNewEntry && allConfigurations.some((config) => config.configurationId === configurationId)) {
			alert(`Configuration Id ${configurationId} already exists.`);
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

	async function handleDiagnosticSubmit() {
		if (!newDiagnostic) return;

		const parseResult = DiagnosticMetadata.schema.safeParse(newDiagnostic);
		if (!parseResult.success) {
			console.error('Validation errors:', parseResult.error.issues);
			return;
		}

		const diagnosticNumber = newDiagnostic.diagnosticNumber;
		if (isNewDiagnostic && allDiagnostics.some((diagnostic) => diagnostic.diagnosticNumber === diagnosticNumber)) {
			alert(`Diagnostic Number ${diagnosticNumber} already exists.`);
			return;
		}

		try {
			await diagnosticService.submit(newDiagnostic);
			alert(isNewDiagnostic ? 'New diagnostic submitted successfully!' : 'Diagnostic updated successfully!');
			handleDiagnosticDialogClose();
			await fetchDiagnostics();
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
	}

	function handleDiagnosticRowClick(row: DiagnosticMetadata): void {
		newDiagnostic = JSON.parse(JSON.stringify(row));
		isNewDiagnostic = false;
		selectedEquipment = null;
		diagnosticDialogOpen = true;
	}

	function nextDiagnosticNumber(): number {
		return Math.max(0, ...allDiagnostics.map((diagnostic) => diagnostic.diagnosticNumber ?? 0)) + 1;
	}

	function handleNewDiagnostic(): void {
		newDiagnostic = JSON.parse(JSON.stringify(new DiagnosticMetadata()));
		newDiagnostic!.diagnosticNumber = nextDiagnosticNumber();
		isNewDiagnostic = true;
		selectedEquipment = null;
		diagnosticDialogOpen = true;
	}

	function handleDiagnosticDialogClose() {
		diagnosticDialogOpen = false;
		newDiagnostic = null;
		selectedEquipment = null;
	}

	function handleFormCancel() {
		handleModalClose();
	}

	function handleDiagnosticFormCancel() {
		handleDiagnosticDialogClose();
	}

	function addEquipmentToDiagnostic(equipment: any) {
		if (newDiagnostic && !newDiagnostic.equipment.some((eq) => eq.equipmentName === equipment.equipmentName)) {
			newDiagnostic.equipment = [...newDiagnostic.equipment, equipment];
		}
	}

	function removeEquipmentFromDiagnostic(equipmentName: string) {
		if (newDiagnostic) {
			newDiagnostic.equipment = newDiagnostic.equipment.filter((eq) => eq.equipmentName !== equipmentName);
		}
	}

	function removeDiagnosticFromConfiguration(index: number) {
		if (selectedConfiguration) {
			selectedConfiguration.diagnostics = selectedConfiguration.diagnostics.filter((_, i) => i !== index);
		}
	}

	onMount(() => {
		fetchConfigurations();
		fetchDiagnostics();
		fetchEquipment();
	});
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<h2 class="text-2xl font-bold mb-4">Configurations</h2>

	<div class="mb-4 flex justify-between items-center">
		<h3 class="text-xl font-bold">Diagnostics</h3>
		<Button on:click={handleNewDiagnostic} variant="fill">New Diagnostic</Button>
	</div>
	<div class="table-container mb-8">
		<Table
			data={allDiagnostics}
			columns={[
				{ name: 'diagnosticNumber', align: 'left', header: 'Diagnostic Number' },
				{ name: 'diagnosticName', align: 'left', header: 'Diagnostic Name' },
				{ name: 'port', align: 'left', header: 'Port', format: (value) => value || '-' },
				{
					name: 'equipment',
					align: 'left',
					header: 'Equipment',
					format: (value) => (Array.isArray(value) ? `${value.length} equipment` : '0 equipment')
				}
			]}
			order={diagnosticOrder}
			on:cellClick={(e) => handleDiagnosticRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>

	<div class="mb-4 flex justify-between items-center">
		<h3 class="text-xl font-bold">Configurations</h3>
		<Button on:click={handleNewEntry} variant="fill">New Configuration</Button>
	</div>
	<div class="table-container">
		<Table
			data={allConfigurations}
			columns={[
				{ name: 'configurationName', align: 'left', header: 'Configuration Name' },
				{ name: 'configurationDescription', align: 'left', header: 'Description' },
				{
					name: 'diagnostics',
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
		<Form initial={selectedConfiguration} schema={ConfigurationMetadata.schema} let:draft let:refresh let:current let:revertAll let:errors>
			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1">Configuration Details</h4>
				<TextField
					label="Configuration Name"
					value={draft.configurationName}
					required
					disabled={!isNewEntry}
					on:change={(e) => {
						draft.configurationName = e.detail.value;
						refresh();
					}}
					error={errors.configurationName}
				/>
				<TextField
					label="Configuration Id"
					value={draft.configurationId}
					required
					disabled={!isNewEntry}
					on:change={(e) => {
						draft.configurationId = e.detail.value;
						refresh();
					}}
					error={errors.configurationId}
				/>
				<div class="col-span-2">
					<TextField
						label="Description"
						value={draft.configurationDescription}
						disabled={!isNewEntry}
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
					{#each draft.diagnostics as diagnostic, index (diagnostic.diagnosticNumber)}
						<div class="flex gap-2">
							<TextField label="Diagnostic Number" value={diagnostic.diagnosticNumber} disabled class="w-40 shrink-0" />
							<TextField label="Diagnostic Name" value={diagnostic.diagnosticName} disabled class="flex-1 min-w-0" />
							{#if isNewEntry}
								<Button
									on:click={() => {
										draft.diagnostics = draft.diagnostics.filter((_, i) => i !== index);
										refresh();
									}}
									variant="outline"
									color="danger"
									size="sm"
									class="w-20 h-12">Remove</Button
								>
							{/if}
						</div>
					{/each}
					{#if isNewEntry}
						<div class="flex gap-2">
							<SelectField
								label="Add Diagnostic"
								value={selectedDiagnostic?.diagnosticNumber ?? null}
								options={allDiagnostics.map((diagnostic) => ({
									label: `${diagnostic.diagnosticNumber} - ${diagnostic.diagnosticName}`,
									value: diagnostic.diagnosticNumber
								}))}
								class="flex-1 min-w-0"
								on:change={(e) => {
									selectedDiagnostic = allDiagnostics.find((diagnostic) => diagnostic.diagnosticNumber === e.detail.value) || null;
								}}
							/>
							<Button
								on:click={() => {
									if (selectedDiagnostic) {
										if (!draft.diagnostics.some((diagnostic) => diagnostic.diagnosticNumber === selectedDiagnostic?.diagnosticNumber)) {
											draft.diagnostics = [...draft.diagnostics, selectedDiagnostic];
										} else {
											alert('Diagnostic already added to this configuration.');
										}

										selectedDiagnostic = null;
										refresh();
									}
								}}
								variant="fill"
								color="primary"
								size="sm"
								class="w-24 h-12">Add</Button
							>
						</div>
					{/if}
				</div>
			</div>

			<div class="flex gap-2 mt-4 {!isNewEntry ? 'justify-between' : 'justify-end'}">
				{#if !isNewEntry}
					<div>
						<Button on:click={handleDelete} variant="outline" color="danger">Delete</Button>
					</div>
				{/if}
				<div class="flex gap-2">
					{#if isNewEntry}
						<Button
							type="submit"
							variant="fill"
							on:click={() => {
								selectedConfiguration = current;
								handleConfigurationSubmit();
							}}>Save</Button
						>
					{/if}
					<Button
						on:click={() => {
							revertAll();
							handleFormCancel();
						}}
						style={{ marginLeft: 'auto' }}>{isNewEntry ? 'Cancel' : 'Close'}</Button
					>
				</div>
			</div>
		</Form>
	</div>
</Dialog>

<!-- Diagnostic Creation Dialog -->
<Dialog open={diagnosticDialogOpen} on:close={handleDiagnosticDialogClose} class="diagnosticInputDialog">
	<div slot="title">{isNewDiagnostic ? 'Create New Diagnostic' : 'Edit Diagnostic'}</div>
	<div class="p-4">
		<Form initial={newDiagnostic} schema={DiagnosticMetadata.schema} let:draft let:refresh let:current let:revertAll let:errors>
			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1">Diagnostic Details</h4>
				<div class="col-span-2 flex gap-4">
					<TextField
						label="Diagnostic Number"
						type="integer"
						value={draft.diagnosticNumber}
						required
						disabled={!isNewDiagnostic}
						class="w-40 shrink-0"
						on:keydown={allowDigitsOnly}
						on:change={(e) => {
							draft.diagnosticNumber = e.detail.value;
							refresh();
						}}
						error={errors.diagnosticNumber}
					/>
					<TextField
						label="Diagnostic Name"
						value={draft.diagnosticName}
						required
						disabled={!isNewDiagnostic}
						class="flex-1 min-w-0"
						on:change={(e) => {
							draft.diagnosticName = e.detail.value;
							refresh();
						}}
						error={errors.diagnosticName}
					/>
				</div>
				<TextField
					label="Port (optional)"
					value={draft.port}
					disabled={!isNewDiagnostic}
					on:change={(e) => {
						draft.port = e.detail.value;
						refresh();
					}}
				/>
			</div>

			<div class="p-4 gap-4">
				<h4 class="col-span-2 mt-1 mb-4">Equipment</h4>
				<div class="space-y-3">
					{#each draft.equipment as equipment, index (equipment.equipmentName)}
						<div class="flex items-center gap-2">
							<div class="flex-grow">
								<TextField label="Equipment Name" value={equipment.equipmentName} disabled />
							</div>
							{#if isNewDiagnostic}
								<Button
									on:click={() => {
										draft.equipment = draft.equipment.filter((_, i) => i !== index);
										refresh();
									}}
									variant="outline"
									color="danger"
									size="sm"
									class="w-20 h-12"
									>Remove
								</Button>
							{/if}
						</div>
					{/each}
					{#if isNewDiagnostic}
						<div class="flex items-center gap-2">
							<SelectField
								label="Add Equipment"
								value={selectedEquipment?.equipmentName || ''}
								options={allEquipment.map((equipment) => ({ label: equipment.equipmentName, value: equipment.equipmentName }))}
								class="flex-1 min-w-0"
								on:change={(e) => {
									selectedEquipment = allEquipment.find((equipment) => equipment.equipmentName === e.detail.value) || null;
								}}
							/>
							<Button
								on:click={() => {
									if (selectedEquipment) {
										if (!draft.equipment.some((equipment) => equipment.equipmentName === selectedEquipment?.equipmentName)) {
											draft.equipment = [...draft.equipment, selectedEquipment];
										} else {
											alert('Equipment already added to this diagnostic.');
										}

										selectedEquipment = null;
										refresh();
									}
								}}
								variant="fill"
								color="primary"
								size="sm"
								class="w-24 h-12">Add</Button
							>
						</div>
					{/if}
				</div>
			</div>

			<div class="flex gap-2 mt-4 justify-end">
				{#if isNewDiagnostic}
					<Button
						type="submit"
						variant="fill"
						on:click={() => {
							newDiagnostic = current;
							handleDiagnosticSubmit();
						}}>Save</Button
					>
				{/if}
				<Button
					on:click={() => {
						revertAll();
						handleDiagnosticFormCancel();
					}}>{isNewDiagnostic ? 'Cancel' : 'Close'}</Button
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

	:global(.configurationInputDialog label:has(input:required, textarea:required) .label::after),
	:global(.diagnosticInputDialog label:has(input:required, textarea:required) .label::after) {
		content: ' *';
		color: hsl(0 85% 65%);
	}

	:global(.configurationInputDialog) {
		width: min(48rem, calc(100vw - 2rem));
		max-height: 90vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	:global(.diagnosticInputDialog) {
		width: min(48rem, calc(100vw - 2rem));
		max-height: 90vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
</style>
