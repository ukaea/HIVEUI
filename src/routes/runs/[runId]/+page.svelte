<script lang="ts">
	import { page } from '$app/stores';
	import { env } from '$env/dynamic/public';
	import { waitForDAGCompletion, type DAGStatus } from '$lib/client/airflowRunPolling';
	import { ConfigurationMetadata, ExperimentMetadata } from '$lib/models';
	import { ExperimentMetadataModel } from '$lib/models/ExperimentMetadata';
	import { ProcessMetadata } from '$lib/models/ProcessingMetadata';
	import { PulseAnnotation } from '$lib/models/PulseAnnotation';
	import { RunMetadata } from '$lib/models/RunMetadata';
	import { GenericDataService } from '$lib/services/GenericDataService';
	import type { KeycloakMember } from '$lib/services/MembersService';
	import { MemberService } from '$lib/services/MembersService';
	import { RunDataService } from '$lib/services/RunDataService';
	import { mdiCheck, mdiCheckCircleOutline } from '@mdi/js';
	import { onMount } from 'svelte';
	import { Button, Form, Notification, SelectField, Step, Steps, TextField, type MenuOption } from 'svelte-ux';

	const testMode = env.PUBLIC_PROCESSING_TEST_MODE === 'true';
	let experimentNumber = 0;
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
	let delteNotify = false;
	let dagStatusText = '';
	let dagError = '';
	let ingestStatusText = '';
	let ingestError = '';
	let inputPowerToggle = true;
	let coolantToggle = true;

	// Annotation split-pane state
	let selectedPulseIndex: number | null = null;
	let selectedProcessedData: ProcessMetadata | null = null;
	let loadingProcessedData = false;
	let processedDataByPulse = new Map<number, ProcessMetadata>();
	let hasUnsavedAnnotation = false;

	// function setupBeforeUnload() {
	// 	const handleBeforeUnload = (event: BeforeUnloadEvent) => {

	// 		// trigger if unsaved changes exist
	// 		if (!hasUnsavedAnnotation){
	// 			return;
	// 		}

	// 		event.preventDefault();
	// 		// event.returnValue = '';
	// 	};

	// 	window.addEventListener('beforeunload', handleBeforeUnload);

	// 	return () => {
	// 		window.removeEventListener('beforeunload', handleBeforeUnload);
	// 	}

	// }
	function canLeaveCurrentPulse() {
		if(hasUnsavedAnnotation) {
			return window.confirm(
				"You have unsaved changes. Are you sure you want to leave?"
			)
		}
		return true;
	}
	async function handleSelectPulse(index: number) {
		// To hold the previous in pulse index
		const previousIndex = selectedPulseIndex;
		
		// Allow browser to maintain same page when same button is clicked.
		if (selectedPulseIndex === index) {
			selectedPulseIndex = previousIndex;
			return;
		}

		// Ask user if they really want to switch if unsaved annotation
		if (!canLeaveCurrentPulse()) {
			return;
		} 
		selectedPulseIndex = index;
		const pulse = pulses[index];
		loadingProcessedData = true;
		selectedProcessedData = null;
		try {
			const data = await runService.fetchProcessedData(
				experimentNumber, sampleNumber, runNumber, pulse.pulseNumber, pulse.sequenceNumber
			);
			if (data) {
				selectedProcessedData = data;
				processedDataByPulse.set(pulse.pulseNumber, data);
			}
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
		{ label: 'Ingestion', description: 'Ingest to Data Catalogue' }
	];

	const runService = new RunDataService();

	const experimentService = new GenericDataService<ExperimentMetadata>({
		modelClass: ExperimentMetadataModel,
		endpoint: env.PUBLIC_LOCAL_ONLY === 'true' ? '/local/experiments' : '/remote/experiments',
		idField: 'experimentNumber',
		displayName: 'experiments'
	});

	const configurationService = new GenericDataService<ConfigurationMetadata>({
		modelClass: ConfigurationMetadata,
		endpoint: env.PUBLIC_CONFIGURATION_LOCAL_STORAGE === 'true' ? '/local/configurations' : '/db/configurations',
		idField: 'configurationId',
		displayName: 'configurations'
	});

	let allMembers: KeycloakMember[] = [];
	let operator1ManualEdit = true;
	let operator2ManualEdit = true;

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
		runService.saveRun(runMetadata).catch((err) => {
			console.error('Error persisting step:', err);
		});
	}

	function determineStepFromStatus(status: string): number {
		switch (status) {
			case 'draft': return 1; // metadata exists, show trigger
			case 'processing': return 2; // resume polling / annotation
			case 'processed': return 2; // show annotation
			case 'annotated': return 3; // show ingest
			case 'ingesting': return 3; // resume ingest polling
			case 'ingested': return 3; // read-only ingest
			default: return 0;
		}
	}

	async function loadRunData() {
		try {
			const runId = $page.params.runId;
			const allRuns = await runService.fetchAll();
			const existing = allRuns.find((r) => r.runId === runId);

			if (!existing) {
				console.error('Run not found:', runId);
				loading = false;
				return;
			}

			runMetadata = toPlainObject(existing);
			experimentNumber = existing.experimentNumber;
			sampleNumber = existing.sampleNumber;
			runNumber = existing.runNumber;
			currentStep = existing.currentStep ?? determineStepFromStatus(existing.status);
			runMetadata.currentStep = currentStep;

			if (existing.status !== 'draft' || existing.currentStep > 0) {
				metadataSaved = true;
			}

			if (existing.status === 'processing' && existing.dagRunId) {
				startPolling(existing.dagRunId);
			}

			if (existing.status === 'ingesting' && existing.ingestDagRunId) {
				startIngestPolling(existing.ingestDagRunId);
			}

			if (['processed', 'annotated', 'ingested'].includes(existing.status)) {
				processingDone = true;
				await loadPulses();
			}

			if (['annotated', 'ingested'].includes(existing.status)) {
				annotationsSaved = true;
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
		saving = true;
		try {
			runMetadata.status = 'draft';
			await runService.saveRun(runMetadata);
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

	async function handleDeleteMetadata() {
		try {
			const confirmed = window.confirm("Are you sure you want to delete the metadata")
			if (!confirmed) {
				return;
			}
			runMetadata.status = 'draft';
			await runService.delete(runMetadata);
			delteNotify = true;
			setTimeout(() => { delteNotify = false; }, 3000);
		} catch (error) {
			console.error('Error deleting run metadata:', error);
			alert(`Failed to delete: ${(error as Error).message}`);
		} finally {
			saving = false;
		}
	}

	let processingDone = false;

	async function handleTriggerDAG() {
		if (testMode) {
			dagStatusText = 'Triggering pipeline...';
			try {
				await runService.seedTestData(experimentNumber, sampleNumber, runNumber);
				runMetadata.status = 'processed';
				await runService.saveRun(runMetadata);
				await loadPulses();
				dagStatusText = '';
				processingDone = true;
			} catch (error) {
				console.error('Error seeding test data:', error);
				dagError = (error as Error).message;
				dagStatusText = '';
			}
			return;
		}
		try {
			dagError = '';
			dagStatusText = 'Triggering pipeline...';

			const result = await runService.triggerPostprocess(experimentNumber, sampleNumber, runNumber);

			runMetadata.dagRunId = result.dag_run_id;
			runMetadata.status = 'processing';
			await runService.saveRun(runMetadata);

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

		waitForDAGCompletion(dagRunId, 5000, 10 * 60 * 1000, 'postprocessing', (status: DAGStatus) => {
			dagStatusText = `State: ${status.state}`;
		})
			.then(async () => {
				dagStatusText = '';

				if (!testMode) {
					const postprocessData = await runService.fetchPostprocessData(dagRunId);
					runMetadata.pulseIds = postprocessData.pulses.map(
						({ pulseNumber, sequenceNumber }) => [pulseNumber, sequenceNumber] as [number, number]
					);
				}

				await loadPulses();

				processingDone = true;
				runMetadata.status = 'processed';
				await runService.saveRun(runMetadata);
			})
			.catch((err) => {
				dagError = err.message || 'DAG processing failed';
				dagStatusText = '';
			});
	}

	let annotationsSaved = false;

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
			await runService.saveRun(runMetadata);
			annotationsSaved = true;
			saveNotify = true;
			setTimeout(() => { saveNotify = false; }, 3000);
			hasUnsavedAnnotation = false;
		} catch (error) {
			console.error('Error saving annotations:', error);
			alert(`Failed to save annotations: ${(error as Error).message}`);
		} finally {
			saving = false;
		}
	}

	async function handleIngest() {
		saving = true;
		ingestError = '';
		try {
			// Ensure processed data is loaded for every pulse
			for (const pulse of pulses) {
				if (!processedDataByPulse.has(pulse.pulseNumber)) {
					const data = await runService.fetchProcessedData(
						experimentNumber, sampleNumber, runNumber, pulse.pulseNumber, pulse.sequenceNumber
					);
					if (data) {
						processedDataByPulse.set(pulse.pulseNumber, data);
					}
				}
			}

			// Combine each pulse annotation with its processed data
			const pulsesMetadata = pulses.map((pulse) => ({
				annotation: PulseAnnotation.toJSON(pulse),
				processedData: processedDataByPulse.has(pulse.pulseNumber)
					? ProcessMetadata.toJSON(processedDataByPulse.get(pulse.pulseNumber)!)
					: null
			}));

			const result = await runService.ingestToDataCatalogue(runMetadata, pulsesMetadata);

			if (result.testMode) {
				runMetadata.status = 'ingested';
				await runService.saveRun(runMetadata);
				saveNotify = true;
				setTimeout(() => { saveNotify = false; }, 3000);
			} else if (result.dag_run_id) {
				runMetadata.ingestDagRunId = result.dag_run_id;
				runMetadata.status = 'ingesting';
				await runService.saveRun(runMetadata);
				startIngestPolling(result.dag_run_id);
			} else {
				ingestError = 'Ingest DAG did not return a run ID. Check server logs.';
			}
		} catch (error) {
			console.error('Error ingesting to Data Catalogue:', error);
			ingestError = (error as Error).message;
		} finally {
			saving = false;
		}
	}

	function startIngestPolling(dagRunId: string) {
		ingestStatusText = 'Ingesting...';
		ingestError = '';

		waitForDAGCompletion(dagRunId, 5000, 10 * 60 * 1000, 'ingest', (status: DAGStatus) => {
			ingestStatusText = `State: ${status.state}`;
		})
			.then(async () => {
				ingestStatusText = '';
				runMetadata.status = 'ingested';
				await runService.saveRun(runMetadata);
				saveNotify = true;
				setTimeout(() => { saveNotify = false; }, 3000);
			})
			.catch((err) => {
				ingestError = err.message || 'Ingest DAG failed';
				ingestStatusText = '';
			});
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

	async function fetchMembers() {
		try {
			allMembers = await MemberService.getMembers('HIVE');
		} catch (error) {
			console.error('Error fetching members:', error);
		}
	}

	async function fetchConfigurations() {
		try {
			const configurations = await configurationService.fetchAll();
			configurationOptions = configurations.map((config) => ({
				label: `${config.configurationId} - ${config.configurationName}`,
				value: config.configurationId
			}));
		} catch (error) {
			console.error('Error fetching configurations:', error);
		}
	}

	onMount(() => {
		// const beforeUnload = setupBeforeUnload();
		loadRunData();
		fetchExperiments();
		fetchConfigurations();
		fetchMembers();

		// return beforeUnload;
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
						<TextField
							label="Experiment Number"
							value={String(draft.experimentNumber)}
							disabled
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

						<h3 class="col-span-3 font-bold mt-4 flex items-center gap-3">
							<span>Operator 1</span>
							<div class="w-64">
								<SelectField
									label="Select from Members"
									value={operator1ManualEdit ? '' : draft.operator1?.email}
									options={allMembers.map((m) => ({ label: `${m.firstName} ${m.lastName}`, value: m.email }))}
									on:change={(e) => {
										const m = allMembers.find((m) => m.email === e.detail.value);
										if (m) {
											draft.operator1.firstName = m.firstName;
											draft.operator1.lastName = m.lastName;
											draft.operator1.email = m.email;
											operator1ManualEdit = false;
											refresh();
										}
									}}
								/>
							</div>
						</h3>
						<TextField
							label="First Name"
							value={current.operator1?.firstName}
							on:change={(e) => { draft.operator1.firstName = e.detail.value; operator1ManualEdit = true; refresh(); }}
							error={errors['operator1.firstName']}
						/>
						<TextField
							label="Last Name"
							value={current.operator1?.lastName}
							on:change={(e) => { draft.operator1.lastName = e.detail.value; operator1ManualEdit = true; refresh(); }}
							error={errors['operator1.lastName']}
						/>
						<TextField
							label="Email"
							value={current.operator1?.email}
							on:change={(e) => { draft.operator1.email = e.detail.value; operator1ManualEdit = true; refresh(); }}
							error={errors['operator1.email']}
						/>

						<h3 class="col-span-3 font-bold mt-4 flex items-center gap-3">
							<span>Operator 2</span>
							<div class="w-64">
								<SelectField
									label="Select from Members"
									value={operator2ManualEdit ? '' : draft.operator2?.email}
									options={allMembers.map((m) => ({ label: `${m.firstName} ${m.lastName}`, value: m.email }))}
									on:change={(e) => {
										const m = allMembers.find((m) => m.email === e.detail.value);
										if (m) {
											draft.operator2.firstName = m.firstName;
											draft.operator2.lastName = m.lastName;
											draft.operator2.email = m.email;
											operator2ManualEdit = false;
											refresh();
										}
									}}
								/>
							</div>
						</h3>
						<TextField
							label="First Name"
							value={current.operator2?.firstName}
							on:change={(e) => { draft.operator2.firstName = e.detail.value; operator2ManualEdit = true; refresh(); }}
							error={errors['operator2.firstName']}
						/>
						<TextField
							label="Last Name"
							value={current.operator2?.lastName}
							on:change={(e) => { draft.operator2.lastName = e.detail.value; operator2ManualEdit = true; refresh(); }}
							error={errors['operator2.lastName']}
						/>
						<TextField
							label="Email"
							value={current.operator2?.email}
							on:change={(e) => { draft.operator2.email = e.detail.value; operator2ManualEdit = true; refresh(); }}
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
							on:change={(e) => { 
								draft.coolantInformation.sampleCooling = e.detail.value; 
								coolantToggle = e.detail.value === false;
								refresh(); 
							}}
							error={errors['coolantInformation.sampleCooling']}
						/>
						<SelectField
							options={coolantTypeOptions}
							label="Coolant Type"
							value={draft.coolantInformation.coolantType}
							autoplacement={false}
							on:change={(e) => { draft.coolantInformation.coolantType = e.detail.value; refresh(); }}
							disabled={coolantToggle}
							error={errors['coolantInformation.coolantType']}
						/>
						<TextField
							label="Target Coolant Flow"
							value={draft.coolantInformation.targetCoolantFlow}
							type="integer"
							on:change={(e) => { draft.coolantInformation.targetCoolantFlow = e.detail.value; refresh(); }}
							disabled={coolantToggle}
							error={errors['coolantInformation.targetCoolantFlow']}
						/>
						<TextField
							label="Target Coolant Temperature"
							value={draft.coolantInformation.targetCoolantTemperature}
							type="integer"
							on:change={(e) => { draft.coolantInformation.targetCoolantTemperature = e.detail.value; refresh(); }}
							disabled={coolantToggle}
							error={errors['coolantInformation.targetCoolantTemperature']}
						/>
						<TextField
							label="Measured Coolant Flow"
							value={draft.coolantInformation.measuredCoolantFlow}
							type="integer"
							on:change={(e) => { draft.coolantInformation.measuredCoolantFlow = e.detail.value; refresh(); }}
							disabled={coolantToggle}
							error={errors['coolantInformation.measuredCoolantFlow']}
						/>
					</div>

					<div class="flex justify-between mt-6">
						<div></div>
						<div class="flex gap-2">
							<Button
								variant="fill"
									on:click={() => {setStep(0);
									handleDeleteMetadata();
								}}
							>
								Delete Metadata
							</Button>
							<Button
								variant="fill"
								disabled={saving}
								on:click={() => {
									runMetadata = { ...runMetadata, ...current };
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
									<!-- Run Information -->
									<div class="mb-4">
										<h5 class="font-semibold text-sm uppercase tracking-wide text-gray-400 mb-2">Run Information</h5>
										<div class="grid grid-cols-3 gap-3">
											<TextField label="Experiment Number" value={String(runMetadata.experimentNumber)} disabled />
											<TextField label="Sample Number" value={String(runMetadata.sampleNumber)} disabled />
											<TextField label="Run Number" value={String(runMetadata.runNumber)} disabled />
										</div>
									</div>
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
													hasUnsavedAnnotation = true;
												}
											}}
										/>
										<TextField
											label="Comment"
											value={pulses[selectedPulseIndex].comment}
											on:change={(e) => {
												if (selectedPulseIndex !== null) {
													pulses[selectedPulseIndex].comment = String(e.detail.value ?? '');
													hasUnsavedAnnotation = true;
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
				<h3 class="text-lg font-bold mb-4">Ingest to Data Catalogue</h3>
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
					{#if ingestStatusText}
						<div class="flex items-center gap-3 mb-4">
							<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
							<span class="text-gray-300">{ingestStatusText}</span>
						</div>
					{/if}
					{#if ingestError}
						<div class="mt-4">
							<p class="text-red-600 mb-2">{ingestError}</p>
							<Button variant="outline" on:click={() => handleIngest()}>Retry</Button>
						</div>
					{/if}
					{#if !ingestStatusText && !ingestError}
						<div class="flex justify-between">
							<Button on:click={() => setStep(2)}>Back</Button>
							<Button variant="fill" color="success" disabled={saving} on:click={handleIngest}>
								{saving ? 'Triggering...' : 'Ingest to Data Catalogue'}
							</Button>
						</div>
					{/if}
				{:else}
					<div class="flex items-center gap-2 text-green-600 font-semibold">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						Successfully ingested to Data Catalogue
					</div>
				{/if}
			</div>
		{/if}
	{/if}

	<div class="fixed top-4 right-4 z-50">
		<Notification title="Saved successfully!" icon={mdiCheckCircleOutline} color="success" closeIcon open={saveNotify} />
	</div>
	<div class="fixed top-4 right-4 z-50">
		<Notification title="Successfully Deleted!" icon={mdiCheckCircleOutline} color="success" closeIcon open={delteNotify} />
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
