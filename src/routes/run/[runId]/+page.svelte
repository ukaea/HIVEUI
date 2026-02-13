<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { Button, TextField, Form, Notification } from 'svelte-ux';
	import { SelectField, type MenuOption } from 'svelte-ux';
	import { mdiCheckCircleOutline } from '@mdi/js';
	import { RunMetadata } from '$lib/models/RunMetadata';
	import { PulseAnnotation } from '$lib/models/PulseAnnotation';
	import { ExperimentMetadata, ConfigurationMetadata } from '$lib/models';
	import { RunDataService } from '$lib/services/RunDataService';
	import { GenericDataService } from '$lib/services/GenericDataService';
	import { ExperimentMetadataModel } from '$lib/models/ExperimentMetadata';
	import { triggerDAG } from '$lib/triggerPipeline';
	import { waitForDAGCompletion, type DAGStatus } from '$lib/dagPolling';
	import { env } from '$env/dynamic/public';
	import WorkflowStepper from '$lib/components/WorkflowStepper.svelte';

	// Parse runId from URL: {exp}-{sample}-{run}
	let experimentNumber = '';
	let sampleNumber = 0;
	let runNumber = 0;

	let runMetadata: any = toPlainObject(new RunMetadata());
	let pulses: PulseAnnotation[] = [];
	let currentStep = 0;

	function toPlainObject(obj: RunMetadata): any {
		return JSON.parse(JSON.stringify(RunMetadata.toJSON(obj)));
	}
	let loading = true;
	let saving = false;
	let saveNotify = false;
	let dagStatusText = '';
	let dagError = '';
	let inputPowerToggle = true;

	const steps = [
		{ label: 'Run Metadata', description: 'Fill in run details' },
		{ label: 'Trigger DAG', description: 'Start analysis pipeline' },
		{ label: 'Processing', description: 'Wait for results' },
		{ label: 'Pulse Annotation', description: 'Annotate discovered pulses' },
		{ label: 'Ingest', description: 'Submit to Metacat' }
	];

	const runService = new RunDataService();

	const experimentService = new GenericDataService<ExperimentMetadata>({
		modelClass: ExperimentMetadataModel,
		endpoint: '/local/experiments',
		idField: 'experimentNumber',
		displayName: 'experiments'
	});

	const configurationService = new GenericDataService<ConfigurationMetadata>({
		modelClass: ConfigurationMetadata,
		endpoint: '/db/configurations',
		idField: 'configurationId',
		displayName: 'configurations'
	});

	let experimentOptions: MenuOption[] = [];
	let configurationOptions: MenuOption[] = [];

	let pulseQualityOptions: MenuOption[] = [
		{ label: 'Success', value: 'Success' },
		{ label: 'Fail', value: 'Fail' }
	];

	let coilCurrentTypeOptions: MenuOption[] = [
		{ label: 'AC', value: 'AC' },
		{ label: 'DC', value: 'DC' }
	];

	let coilHeatingTypeOptions: MenuOption[] = [
		{ label: 'Induction', value: 'Induction' },
		{ label: 'DC', value: 'DC' }
	];

	let sampleCoolingOption: MenuOption[] = [
		{ label: 'Yes', value: true },
		{ label: 'No', value: false }
	];

	let coolantTypeOptions: MenuOption[] = [
		{ label: 'Water', value: 'Water' },
		{ label: 'Demineralised Water', value: 'Demineralised Water' },
		{ label: 'Treated Water', value: 'Treated Water' }
	];

	function determineStepFromStatus(status: string): number {
		switch (status) {
			case 'draft': return 1; // metadata exists, show trigger
			case 'processing': return 2; // resume polling
			case 'processed': return 3; // show annotation
			case 'annotated': return 4; // show ingest
			case 'ingested': return 4; // read-only ingest
			default: return 0; // new run, show metadata form
		}
	}

	async function loadRunData() {
		try {
			const allRuns = await runService.fetchAll();
			const existing = allRuns.find(
				(r) =>
					String(r.experimentNumber) === String(experimentNumber) &&
					r.sampleNumber === sampleNumber &&
					r.runNumber === runNumber
			);

			if (existing) {
				runMetadata = toPlainObject(existing);
				currentStep = determineStepFromStatus(existing.status);

				if (existing.status === 'processing' && existing.dagRunId) {
					startPolling(existing.dagRunId);
				}

				if (['processed', 'annotated', 'ingested'].includes(existing.status)) {
					await loadPulses();
				}
			} else {
				// New run - pre-fill identifiers
				const newRun = new RunMetadata();
				newRun.experimentNumber = experimentNumber;
				newRun.sampleNumber = sampleNumber;
				newRun.runNumber = runNumber;
				runMetadata = toPlainObject(newRun);
				currentStep = 0;
			}
		} catch (error) {
			console.error('Error loading run data:', error);
		} finally {
			loading = false;
		}
	}

	async function loadPulses() {
		try {
			pulses = await runService.fetchPulses(experimentNumber, sampleNumber, runNumber);
		} catch (error) {
			console.error('Error loading pulses:', error);
		}
	}

	async function handleSaveMetadata() {
		saving = true;
		try {
			runMetadata.status = 'draft';
			await runService.submitRun(runMetadata);
			saveNotify = true;
			setTimeout(() => { saveNotify = false; }, 3000);
			currentStep = 1;
		} catch (error) {
			console.error('Error saving run metadata:', error);
			alert(`Failed to save: ${(error as Error).message}`);
		} finally {
			saving = false;
		}
	}

	async function handleTriggerDAG() {
		try {
			dagError = '';
			dagStatusText = 'Triggering pipeline...';

			const result = await triggerDAG(env.PUBLIC_AIRFLOW_DIRECTORY, env.PUBLIC_AIRFLOW_INPUT_FILE);

			runMetadata.dagRunId = result.dag_run_id;
			runMetadata.status = 'processing';
			await runService.submitRun(runMetadata);

			currentStep = 2;
			startPolling(result.dag_run_id);
		} catch (error) {
			console.error('Error triggering DAG:', error);
			dagError = (error as Error).message;
			dagStatusText = '';
		}
	}

	function startPolling(dagRunId: string) {
		dagStatusText = 'Processing...';
		dagError = '';

		waitForDAGCompletion(dagRunId, 5000, (status: DAGStatus) => {
			dagStatusText = `State: ${status.state}`;
		})
			.then(async () => {
				dagStatusText = 'Processing complete!';
				runMetadata.status = 'processed';
				await runService.submitRun(runMetadata);
				await loadPulses();
				currentStep = 3;
			})
			.catch((err) => {
				dagError = err.message || 'DAG processing failed';
				dagStatusText = '';
			});
	}

	async function handleSaveAnnotations() {
		saving = true;
		try {
			for (const pulse of pulses) {
				await runService.savePulseAnnotation(
					experimentNumber,
					sampleNumber,
					runNumber,
					pulse
				);
			}

			runMetadata.status = 'annotated';
			await runService.submitRun(runMetadata);
			saveNotify = true;
			setTimeout(() => { saveNotify = false; }, 3000);
			currentStep = 4;
		} catch (error) {
			console.error('Error saving annotations:', error);
			alert(`Failed to save annotations: ${(error as Error).message}`);
		} finally {
			saving = false;
		}
	}

	async function handleIngest() {
		saving = true;
		try {
			const metadata = RunMetadata.toJSON(runMetadata);
			const pulseAnnotations = pulses.map((p) => PulseAnnotation.toJSON(p));

			const response = await fetch('/api/save-json', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targetPath: '/remote/metacat/runs',
					metadata: {
						...metadata,
						pulses: pulseAnnotations
					},
					id: String(runMetadata.runNumber)
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.message || 'Ingestion failed');
			}

			runMetadata.status = 'ingested';
			await runService.submitRun(runMetadata);
			saveNotify = true;
			setTimeout(() => { saveNotify = false; }, 3000);
		} catch (error) {
			console.error('Error ingesting to Metacat:', error);
			alert(`Failed to ingest: ${(error as Error).message}`);
		} finally {
			saving = false;
		}
	}

	async function fetchExperiments() {
		try {
			const allExperiments = await experimentService.fetchAll();
			experimentOptions = allExperiments.map((exp) => ({
				label: `${exp.experimentNumber} - ${exp.description}`,
				value: exp.experimentNumber
			}));
		} catch (error) {
			console.error('Error fetching experiments:', error);
		}
	}

	async function fetchConfigurations() {
		try {
			const allConfigurations = await configurationService.fetchAll();
			configurationOptions = allConfigurations.map((config) => ({
				label: `${config.configurationId} - ${config.configurationName}`,
				value: config.configurationId
			}));
		} catch (error) {
			console.error('Error fetching configurations:', error);
		}
	}

	onMount(() => {
		const runId = $page.params.runId;
		const parts = runId.split('-');
		experimentNumber = parts[0];
		sampleNumber = parseInt(parts[1], 10);
		runNumber = parseInt(parts[2], 10);

		loadRunData();
		fetchExperiments();
		fetchConfigurations();
	});
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<div class="mb-4">
		<h2 class="text-2xl font-bold mb-2">
			Run E-{experimentNumber} / S-{sampleNumber} / R-{runNumber}
		</h2>
	</div>

	<WorkflowStepper {steps} {currentStep} />

	{#if loading}
		<div class="flex justify-center items-center p-8">
			<div class="text-gray-400">Loading...</div>
		</div>
	{:else}
		<!-- Step 1: Run Metadata -->
		{#if currentStep === 0 || currentStep === 1}
			<div class="bg-surface-200 rounded-lg shadow p-6 text-surface-content">
				<h3 class="text-lg font-bold mb-4">Run Metadata</h3>
				<Form initial={runMetadata} schema={RunMetadata.schema} let:draft let:refresh let:current let:errors>
					<div class="grid grid-cols-3 gap-4">
						<SelectField
							options={experimentOptions}
							label="Experiment Number"
							value={draft.experimentNumber}
							disabled
							autoplacement={false}
						/>
						<TextField
							label="Sample Number"
							type="integer"
							value={draft.sampleNumber}
							disabled
						/>
						<TextField
							label="Run Number"
							type="integer"
							value={draft.runNumber}
							disabled
						/>
						<SelectField
							options={configurationOptions}
							label="Configuration"
							value={draft.configurationId}
							autoplacement={false}
							on:change={(e) => {
								draft.configurationId = e.detail.value;
								refresh();
							}}
							error={errors.configurationId}
						/>

						<h3 class="col-span-3 font-bold mt-4">Operator 1</h3>
						<TextField
							label="First Name"
							value={draft.operator1.firstName}
							on:change={(e) => { draft.operator1.firstName = e.detail.value; refresh(); }}
							error={errors.operator1?.firstName}
						/>
						<TextField
							label="Last Name"
							value={draft.operator1.lastName}
							on:change={(e) => { draft.operator1.lastName = e.detail.value; refresh(); }}
							error={errors.operator1?.lastName}
						/>
						<TextField
							label="Email"
							value={draft.operator1.email}
							on:change={(e) => { draft.operator1.email = e.detail.value; refresh(); }}
							error={errors.operator1?.email}
						/>

						<h3 class="col-span-3 font-bold mt-4">Operator 2</h3>
						<TextField
							label="First Name"
							value={draft.operator2.firstName}
							on:change={(e) => { draft.operator2.firstName = e.detail.value; refresh(); }}
							error={errors.operator2?.firstName}
						/>
						<TextField
							label="Last Name"
							value={draft.operator2.lastName}
							on:change={(e) => { draft.operator2.lastName = e.detail.value; refresh(); }}
							error={errors.operator2?.lastName}
						/>
						<TextField
							label="Email"
							value={draft.operator2.email}
							on:change={(e) => { draft.operator2.email = e.detail.value; refresh(); }}
							error={errors.operator2?.email}
						/>

						<h3 class="col-span-3 font-bold mt-4">Heating Information</h3>
						<SelectField
							options={coilHeatingTypeOptions}
							label="Heating Type"
							value={draft.heatingInformation.heatingType}
							autoplacement={false}
							on:change={(e) => { draft.heatingInformation.heatingType = e.detail.value; refresh(); }}
							error={errors.heatingInformation?.heatingType}
						/>
						<SelectField
							options={coilCurrentTypeOptions}
							label="Current Type"
							value={draft.heatingInformation.currentType}
							autoplacement={false}
							on:change={(e) => {
								draft.heatingInformation.currentType = e.detail.value;
								inputPowerToggle = e.detail.value === 'AC';
								refresh();
							}}
							error={errors.heatingInformation?.currentType}
						/>
						<TextField
							label="Input Power"
							value={draft.heatingInformation.inputPower}
							type="integer"
							on:change={(e) => { draft.heatingInformation.inputPower = e.detail.value; refresh(); }}
							disabled={inputPowerToggle}
							error={errors.heatingInformation?.inputPower}
						/>
						<TextField
							label="Input Current"
							value={draft.heatingInformation.inputCurrent}
							type="integer"
							on:change={(e) => { draft.heatingInformation.inputCurrent = e.detail.value; refresh(); }}
							disabled={inputPowerToggle}
							error={errors.heatingInformation?.inputCurrent}
						/>
						<TextField
							label="Input Voltage"
							value={draft.heatingInformation.inputVoltage}
							type="integer"
							on:change={(e) => { draft.heatingInformation.inputVoltage = e.detail.value; refresh(); }}
							disabled={inputPowerToggle}
							error={errors.heatingInformation?.inputVoltage}
						/>
						<TextField
							label="Output Current"
							value={draft.heatingInformation.outputCurrent}
							type="integer"
							on:change={(e) => { draft.heatingInformation.outputCurrent = e.detail.value; refresh(); }}
							error={errors.heatingInformation?.outputCurrent}
						/>

						<h3 class="col-span-3 font-bold mt-4">Coolant Information</h3>
						<SelectField
							options={sampleCoolingOption}
							label="Sample Cooling"
							value={draft.coolantInformation.sampleCooling}
							autoplacement={false}
							on:change={(e) => { draft.coolantInformation.sampleCooling = e.detail.value; refresh(); }}
							error={errors.coolantInformation?.sampleCooling}
						/>
						<SelectField
							options={coolantTypeOptions}
							label="Coolant Type"
							value={draft.coolantInformation.coolantType}
							autoplacement={false}
							on:change={(e) => { draft.coolantInformation.coolantType = e.detail.value; refresh(); }}
							error={errors.coolantInformation?.coolantType}
						/>
						<TextField
							label="Target Coolant Flow"
							value={draft.coolantInformation.targetCoolantFlow}
							type="integer"
							on:change={(e) => { draft.coolantInformation.targetCoolantFlow = e.detail.value; refresh(); }}
							error={errors.coolantInformation?.targetCoolantFlow}
						/>
						<TextField
							label="Target Coolant Temperature"
							value={draft.coolantInformation.targetCoolantTemperature}
							type="integer"
							on:change={(e) => { draft.coolantInformation.targetCoolantTemperature = e.detail.value; refresh(); }}
							error={errors.coolantInformation?.targetCoolantTemperature}
						/>
						<TextField
							label="Measured Coolant Flow"
							value={draft.coolantInformation.measuredCoolantFlow}
							type="integer"
							on:change={(e) => { draft.coolantInformation.measuredCoolantFlow = e.detail.value; refresh(); }}
							error={errors.coolantInformation?.measuredCoolantFlow}
						/>
					</div>

					<div class="flex justify-end mt-6 gap-2">
						<Button
							variant="fill"
							disabled={saving}
							on:click={() => {
								runMetadata = current;
								handleSaveMetadata();
							}}
						>
							{saving ? 'Saving...' : 'Save Run Metadata'}
						</Button>
					</div>
				</Form>
			</div>
		{/if}

		<!-- Step 2: Trigger DAG -->
		{#if currentStep === 1}
			<div class="bg-surface-200 rounded-lg shadow p-6 text-surface-content mt-4">
				<h3 class="text-lg font-bold mb-4">Trigger Analysis Pipeline</h3>
				<p class="text-gray-300 mb-4">
					Run metadata has been saved. Click below to trigger the analysis pipeline.
				</p>
				<Button variant="fill" on:click={handleTriggerDAG} disabled={!!dagStatusText}>
					Trigger Analysis
				</Button>
				{#if dagStatusText}
					<p class="mt-2 text-blue-600">{dagStatusText}</p>
				{/if}
				{#if dagError}
					<p class="mt-2 text-red-600">{dagError}</p>
				{/if}
			</div>
		{/if}

		<!-- Step 3: Processing -->
		{#if currentStep === 2}
			<div class="bg-surface-200 rounded-lg shadow p-6 text-surface-content mt-4">
				<h3 class="text-lg font-bold mb-4">Processing</h3>
				<div class="flex items-center gap-3">
					<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
					<span class="text-gray-300">{dagStatusText || 'Waiting for pipeline to complete...'}</span>
				</div>
				{#if dagError}
					<div class="mt-4">
						<p class="text-red-600 mb-2">{dagError}</p>
						<Button variant="outline" on:click={() => startPolling(runMetadata.dagRunId)}>
							Retry
						</Button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Step 4: Pulse Annotation -->
		{#if currentStep === 3}
			<div class="bg-surface-200 rounded-lg shadow p-6 text-surface-content mt-4">
				<h3 class="text-lg font-bold mb-4">Pulse Annotation</h3>
				{#if pulses.length === 0}
					<p class="text-gray-400">No pulses discovered. The pipeline may not have produced any pulse directories.</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="styled-table w-full">
							<thead>
								<tr>
									<th>Pulse Number</th>
									<th>Quality</th>
									<th>Comment</th>
								</tr>
							</thead>
							<tbody>
								{#each pulses as pulse, i}
									<tr>
										<td class="font-semibold">{pulse.pulseNumber}</td>
										<td>
											<SelectField
												options={pulseQualityOptions}
												value={pulse.pulseQuality}
												autoplacement={false}
												on:change={(e) => {
													pulses[i].pulseQuality = e.detail.value;
												}}
											/>
										</td>
										<td>
											<TextField
												value={pulse.comment}
												on:change={(e) => {
													pulses[i].comment = e.detail.value;
												}}
											/>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<div class="flex justify-end mt-4">
						<Button variant="fill" disabled={saving} on:click={handleSaveAnnotations}>
							{saving ? 'Saving...' : 'Save All Annotations'}
						</Button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Step 5: Ingest -->
		{#if currentStep === 4}
			<div class="bg-surface-200 rounded-lg shadow p-6 text-surface-content mt-4">
				<h3 class="text-lg font-bold mb-4">Ingest to Metacat</h3>
				<div class="mb-4">
					<h4 class="font-semibold mb-2">Run Summary</h4>
					<div class="grid grid-cols-3 gap-2 text-sm">
						<div><span class="text-gray-400">Experiment:</span> {runMetadata.experimentNumber}</div>
						<div><span class="text-gray-400">Sample:</span> {runMetadata.sampleNumber}</div>
						<div><span class="text-gray-400">Run:</span> {runMetadata.runNumber}</div>
						<div><span class="text-gray-400">Status:</span> {runMetadata.status}</div>
						<div><span class="text-gray-400">Pulses:</span> {pulses.length}</div>
					</div>
				</div>

				{#if pulses.length > 0}
					<div class="mb-4">
						<h4 class="font-semibold mb-2">Pulse Annotations</h4>
						<div class="overflow-x-auto">
							<table class="styled-table w-full">
								<thead>
									<tr>
										<th>Pulse</th>
										<th>Quality</th>
										<th>Comment</th>
									</tr>
								</thead>
								<tbody>
									{#each pulses as pulse}
										<tr>
											<td>{pulse.pulseNumber}</td>
											<td>{pulse.pulseQuality}</td>
											<td>{pulse.comment}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}

				{#if runMetadata.status !== 'ingested'}
					<div class="flex justify-end">
						<Button variant="fill" color="success" disabled={saving} on:click={handleIngest}>
							{saving ? 'Ingesting...' : 'Ingest to Metacat'}
						</Button>
					</div>
				{:else}
					<div class="flex items-center gap-2 text-green-600 font-semibold">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						Successfully ingested to Metacat
					</div>
				{/if}
			</div>
		{/if}
	{/if}

	<div class="fixed bottom-4 right-4 z-50">
		<Notification title="Saved successfully!" icon={mdiCheckCircleOutline} color="success" closeIcon open={saveNotify} />
	</div>
</div>
