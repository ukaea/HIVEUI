<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Button, Table, Dialog, TextField } from 'svelte-ux';
	import { SelectField, type MenuOption } from 'svelte-ux';
	import { tableOrderStore } from '@layerstack/svelte-table';
	import { RunMetadata } from '$lib/models/RunMetadata';
	import { ExperimentMetadata, ConfigurationMetadata, SampleMetadata } from '$lib/models';
	import { RunDataService } from '$lib/services/RunDataService';
	import { GenericDataService } from '$lib/services/GenericDataService';
	import { ExperimentMetadataModel } from '$lib/models/ExperimentMetadata';
	import { ConfigurationMetadataModel } from '$lib/models/ConfigurationMetadata';
	import { SampleMetadataModel } from '$lib/models/SampleMetadata';
	import { env } from '$env/dynamic/public';

	let allRuns: RunMetadata[] = [];
	let allExperiments: ExperimentMetadata[] = [];
	let allConfigurations: ConfigurationMetadata[] = [];
	let allSamples: SampleMetadata[] = [];
	let open = false;
	let newRunNumber = 0;
	let newSampleNumber = 0;
	let newExperimentNumber: number = 0;
	let newConfigurationId: string = '';

	const order = tableOrderStore({ initialBy: 'runNumber', initialDirection: 'asc' });

	order.subscribe(() => {
		allRuns = allRuns.sort($order.handler);
	});

	const runService = new RunDataService();

	const experimentService = new GenericDataService<ExperimentMetadata>({
		modelClass: ExperimentMetadataModel,
		endpoint: env.PUBLIC_LOCAL_ONLY === 'true' ? '/local/experiments' : '/remote/experiments',
		idField: 'experimentNumber',
		displayName: 'experiments'
	});

	const configurationService = new GenericDataService<ConfigurationMetadata>({
		modelClass: ConfigurationMetadataModel,
		endpoint: '/db/configurations',
		idField: 'configurationId',
		displayName: 'configurations'
	});

	const sampleService = new GenericDataService<SampleMetadata>({
		modelClass: SampleMetadataModel,
		endpoint: env.PUBLIC_LOCAL_ONLY === 'true' ? '/local/samples' : '/remote/samples',
		idField: 'sampleNumber',
		displayName: 'samples'
	});

	let experimentOptions: MenuOption[] = [];
	let configurationOptions: MenuOption[] = [];
	let sampleOptions: MenuOption[] = [];

	async function fetchRuns() {
		try {
			allRuns = await runService.fetchAll($order.handler);
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
				label: `${config.configurationId} - ${config.configurationName}`,
				value: config.configurationId
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
				label: String(sample.sampleNumber),
				value: sample.sampleNumber
			}));
		} catch (error) {
			console.error('Error fetching samples:', error);
			alert((error as Error).message);
		}
	}

	// Auto-fill the run number as one greater than the highest existing run for the
	// selected experiment + sample combination (or 1 if no run exists for it yet).
	function computeNextRunNumber() {
		if (!newExperimentNumber || !newSampleNumber) return;

		const matching = allRuns.filter(
			(run) => run.experimentNumber === newExperimentNumber && run.sampleNumber === newSampleNumber
		);

		newRunNumber = matching.length
			? Math.max(...matching.map((run) => run.runNumber)) + 1
			: 1;
	}

	function handleNewRun() {
		newRunNumber = 0;
		newSampleNumber = 0;
		newExperimentNumber = 0;
		newConfigurationId = '';
		open = true;
	}

	function handleModalClose() {
		open = false;
	}

	async function handleCreateRun() {
		if (!newExperimentNumber || !newSampleNumber || !newRunNumber || !newConfigurationId) {
			alert('All fields are required');
			return;
		}

		const newRun = new RunMetadata();
		newRun.experimentNumber = newExperimentNumber;
		newRun.sampleNumber = newSampleNumber;
		newRun.runNumber = newRunNumber;
		newRun.configurationId = newConfigurationId;

		try {
			await runService.saveRun(newRun);
			handleModalClose();
			goto(`/runs/${newRun.runUUID}`);
		} catch (error) {
			console.error('Error creating run:', error);
			alert(`Failed to create run: ${(error as Error).message}`);
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
			data={allRuns}
			columns={[
				{ name: 'runNumber', align: 'left', header: 'Run Number' },
				{ name: 'experimentNumber', align: 'left', header: 'Experiment' },
				{ name: 'sampleNumber', align: 'left', header: 'Sample' },
				{
					name: 'status',
					align: 'left',
					header: 'Status',
				},
				{
					name: 'createdAt',
					align: 'left',
					header: 'Date',
					// @ts-expect-error
					format: (value) => formatDate(value)
				}
			]}
			{order}
			on:cellClick={(e) => handleRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>
</div>

<Dialog {open} on:close={handleModalClose}>
	<div slot="title">
		<div class="flex justify-between mt-4 relative">
			<div>Create New Run</div>
		</div>
	</div>
	<div class="p-4">
		<div class="grid grid-cols-1 gap-4">
			<SelectField
				options={experimentOptions}
				label="Experiment Number"
				value={newExperimentNumber}
				autoplacement={false}
				on:change={(e) => {
					newExperimentNumber = e.detail.value;
					computeNextRunNumber();
				}}
			/>
			<SelectField
				options={sampleOptions}
				label="Sample Number"
				value={newSampleNumber}
				autoplacement={false}
				on:change={(e) => {
					newSampleNumber = e.detail.value;
					computeNextRunNumber();
				}}
			/>
			<TextField
				label="Run Number"
				type="integer"
				value={newRunNumber}
				on:change={(e) => {
					newRunNumber = e.detail.value;
				}}
			/>
			<SelectField
				options={configurationOptions}
				label="Configuration"
				value={newConfigurationId}
				autoplacement={false}
				on:change={(e) => {
					newConfigurationId = e.detail.value;
				}}
			/>
		</div>
		<div class="flex justify-end mt-4 gap-2">
			<Button on:click={handleModalClose}>Cancel</Button>
			<Button variant="fill" on:click={handleCreateRun}>Create</Button>
		</div>
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
</style>
