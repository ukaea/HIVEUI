<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { Button, TextField, Form, Notification, Steps, Step } from 'svelte-ux';
	import { SelectField, type MenuOption } from 'svelte-ux';
	import { mdiCheckCircleOutline, mdiCheck } from '@mdi/js';
	import { RunMetadata } from '$lib/models/RunMetadata';
	import { PulseAnnotation } from '$lib/models/PulseAnnotation';
	import { ExperimentMetadata, ConfigurationMetadata } from '$lib/models';
	import { RunDataService } from '$lib/services/RunDataService';
	import { GenericDataService } from '$lib/services/GenericDataService';
	import { ExperimentMetadataModel } from '$lib/models/ExperimentMetadata';
	import { ProcessMetadata } from '$lib/models/ProcessingMetadata';
	import { triggerDAG } from '$lib/triggerPipeline';
	import { waitForDAGCompletion, type DAGStatus } from '$lib/dagPolling';

	// Parse runId from URL: {exp}-{sample}-{run}
	let experimentNumber = '';
	let sampleNumber = 0;
	let runNumber = 0;

	let runMetadata: any = toPlainObject(new RunMetadata());
	let pulses: PulseAnnotation[] = [];
	let currentStep = 0;
	const testMode = true; // TODO: set to false for production

	function toPlainObject(obj: RunMetadata): any {
		return JSON.parse(JSON.stringify(RunMetadata.toJSON(obj)));
	}
	let loading = true;
	let saving = false;
	let saveNotify = false;
	let dagStatusText = '';
	let dagError = '';
	let inputPowerToggle = true;

	// Annotation split-pane state
	let selectedPulseIndex: number | null = null;
	let selectedProcessedData: ProcessMetadata | null = null;
	let loadingProcessedData = false;

	function generateTestProcessedData(): ProcessMetadata {
		const data = new ProcessMetadata();
		data.powerSupplyReportedPower = '4500W';
		data.pulseStartTimestamp = new Date('2025-06-15T10:30:00');
		data.pulseEndTimestamp = new Date('2025-06-15T10:30:45');
		data.dataCaptureStartTimestamp = new Date('2025-06-15T10:29:55');
		data.heatingInformation.measuredPower = 4200;
		data.heatingInformation.outputFrequency = 150;
		data.heatingInformation.outputVoltage = 380;
		data.heatingInformation.outputCurrent = 12;
		return data;
	}

	async function handleSelectPulse(index: number) {
		selectedPulseIndex = index;
		if (testMode) {
			selectedProcessedData = generateTestProcessedData();
			return;
		}
		loadingProcessedData = true;
		selectedProcessedData = null;
		try {
			selectedProcessedData = null;
		} catch (error) {
			console.error('Error loading processed data:', error);
		} finally {
			loadingProcessedData = false;
		}
	}

	const steps = [
		{ label: 'Metadata', description: 'Fill in run details' },
		{ label: 'Processing', description: 'Start analysis pipeline' },
		{ label: 'Annotation', description: 'Annotate pulses' },
		{ label: 'Ingestion', description: 'Submit to Metacat' }
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

	function setStep(step: number) {
		currentStep = step;
		runMetadata.currentStep = step;
		if (!testMode) {
			runService.submitRun(runMetadata).catch((err) => {
				console.error('Error persisting step:', err);
			});
		}
	}

	function determineStepFromStatus(status: string): number {
		switch (status) {
			case 'draft': return 1; // metadata exists, show trigger
			case 'processing': return 2; // resume polling / annotation
			case 'processed': return 2; // show annotation
			case 'annotated': return 3; // show ingest
			case 'ingested': return 3; // read-only ingest
			default: return 0;
		}
	}

	async function loadRunData() {
		if (testMode) {
			loading = false;
			return;
		}
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
				currentStep = existing.currentStep ?? determineStepFromStatus(existing.status);
				runMetadata.currentStep = currentStep;
				metadataSaved = true;

				if (existing.status === 'processing' && existing.dagRunId) {
					startPolling(existing.dagRunId);
				}

				if (['processed', 'annotated', 'ingested'].includes(existing.status)) {
					processingDone = true;
					await loadPulses();
				}

				if (['annotated', 'ingested'].includes(existing.status)) {
					annotationsSaved = true;
				}
			} else {
				// New run - pre-fill identifiers
				const newRun = new RunMetadata();
				newRun.experimentNumber = experimentNumber;
				newRun.sampleNumber = sampleNumber;
				newRun.runNumber = runNumber;
				runMetadata = toPlainObject(newRun);
				setStep(0);
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

	let metadataSaved = false;

	async function handleSaveMetadata() {
		if (testMode) {
			metadataSaved = true;
			saveNotify = true;
			setTimeout(() => { saveNotify = false; }, 3000);
			return;
		}
		saving = true;
		try {
			runMetadata.status = 'draft';
			await runService.submitRun(runMetadata);
			metadataSaved = true;
			saveNotify = true;
			setTimeout(() => { saveNotify = false; }, 3000);
		} catch (error) {
			console.error('Error saving run metadata:', error);
			alert(`Failed to save: ${(error as Error).message}`);
		} finally {
			saving = false;
		}
	}

	let processingDone = false;

	async function handleTriggerDAG() {
		if (testMode) {
			dagStatusText = 'Triggering pipeline...';
			setTimeout(() => {
				dagStatusText = '';
				processingDone = true;
				pulses = [
					new PulseAnnotation(),
					new PulseAnnotation(),
					new PulseAnnotation()
				];
				pulses[0].pulseNumber = 1;
				pulses[1].pulseNumber = 2;
				pulses[2].pulseNumber = 3;
			}, 1500);
			return;
		}
		try {
			dagError = '';
			dagStatusText = 'Triggering pipeline...';

			const result = await triggerDAG(experimentNumber, sampleNumber, runNumber);

			runMetadata.dagRunId = result.dag_run_id;
			runMetadata.status = 'processing';
			await runService.submitRun(runMetadata);

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
				dagStatusText = '';
				processingDone = true;
				runMetadata.status = 'processed';
				await runService.submitRun(runMetadata);
				await loadPulses();
			})
			.catch((err) => {
				dagError = err.message || 'DAG processing failed';
				dagStatusText = '';
			});
	}

	let annotationsSaved = false;

	async function handleSaveAnnotations() {
		if (testMode) {
			annotationsSaved = true;
			saveNotify = true;
			setTimeout(() => { saveNotify = false; }, 3000);
			return;
		}
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
			annotationsSaved = true;
			saveNotify = true;
			setTimeout(() => { saveNotify = false; }, 3000);
		} catch (error) {
			console.error('Error saving annotations:', error);
			alert(`Failed to save annotations: ${(error as Error).message}`);
		} finally {
			saving = false;
		}
	}

	async function handleIngest() {
		if (testMode) {
			runMetadata.status = 'ingested';
			saveNotify = true;
			setTimeout(() => { saveNotify = false; }, 3000);
			return;
		}
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

	<div class="mb-6 w-full">
		<Steps classes={{ root: 'w-full' }}>
			{#each steps as step, i}
				{#if i < currentStep}
					<Step completed icon={mdiCheck} classes={{ completed: 'bg-success text-success-content' }}>
						{step.label}
					</Step>
				{:else if i === currentStep}
					<Step completed classes={{ completed: 'bg-success text-success-content', point: 'bg-info text-primary-content' }}>
						{step.label}
					</Step>
				{:else}
					<Step>
						{step.label}
					</Step>
				{/if}
			{/each}
		</Steps>
	</div>

	{#if loading}
		<div class="flex justify-center items-center p-8">
			<div class="text-gray-400">Loading...</div>
		</div>
	{:else}
		<!-- Step 1: Add Metadata -->
		{#if currentStep === 0}
			<div class="bg-surface-200 rounded-lg shadow p-6 text-surface-content">
				<h3 class="text-lg font-bold mb-4">Add Metadata</h3>
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
							error={errors['operator1.firstName']}
						/>
						<TextField
							label="Last Name"
							value={draft.operator1.lastName}
							on:change={(e) => { draft.operator1.lastName = e.detail.value; refresh(); }}
							error={errors['operator1.lastName']}
						/>
						<TextField
							label="Email"
							value={draft.operator1.email}
							on:change={(e) => { draft.operator1.email = e.detail.value; refresh(); }}
							error={errors['operator1.email']}
						/>

						<h3 class="col-span-3 font-bold mt-4">Operator 2</h3>
						<TextField
							label="First Name"
							value={draft.operator2.firstName}
							on:change={(e) => { draft.operator2.firstName = e.detail.value; refresh(); }}
							error={errors['operator2.firstName']}
						/>
						<TextField
							label="Last Name"
							value={draft.operator2.lastName}
							on:change={(e) => { draft.operator2.lastName = e.detail.value; refresh(); }}
							error={errors['operator2.lastName']}
						/>
						<TextField
							label="Email"
							value={draft.operator2.email}
							on:change={(e) => { draft.operator2.email = e.detail.value; refresh(); }}
							error={errors['operator2.email']}
						/>

						<h3 class="col-span-3 font-bold mt-4">Heating Information</h3>
						<SelectField
							options={coilHeatingTypeOptions}
							label="Heating Type"
							value={draft.heatingInformation.heatingType}
							autoplacement={false}
							on:change={(e) => { draft.heatingInformation.heatingType = e.detail.value; refresh(); }}
							error={errors['heatingInformation.heatingType']}
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
							error={errors['heatingInformation.currentType']}
						/>
						<TextField
							label="Input Power"
							value={draft.heatingInformation.inputPower}
							type="integer"
							on:change={(e) => { draft.heatingInformation.inputPower = e.detail.value; refresh(); }}
							disabled={inputPowerToggle}
							error={errors['heatingInformation.inputPower']}
						/>
						<TextField
							label="Input Current"
							value={draft.heatingInformation.inputCurrent}
							type="integer"
							on:change={(e) => { draft.heatingInformation.inputCurrent = e.detail.value; refresh(); }}
							disabled={inputPowerToggle}
							error={errors['heatingInformation.inputCurrent']}
						/>
						<TextField
							label="Input Voltage"
							value={draft.heatingInformation.inputVoltage}
							type="integer"
							on:change={(e) => { draft.heatingInformation.inputVoltage = e.detail.value; refresh(); }}
							disabled={inputPowerToggle}
							error={errors['heatingInformation.inputVoltage']}
						/>
						<TextField
							label="Output Current"
							value={draft.heatingInformation.outputCurrent}
							type="integer"
							on:change={(e) => { draft.heatingInformation.outputCurrent = e.detail.value; refresh(); }}
							error={errors['heatingInformation.outputCurrent']}
						/>

						<h3 class="col-span-3 font-bold mt-4">Coolant Information</h3>
						<SelectField
							options={sampleCoolingOption}
							label="Sample Cooling"
							value={draft.coolantInformation.sampleCooling}
							autoplacement={false}
							on:change={(e) => { draft.coolantInformation.sampleCooling = e.detail.value; refresh(); }}
							error={errors['coolantInformation.sampleCooling']}
						/>
						<SelectField
							options={coolantTypeOptions}
							label="Coolant Type"
							value={draft.coolantInformation.coolantType}
							autoplacement={false}
							on:change={(e) => { draft.coolantInformation.coolantType = e.detail.value; refresh(); }}
							error={errors['coolantInformation.coolantType']}
						/>
						<TextField
							label="Target Coolant Flow"
							value={draft.coolantInformation.targetCoolantFlow}
							type="integer"
							on:change={(e) => { draft.coolantInformation.targetCoolantFlow = e.detail.value; refresh(); }}
							error={errors['coolantInformation.targetCoolantFlow']}
						/>
						<TextField
							label="Target Coolant Temperature"
							value={draft.coolantInformation.targetCoolantTemperature}
							type="integer"
							on:change={(e) => { draft.coolantInformation.targetCoolantTemperature = e.detail.value; refresh(); }}
							error={errors['coolantInformation.targetCoolantTemperature']}
						/>
						<TextField
							label="Measured Coolant Flow"
							value={draft.coolantInformation.measuredCoolantFlow}
							type="integer"
							on:change={(e) => { draft.coolantInformation.measuredCoolantFlow = e.detail.value; refresh(); }}
							error={errors['coolantInformation.measuredCoolantFlow']}
						/>
					</div>

					<div class="flex justify-between mt-6">
						<div></div>
						<div class="flex gap-2">
							<Button
								variant="fill"
								disabled={saving}
								on:click={() => {
									runMetadata = current;
									handleSaveMetadata();
								}}
							>
								{saving ? 'Saving...' : 'Save Metadata'}
							</Button>
							<Button
								variant="fill"
								color="primary"
								disabled={!metadataSaved}
								on:click={() => setStep(1)}
							>
								Continue to Processing
							</Button>
						</div>
					</div>
				</Form>
			</div>
		{/if}

		<!-- Step 2: Processing -->
		{#if currentStep === 1}
			<div class="bg-surface-200 rounded-lg shadow p-6 text-surface-content mt-4">
				<h3 class="text-lg font-bold mb-4">Processing</h3>

				{#if !processingDone}
					{#if !dagStatusText && !dagError}
						<p class="text-gray-300 mb-4">
							Run metadata has been saved. Click below to trigger the analysis pipeline.
						</p>
						<div class="flex gap-2">
							<Button on:click={() => setStep(0)}>Back</Button>
							<Button variant="fill" on:click={handleTriggerDAG}>
								Trigger Analysis
							</Button>
						</div>
					{:else}
						<div class="flex items-center gap-3 mb-4">
							<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
							<span class="text-gray-300">{dagStatusText}</span>
						</div>
					{/if}
					{#if dagError}
						<div class="mt-4">
							<p class="text-red-600 mb-2">{dagError}</p>
							<Button variant="outline" on:click={() => startPolling(runMetadata.dagRunId)}>
								Retry
							</Button>
						</div>
					{/if}
				{:else}
					<div class="mb-4">
						<p class="text-green-500 font-semibold mb-2">Processing complete!</p>
						<div class="grid grid-cols-2 gap-2 text-sm">
							<div><span class="text-gray-400">Pulses found:</span> {pulses.length}</div>
						</div>
					</div>
					<div class="flex justify-between">
						<Button on:click={() => setStep(0)}>Back</Button>
						<Button variant="fill" on:click={() => setStep(2)}>
							Continue to Annotation
						</Button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Step 3: Annotation -->
		{#if currentStep === 2}
			<div class="bg-surface-200 rounded-lg shadow p-6 text-surface-content mt-4">
				<h3 class="text-lg font-bold mb-4">Pulse Annotation</h3>

				{#if pulses.length === 0}
					<p class="text-gray-400">No pulses discovered. The pipeline may not have produced any pulse directories.</p>
					<div class="mt-4">
						<Button on:click={() => setStep(1)}>Back</Button>
					</div>
				{:else}
					<div class="grid grid-cols-4 gap-4">
						<!-- Left panel: Pulse list -->
						<div class="col-span-1 bg-surface-100 rounded-lg p-3 overflow-y-auto max-h-[70vh]">
							<h4 class="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">Pulses</h4>
							{#each pulses as pulse, i}
								<button
									class="w-full text-left px-3 py-3 rounded-md mb-1 flex items-center justify-between transition-colors
										{selectedPulseIndex === i ? 'bg-blue-600 text-white' : 'hover:bg-surface-300'}"
									on:click={() => handleSelectPulse(i)}
								>
									<span class="font-semibold">Pulse {pulse.pulseNumber}</span>
									<span
										class="w-3 h-3 rounded-full {pulse.pulseQuality === 'Success' ? 'bg-green-500' : pulse.pulseQuality === 'Fail' ? 'bg-red-500' : 'bg-gray-400'}"
									></span>
								</button>
							{/each}
						</div>

						<!-- Right panel: Data viewer -->
						<div class="col-span-3 bg-surface-100 rounded-lg p-4 overflow-y-auto max-h-[70vh]">
							{#if selectedPulseIndex === null}
								<div class="flex items-center justify-center h-full text-gray-400">
									<p>Select a pulse from the list to view its data.</p>
								</div>
							{:else if loadingProcessedData}
								<div class="flex items-center justify-center h-full">
									<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
									<span class="ml-2 text-gray-400">Loading processed data...</span>
								</div>
							{:else}
								<h4 class="text-md font-bold mb-3">Pulse {pulses[selectedPulseIndex].pulseNumber} Data</h4>

								{#if selectedProcessedData}
									<!-- Pulse Information -->
									<div class="mb-4">
										<h5 class="font-semibold text-sm uppercase tracking-wide text-gray-400 mb-2">Pulse Information</h5>
										<div class="grid grid-cols-3 gap-3">
											<TextField label="Pulse Start" value={String(selectedProcessedData.pulseStartTimestamp)} disabled />
											<TextField label="Pulse End" value={String(selectedProcessedData.pulseEndTimestamp)} disabled />
											<TextField label="Data Capture Start" value={String(selectedProcessedData.dataCaptureStartTimestamp)} disabled />
											<TextField label="Power Supply Reported Power" value={selectedProcessedData.powerSupplyReportedPower} disabled />
										</div>
									</div>

									<!-- Heating Information -->
									<div class="mb-4">
										<h5 class="font-semibold text-sm uppercase tracking-wide text-gray-400 mb-2">Heating Information</h5>
										<div class="grid grid-cols-3 gap-3">
											<TextField label="Measured Power" value={selectedProcessedData.heatingInformation.measuredPower} disabled />
											<TextField label="Output Frequency" value={selectedProcessedData.heatingInformation.outputFrequency} disabled />
											<TextField label="Output Voltage" value={selectedProcessedData.heatingInformation.outputVoltage} disabled />
											<TextField label="Output Current" value={selectedProcessedData.heatingInformation.outputCurrent} disabled />
										</div>
									</div>

									<!-- Coolant Information -->
									<div class="mb-4">
										<h5 class="font-semibold text-sm uppercase tracking-wide text-gray-400 mb-2">Coolant Information</h5>
										<div class="grid grid-cols-3 gap-3">
											<TextField label="Coolant Type" value={selectedProcessedData.coolantInformation.coolantType} disabled />
											<TextField label="Target Coolant Flow" value={selectedProcessedData.coolantInformation.targetCoolantFlow} disabled />
											<TextField label="Target Coolant Temperature" value={selectedProcessedData.coolantInformation.targetCoolantTemperature} disabled />
											<TextField label="Measured Coolant Flow" value={selectedProcessedData.coolantInformation.measuredCoolantFlow} disabled />
										</div>
									</div>
								{:else}
									<p class="text-gray-400 text-sm mb-4">No processed data available for this pulse.</p>
								{/if}

								<!-- Quality + Comment -->
								<div class="mt-4 border-t border-surface-300 pt-4">
									<h5 class="font-semibold text-sm uppercase tracking-wide text-gray-400 mb-2">Annotation</h5>
									<div class="grid grid-cols-2 gap-4">
										<SelectField
											label="Pulse Quality"
											options={pulseQualityOptions}
											value={pulses[selectedPulseIndex].pulseQuality}
											autoplacement={false}
											on:change={(e) => {
												if (selectedPulseIndex !== null) {
													pulses[selectedPulseIndex].pulseQuality = e.detail.value;
													pulses = pulses;
												}
											}}
										/>
										<TextField
											label="Comment"
											value={pulses[selectedPulseIndex].comment}
											on:change={(e) => {
												if (selectedPulseIndex !== null) {
													pulses[selectedPulseIndex].comment = String(e.detail.value ?? '');
												}
											}}
										/>
									</div>
								</div>
							{/if}
						</div>
					</div>

					<div class="flex justify-between mt-4">
						<Button on:click={() => setStep(1)}>Back</Button>
						<div class="flex gap-2">
							<Button variant="fill" disabled={saving} on:click={handleSaveAnnotations}>
								{saving ? 'Saving...' : 'Save Annotations'}
							</Button>
							<Button
								variant="fill"
								color="primary"
								disabled={!annotationsSaved}
								on:click={() => setStep(3)}
							>
								Continue to Ingestion
							</Button>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Step 4: Ingest -->
		{#if currentStep === 3}
			<div class="bg-surface-200 rounded-lg shadow p-6 text-surface-content mt-4">
				<h3 class="text-lg font-bold mb-4">Ingest to SciCat</h3>
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
						<div class="table-container">
							<table class="w-full">
								<thead>
									<tr>
										<th class="text-left">Pulse</th>
										<th class="text-left">Quality</th>
										<th class="text-left">Comment</th>
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
					<div class="flex justify-between">
						<Button on:click={() => setStep(2)}>Back</Button>
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

	<div class="fixed top-4 right-4 z-50">
		<Notification title="Saved successfully!" icon={mdiCheckCircleOutline} color="success" closeIcon open={saveNotify} />
	</div>
</div>

<style>
	.table-container {
		background-color: white;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		border-radius: 0.5rem;
		overflow-x: auto;
	}

	.table-container table {
		border-collapse: collapse;
	}

	.table-container th {
		padding: 1rem 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: white;
		background-color: #3b82f6;
	}

	.table-container th:first-child {
		border-top-left-radius: 0.5rem;
	}

	.table-container th:last-child {
		border-top-right-radius: 0.5rem;
	}

	.table-container td {
		padding: 0.75rem 1rem;
		color: black;
		background-color: white;
		border-bottom: 1px solid #e5e7eb;
	}

	.table-container tbody tr:hover td {
		background-color: #f9fafb;
	}

	.table-container td :global(*) {
		background-color: white;
		color: black;
	}
</style>
