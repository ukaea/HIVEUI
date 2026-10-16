<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button, Table, Dialog, Form, TextField, SelectField, type MenuOption } from 'svelte-ux';
	import { tableOrderStore, type ColumnDef } from '@layerstack/svelte-table';
	import { RunMetadata } from '$lib/models/RunMetadata';
	import { ExperimentMetadata, ConfigurationMetadata, SampleMetadata } from '$lib/models';
	import { RunDataService } from '$lib/services/RunDataService';
	import { GenericDataService } from '$lib/services/GenericDataService';
	import { env } from '$env/dynamic/public';
	import { allowDigitsOnly } from '$lib/client/allowDigitsOnly';
	import { formSchema, formErrors } from '$lib/client/form';

	let allRuns: RunMetadata[] = [];
	let allExperiments: ExperimentMetadata[] = [];
	let allConfigurations: ConfigurationMetadata[] = [];
	let allSamples: SampleMetadata[] = [];
	let open = false;
	let creating = false;
	let duplicateRunError: string | undefined;

	const newRunSchema = RunMetadata.schema.pick({
		runNumber: true,
		experimentNumber: true,
		sampleNumber: true,
		configurationNumber: true
	});

	type NewRun = {
		runNumber: number | null;
		experimentNumber: number | null;
		sampleNumber: number | null;
		configurationNumber: number | null;
	};

	const emptyNewRun: NewRun = { runNumber: null, experimentNumber: null, sampleNumber: null, configurationNumber: null };

	const order = tableOrderStore({ initialBy: 'runNumber', initialDirection: 'asc' });

	$: sortedRuns = [...allRuns].sort($order.handler);

	const columns: ColumnDef<RunMetadata>[] = [
		{ name: 'runNumber', align: 'left', header: 'Run Number' },
		{ name: 'experimentNumber', align: 'left', header: 'Experiment' },
		{ name: 'sampleNumber', align: 'left', header: 'Sample' },
		{ name: 'status', align: 'left', header: 'Status' },
		{ name: 'createdAt', align: 'left', header: 'Date', format: (value: string) => formatDate(value) }
	];

	const runService = new RunDataService();

	const experimentService = new GenericDataService<ExperimentMetadata>({
		modelClass: ExperimentMetadata,
		endpoint: env.PUBLIC_LOCAL_ONLY === 'true' ? '/local/experiments' : '/remote/experiments',
		idField: 'experimentNumber',
		displayName: 'experiments'
	});

	const configurationService = new GenericDataService<ConfigurationMetadata>({
		modelClass: ConfigurationMetadata,
		endpoint: '/db/configurations',
		idField: 'configurationNumber',
		displayName: 'configurations'
	});

	const sampleService = new GenericDataService<SampleMetadata>({
		modelClass: SampleMetadata,
		endpoint: env.PUBLIC_LOCAL_ONLY === 'true' ? '/local/samples' : '/remote/samples',
		idField: 'sampleNumber',
		displayName: 'samples'
	});

	let experimentOptions: MenuOption[] = [];
	let configurationOptions: MenuOption[] = [];
	let sampleOptions: MenuOption[] = [];

	async function fetchRuns() {
		try {
			allRuns = await runService.fetchAll();
		} catch (error) {
			console.error('Error fetching runs:', error);
			alert((error as Error).message);
		}
	}

	async function fetchExperiments() {
		try {
			allExperiments = await experimentService.fetchAll();
			experimentOptions = allExperiments.map((exp) => ({
				label: `${exp.experimentNumber} - ${exp.description}`,
				value: exp.experimentNumber
			}));
		} catch (error) {
			console.error('Error fetching experiments:', error);
			alert((error as Error).message);
		}
	}

	async function fetchConfigurations() {
		try {
			allConfigurations = await configurationService.fetchAll();
			configurationOptions = allConfigurations.map((config) => ({
				label: `${config.configurationNumber} - ${config.configurationName}`,
				value: config.configurationNumber
			}));
		} catch (error) {
			console.error('Error fetching configurations:', error);
			alert((error as Error).message);
		}
	}

	async function fetchSamples() {
		try {
			allSamples = await sampleService.fetchAll();
			sampleOptions = allSamples.map((sample) => ({
				label: `${sample.sampleNumber} - ${sample.name}`,
				value: sample.sampleNumber
			}));
		} catch (error) {
			console.error('Error fetching samples:', error);
			alert((error as Error).message);
		}
	}

	function handleNewRun() {
		open = true;
	}

	function handleModalClose() {
		open = false;
		duplicateRunError = undefined;
	}

	async function handleCreateRun(value: NewRun) {
		if (creating) return;
		const { runNumber, experimentNumber, sampleNumber, configurationNumber } = newRunSchema.parse(value);

		const duplicate = allRuns.some(
			(run) => run.experimentNumber === experimentNumber && run.sampleNumber === sampleNumber && run.runNumber === runNumber
		);
		if (duplicate) {
			duplicateRunError = `Run ${runNumber} already exists for Experiment ${experimentNumber} / Sample ${sampleNumber}`;
			return;
		}

		const newRun = new RunMetadata();
		newRun.experimentNumber = experimentNumber;
		newRun.sampleNumber = sampleNumber;
		newRun.runNumber = runNumber;
		newRun.configurationNumber = configurationNumber;

		creating = true;
		try {
			await runService.saveRun(newRun);
			handleModalClose();
			goto(`/runs/${newRun.runUUID}`);
		} catch (error) {
			console.error('Error creating run:', error);
			alert(`Failed to create run: ${(error as Error).message}`);
		} finally {
			creating = false;
		}
	}

	function handleRowClick(row: RunMetadata) {
		goto(`/runs/${row.runUUID}`);
	}

	function formatDate(value: string) {
		if (!value) return '';
		const date = new Date(value);
		return date.toLocaleDateString('en-GB', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		}) + ' (' + date.toLocaleTimeString('en-GB', {
			hour: '2-digit',
			minute: '2-digit'
		}) + ')';
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'draft': return 'text-gray-600';
			case 'processing': return 'text-yellow-600';
			case 'processed': return 'text-blue-600';
			case 'annotated': return 'text-purple-600';
			case 'ingested': return 'text-green-600';
			default: return 'text-gray-600';
		}
	}

	onMount(() => {
		fetchRuns();
		fetchExperiments();
		fetchConfigurations();
		fetchSamples();
	});
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<div class="mb-4 flex justify-between items-center">
		<h2 class="text-2xl font-bold">Runs</h2>
		<Button on:click={handleNewRun} variant="fill">New Run</Button>
	</div>
	<div class="table-container">
		<Table
			data={sortedRuns}
			{columns}
			{order}
			on:cellClick={(e) => handleRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>
</div>

<Dialog {open} on:close={handleModalClose} class="runInputDialog">
	<div slot="title">
		<div class="flex justify-between mt-4 relative">
			<div>Create New Run</div>
		</div>
	</div>
	<div class="p-4">
		<Form
			initial={emptyNewRun}
			schema={formSchema(newRunSchema)}
			novalidate
			on:change={(e) => handleCreateRun(e.detail)}
			let:draft
			let:refresh
			let:errors={rawErrors}
		>
			{@const errors = formErrors(newRunSchema, rawErrors)}
			<div class="grid grid-cols-2 gap-4">
				<TextField
					label="Run Number"
					type="integer"
					value={draft.runNumber}
					required
					on:keydown={allowDigitsOnly}
					on:change={(e) => {
						draft.runNumber = e.detail.value;
						duplicateRunError = undefined;
						refresh();
					}}
					error={errors.runNumber ?? duplicateRunError}
				/>
				<SelectField
					options={experimentOptions}
					label="Experiment"
					value={draft.experimentNumber}
					required
					autoplacement={false}
					on:change={(e) => {
						draft.experimentNumber = e.detail.value;
						duplicateRunError = undefined;
						refresh();
					}}
					error={errors.experimentNumber}
				/>
				<SelectField
					options={sampleOptions}
					label="Sample"
					value={draft.sampleNumber}
					required
					autoplacement={false}
					on:change={(e) => {
						draft.sampleNumber = e.detail.value;
						duplicateRunError = undefined;
						refresh();
					}}
					error={errors.sampleNumber}
				/>
				<SelectField
					options={configurationOptions}
					label="Configuration"
					value={draft.configurationNumber}
					required
					autoplacement={false}
					on:change={(e) => {
						draft.configurationNumber = e.detail.value;
						refresh();
					}}
					error={errors.configurationNumber}
				/>
			</div>
			<div class="flex justify-end mt-4 gap-2">
				<Button on:click={handleModalClose}>Cancel</Button>
				<Button type="submit" variant="fill" loading={creating} disabled={creating}>Create</Button>
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

	:global(.runInputDialog label:has(input:required, textarea:required) .label::after) {
		content: ' *';
		color: hsl(0 85% 65%);
	}

	:global(.runInputDialog) {
		width: min(48rem, calc(100vw - 2rem));
		max-height: 90vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
</style>
