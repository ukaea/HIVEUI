<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, SelectField } from 'svelte-ux';
	import { tableOrderStore, type ColumnDef } from '@layerstack/svelte-table';
	import { ConfigurationMetadata, DiagnosticMetadata, EquipmentMetadata } from '$lib/models';
	import type { AttachedDiagnostic } from '$lib/models/ConfigurationMetadata';
	import { GenericDataService } from '$lib/services/GenericDataService';
	import { env } from '$env/dynamic/public';
	import { allowDigitsOnly } from '$lib/client/allowDigitsOnly';
	import { formSchema, formErrors } from '$lib/client/form';

	let allConfigurations: ConfigurationMetadata[] = [];
	let selectedConfiguration: ConfigurationMetadata | null = null;

	const configurationOrder = tableOrderStore({ initialBy: 'configurationName', initialDirection: 'asc' });
	$: sortedConfigurations = [...allConfigurations].sort($configurationOrder.handler);

	let allEquipment: EquipmentMetadata[] = [];
	let selectedEquipment: EquipmentMetadata | null = null;

	let allDiagnostics: DiagnosticMetadata[] = [];
	let selectedDiagnostic: DiagnosticMetadata | null = null;
	let newDiagnosticPort = '';

	const diagnosticOrder = tableOrderStore({ initialBy: 'diagnosticName', initialDirection: 'asc' });
	$: sortedDiagnostics = [...allDiagnostics].sort($diagnosticOrder.handler);

	const diagnosticColumns: ColumnDef<DiagnosticMetadata>[] = [
		{
			name: 'diagnosticNumber',
			align: 'left',
			header: 'Diagnostic Number',
			format: (value: number | null) => (value == null ? '' : `D-${value}`)
		},
		{ name: 'diagnosticName', align: 'left', header: 'Diagnostic Name' },
		{
			name: 'equipment',
			align: 'left',
			header: 'Equipment',
			format: (value: EquipmentMetadata[]) =>
				Array.isArray(value) && value.length ? value.map((equipment) => equipment.equipmentName).join('\n') : '-'
		}
	];

	const configurationColumns: ColumnDef<ConfigurationMetadata>[] = [
		{
			name: 'configurationNumber',
			align: 'left',
			header: 'Configuration Number',
			format: (value: number | null) => (value == null ? '' : `C-${value}`)
		},
		{ name: 'configurationName', align: 'left', header: 'Configuration Name' },
		{
			name: 'diagnostics',
			align: 'left',
			header: 'Diagnostics',
			format: (value: AttachedDiagnostic[]) =>
				Array.isArray(value) && value.length ? value.map((diagnostic) => diagnostic.diagnosticName).join('\n') : '-'
		}
	];

	// Main configuration dialog
	let open = false;
	let isNewEntry = false;
	let saving = false;
	let duplicateConfigurationError: string | undefined;

	// Diagnostic creation dialog
	let diagnosticDialogOpen = false;
	let newDiagnostic: DiagnosticMetadata | null = null;
	let isNewDiagnostic = false;
	let savingDiagnostic = false;
	let duplicateDiagnosticError: string | undefined;

	const configurationService = new GenericDataService<ConfigurationMetadata>({
		modelClass: ConfigurationMetadata,
		endpoint: '/db/configurations',
		idField: 'configurationNumber',
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

	async function handleConfigurationSubmit(value: ConfigurationMetadata) {
		if (saving) return;
		const configuration = { ...value, ...ConfigurationMetadata.schema.parse(value) } as ConfigurationMetadata;

		if (isNewEntry && allConfigurations.some((c) => c.configurationNumber === configuration.configurationNumber)) {
			duplicateConfigurationError = `Configuration ${configuration.configurationNumber} already exists`;
			return;
		}

		saving = true;
		try {
			await configurationService.submit(configuration);
			alert(isNewEntry ? 'New configuration submitted successfully!' : 'Configuration updated successfully!');
			handleModalClose();
			await fetchConfigurations();
		} catch (error) {
			console.error('Submission error:', error);
			alert(`Failed to submit configuration: ${(error as Error).message}`);
		} finally {
			saving = false;
		}
	}

	async function handleDiagnosticSubmit(value: DiagnosticMetadata) {
		if (savingDiagnostic) return;
		const diagnostic = { ...value, ...DiagnosticMetadata.schema.parse(value) } as DiagnosticMetadata;

		if (isNewDiagnostic && allDiagnostics.some((d) => d.diagnosticNumber === diagnostic.diagnosticNumber)) {
			duplicateDiagnosticError = `Diagnostic ${diagnostic.diagnosticNumber} already exists`;
			return;
		}

		savingDiagnostic = true;
		try {
			await diagnosticService.submit(diagnostic);
			alert(isNewDiagnostic ? 'New diagnostic submitted successfully!' : 'Diagnostic updated successfully!');
			handleDiagnosticDialogClose();
			await fetchDiagnostics();
		} catch (error) {
			console.error('Submission error:', error);
			alert(`Failed to submit diagnostic: ${(error as Error).message}`);
		} finally {
			savingDiagnostic = false;
		}
	}

	async function handleDelete() {
		if (!selectedConfiguration) return;

		if (confirm(`Are you sure you want to delete configuration ${selectedConfiguration.configurationName}?`)) {
			try {
				await configurationService.delete(selectedConfiguration);
				alert('Configuration deleted successfully');
				handleModalClose();
				await fetchConfigurations();
			} catch (error) {
				console.error('Delete error:', error);
				alert(`Failed to delete configuration: ${(error as Error).message}`);
			}
		}
	}

	async function handleDiagnosticDelete() {
		if (!newDiagnostic) return;

		const diagnosticNumber = newDiagnostic.diagnosticNumber;
		const usedBy = allConfigurations.filter((config) =>
			config.diagnostics.some((diagnostic) => diagnostic.diagnosticNumber === diagnosticNumber)
		).length;
		const usageNote = usedBy
			? `\n\nIt is used by ${usedBy} configuration(s), which will keep their copy of it.`
			: '';

		if (confirm(`Are you sure you want to delete diagnostic ${diagnosticNumber} - ${newDiagnostic.diagnosticName}?${usageNote}`)) {
			try {
				await diagnosticService.delete(newDiagnostic);
				alert('Diagnostic deleted successfully');
				handleDiagnosticDialogClose();
				await fetchDiagnostics();
			} catch (error) {
				console.error('Delete error:', error);
				alert(`Failed to delete diagnostic: ${(error as Error).message}`);
			}
		}
	}

	function handleRowClick(row: ConfigurationMetadata): void {
		selectedConfiguration = JSON.parse(JSON.stringify(row));
		isNewEntry = false;
		open = true;
	}

	function nextConfigurationNumber(): number {
		return Math.max(0, ...allConfigurations.map((config) => config.configurationNumber ?? 0)) + 1;
	}

	function handleNewEntry(): void {
		selectedConfiguration = JSON.parse(JSON.stringify(new ConfigurationMetadata()));
		selectedConfiguration!.configurationNumber = nextConfigurationNumber();
		selectedDiagnostic = null;
		newDiagnosticPort = '';
		isNewEntry = true;
		open = true;
	}

	function handleModalClose() {
		open = false;
		selectedConfiguration = null;
		duplicateConfigurationError = undefined;
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
		duplicateDiagnosticError = undefined;
	}

	function withoutIndex<T>(items: T[], index: number): T[] {
		return items.filter((_, i) => i !== index);
	}

	function addSelectedDiagnostic(draft: ConfigurationMetadata) {
		if (!selectedDiagnostic) return;
		const diagnosticNumber = selectedDiagnostic.diagnosticNumber;
		if (!draft.diagnostics.some((diagnostic) => diagnostic.diagnosticNumber === diagnosticNumber)) {
			draft.diagnostics = [...draft.diagnostics, { ...selectedDiagnostic, port: newDiagnosticPort.trim() }];
		} else {
			alert('Diagnostic already added to this configuration.');
		}
		selectedDiagnostic = null;
		newDiagnosticPort = '';
	}

	function addSelectedEquipment(draft: DiagnosticMetadata) {
		if (!selectedEquipment) return;
		const equipmentName = selectedEquipment.equipmentName;
		if (!draft.equipment.some((equipment) => equipment.equipmentName === equipmentName)) {
			draft.equipment = [...draft.equipment, selectedEquipment];
		} else {
			alert('Equipment already added to this diagnostic.');
		}
		selectedEquipment = null;
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
			data={sortedDiagnostics}
			columns={diagnosticColumns}
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
			data={sortedConfigurations}
			columns={configurationColumns}
			order={configurationOrder}
			on:cellClick={(e) => handleRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>
</div>

<Dialog {open} on:close={handleModalClose} class="configurationInputDialog">
	<div slot="title">{isNewEntry ? 'Create New Configuration' : 'Configuration Details'}</div>
	<div class="p-4">
		<Form
			initial={selectedConfiguration}
			schema={formSchema(ConfigurationMetadata.schema)}
			novalidate
			on:change={(e) => handleConfigurationSubmit(e.detail)}
			let:draft
			let:refresh
			let:current
			let:errors={rawErrors}
		>
			{@const errors = formErrors(ConfigurationMetadata.schema, rawErrors)}
			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1">Configuration Details</h4>
				<div class="col-span-2 flex gap-4">
					<TextField
						label="Configuration Number"
						type="integer"
						value={draft.configurationNumber}
						required
						disabled={!isNewEntry}
						class="w-48 shrink-0"
						on:keydown={allowDigitsOnly}
						on:change={(e) => {
							draft.configurationNumber = e.detail.value;
							duplicateConfigurationError = undefined;
							refresh();
						}}
						error={errors.configurationNumber ?? duplicateConfigurationError}
					/>
					<TextField
						label="Configuration Name"
						value={draft.configurationName}
						required
						disabled={!isNewEntry}
						class="flex-1 min-w-0"
						on:change={(e) => {
							draft.configurationName = e.detail.value;
							refresh();
						}}
						error={errors.configurationName}
					/>
				</div>
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
				<h4 class="col-span-2 mt-1 mb-4">Attached Diagnostics<span class="required-marker"> *</span></h4>
				<div class="space-y-3">
					{#each current.diagnostics as diagnostic, index (diagnostic.diagnosticNumber)}
						<div class="flex gap-2">
							<TextField label="Diagnostic Number" value={diagnostic.diagnosticNumber} disabled class="w-40 shrink-0" />
							<TextField label="Diagnostic Name" value={diagnostic.diagnosticName} disabled class="flex-1 min-w-0" />
							<TextField label="Port" value={diagnostic.port} disabled class="w-24 shrink-0" />
							{#if isNewEntry}
								<Button
									on:click={() => {
										draft.diagnostics = withoutIndex(draft.diagnostics, index);
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
							<TextField
								label="Port"
								value={newDiagnosticPort}
								class="w-24 shrink-0"
								on:change={(e) => {
									newDiagnosticPort = String(e.detail.value ?? '');
								}}
							/>
							<Button
								on:click={() => {
									addSelectedDiagnostic(draft);
									refresh();
								}}
								variant="fill"
								color="primary"
								size="sm"
								class="w-24 h-12">Add</Button
							>
						</div>
					{/if}
					{#if errors.diagnostics && current.diagnostics.length === 0}
						<div class="required-error text-xs">{errors.diagnostics}</div>
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
						<Button type="submit" variant="fill" loading={saving} disabled={saving}>Save</Button>
					{/if}
					<Button on:click={handleModalClose} style={{ marginLeft: 'auto' }}>{isNewEntry ? 'Cancel' : 'Close'}</Button>
				</div>
			</div>
		</Form>
	</div>
</Dialog>

<!-- Diagnostic Creation Dialog -->
<Dialog open={diagnosticDialogOpen} on:close={handleDiagnosticDialogClose} class="diagnosticInputDialog">
	<div slot="title">{isNewDiagnostic ? 'Create New Diagnostic' : 'Diagnostic Details'}</div>
	<div class="p-4">
		<Form
			initial={newDiagnostic}
			schema={formSchema(DiagnosticMetadata.schema)}
			novalidate
			on:change={(e) => handleDiagnosticSubmit(e.detail)}
			let:draft
			let:refresh
			let:current
			let:errors={rawErrors}
		>
			{@const errors = formErrors(DiagnosticMetadata.schema, rawErrors)}
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
							duplicateDiagnosticError = undefined;
							refresh();
						}}
						error={errors.diagnosticNumber ?? duplicateDiagnosticError}
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
			</div>

			<div class="p-4 gap-4">
				<h4 class="col-span-2 mt-1 mb-4">Equipment<span class="required-marker"> *</span></h4>
				<div class="space-y-3">
					{#each current.equipment as equipment, index (equipment.equipmentName)}
						<div class="flex items-center gap-2">
							<div class="flex-grow">
								<TextField label="Equipment Name" value={equipment.equipmentName} disabled />
							</div>
							{#if isNewDiagnostic}
								<Button
									on:click={() => {
										draft.equipment = withoutIndex(draft.equipment, index);
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
									addSelectedEquipment(draft);
									refresh();
								}}
								variant="fill"
								color="primary"
								size="sm"
								class="w-24 h-12">Add</Button
							>
						</div>
					{/if}
					{#if errors.equipment && current.equipment.length === 0}
						<div class="required-error text-xs">{errors.equipment}</div>
					{/if}
				</div>
			</div>

			<div class="flex gap-2 mt-4 {!isNewDiagnostic ? 'justify-between' : 'justify-end'}">
				{#if !isNewDiagnostic}
					<div>
						<Button on:click={handleDiagnosticDelete} variant="outline" color="danger">Delete</Button>
					</div>
				{/if}
				<div class="flex gap-2">
					{#if isNewDiagnostic}
						<Button type="submit" variant="fill" loading={savingDiagnostic} disabled={savingDiagnostic}>Save</Button>
					{/if}
					<Button on:click={handleDiagnosticDialogClose}>{isNewDiagnostic ? 'Cancel' : 'Close'}</Button>
				</div>
			</div>
		</Form>
	</div>
</Dialog>

<style>
	.table-container :global(td.column-equipment),
	.table-container :global(td.column-diagnostics) {
		width: 16rem;
		min-width: 16rem;
		max-width: 16rem;
		white-space: pre-line;
		overflow-wrap: anywhere;
	}

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

	.required-marker,
	.required-error {
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
