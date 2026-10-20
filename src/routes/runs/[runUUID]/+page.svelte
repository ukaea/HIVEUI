<script lang="ts">
	import { beforeNavigate, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { env } from '$env/dynamic/public';
	import { waitForDAGCompletion, type DAGStatus } from '$lib/client/airflowRunPolling';
	import { formSchema, formErrors } from '$lib/client/form';
	import { ConfigurationMetadata, ExperimentMetadata } from '$lib/models';
	import { ExperimentMetadataModel } from '$lib/models/ExperimentMetadata';

	import { PulseAnnotationMetadata } from '$lib/models/PulseAnnotationMetadata';
	import { PulseCombinedMetadata } from '$lib/models/PulseCombinedMetadata';
	import { PulseProcessedMetadata } from '$lib/models/PulseProcessedMetadata';
	import { RunMetadata, normalizePulseMap } from '$lib/models/RunMetadata';

	import { GenericDataService } from '$lib/services/GenericDataService';
	import type { KeycloakMember } from '$lib/services/MembersService';
	import { MemberService } from '$lib/services/MembersService';
	import { RunDataService } from '$lib/services/RunDataService';
	import { mdiCheck, mdiCheckCircleOutline, mdiRefresh } from '@mdi/js';
	import { onMount } from 'svelte';
	import { Button, Form, Notification, SelectField, Step, Steps, TextField, type MenuOption } from 'svelte-ux';

	const testMode = env.PUBLIC_PROCESSING_TEST_MODE === 'true';
	let experimentNumber = 0;
	let sampleNumber = 0;
	let runNumber = 0;

	let runMetadata: RunMetadata;
	let pulses: PulseCombinedMetadata[] = [];
	let processedDataByPulse = new Map<number, PulseProcessedMetadata>();
	let currentStep = 0;

	// svelte-ux's <Form> drafts `initial` with Immer, which only accepts plain
	// objects (not class instances), so feed it the serialized RunMetadata.
	$: formInitial = runMetadata ? RunMetadata.toJSON(runMetadata) : undefined;

	let loading = true;
	let saving = false;
	let saveNotify = false;
	let dagStatusText = '';
	let dagError = '';
	let dagNotice = '';
	let cancellingDag = false;
	let postprocessPolling: AbortController | null = null;
	let publishStatusText = '';
	let publishError = '';
	let inputPowerToggle = true;

	// Annotation split-pane state
	let selectedPulseIndex: number | null = null;
	let selectedProcessedData: PulseProcessedMetadata | null = null;
	let hasUnsavedAnnotation = false;
	let reloadingPulses = false;
	let pulseLoadError = '';

	let checkedPulseIds = new Set<number>();
	let selectionAnchor: number | null = null;
	let pulseButtons: HTMLButtonElement[] = [];

	// Show a value in the bulk editor only when every selected pulse shares it.
	$: checkedPulses = pulses.filter((pulse) => checkedPulseIds.has(pulse.pulseId));
	$: bulkPulseQuality = commonValue(checkedPulses.map((pulse) => pulse.annotationData.pulseQuality));
	$: bulkComment = commonValue(checkedPulses.map((pulse) => pulse.annotationData.comment)) ?? '';

	function commonValue(values: string[]): string | null {
		return values.length > 0 && values.every((value) => value === values[0]) ? values[0] : null;
	}

	$: allPulsesChecked = pulses.length > 0 && checkedPulseIds.size === pulses.length;

	function showPulse(index: number) {
		selectedPulseIndex = index;
		selectedProcessedData = pulses[index]?.processedData ?? null;
	}

	function selectOnly(index: number) {
		checkedPulseIds = new Set([pulses[index].pulseId]);
		selectionAnchor = index;
	}

	function selectRange(from: number, to: number, additive: boolean) {
		const [start, end] = from <= to ? [from, to] : [to, from];
		const ids = pulses.slice(start, end + 1).map((pulse) => pulse.pulseId);
		checkedPulseIds = new Set(additive ? [...checkedPulseIds, ...ids] : ids);
	}

	function togglePulseChecked(index: number) {
		const pulseId = pulses[index].pulseId;
		if (checkedPulseIds.has(pulseId)) {
			checkedPulseIds.delete(pulseId);
		} else {
			checkedPulseIds.add(pulseId);
		}
		checkedPulseIds = checkedPulseIds;
		selectionAnchor = index;
	}

	function toggleAllPulsesChecked() {
		if (allPulsesChecked) {
			checkedPulseIds = selectedPulseIndex !== null ? new Set([pulses[selectedPulseIndex].pulseId]) : new Set();
		} else {
			checkedPulseIds = new Set(pulses.map((pulse) => pulse.pulseId));
		}
	}

	// Standard list selection: click selects one, Ctrl/Cmd-click toggles,
	// Shift-click selects a range from the last clicked pulse.
	function handlePulseClick(event: MouseEvent, index: number) {
		const toggle = event.ctrlKey || event.metaKey;
		if (event.shiftKey && selectionAnchor !== null) {
			selectRange(selectionAnchor, index, toggle);
		} else if (toggle) {
			togglePulseChecked(index);
		} else {
			selectOnly(index);
		}
		showPulse(index);
	}

	function handlePulseListKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
			event.preventDefault();
			checkedPulseIds = new Set(pulses.map((pulse) => pulse.pulseId));
			return;
		}

		if (event.key === 'Escape' && selectedPulseIndex !== null) {
			selectOnly(selectedPulseIndex);
			return;
		}

		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
			return;
		}

		event.preventDefault();
		const step = event.key === 'ArrowDown' ? 1 : -1;
		const next = Math.min(pulses.length - 1, Math.max(0, (selectedPulseIndex ?? -1) + step));

		if (event.shiftKey && selectionAnchor !== null) {
			selectRange(selectionAnchor, next, false);
		} else {
			selectOnly(next);
		}
		showPulse(next);
		pulseButtons[next]?.focus();
	}

	function applyBulkAnnotation(changes: Partial<PulseAnnotationMetadata>) {
		for (const pulse of checkedPulses) {
			Object.assign(pulse.annotationData, changes);
		}
		pulses = pulses;
		hasUnsavedAnnotation = true;
	}

	function confirmDiscardUnsavedAnnotation() {
		if (hasUnsavedAnnotation) {
			return window.confirm(
				"You have unsaved changes. Are you sure you want to leave?"
			);
		}
		return true;
	}

	// Only warn when actually leaving the annotation page (step 2) — e.g. navigating
	// to another route. Switching between pulses on the page stays free.
	beforeNavigate((navigation) => {
		if (currentStep === 2 && !confirmDiscardUnsavedAnnotation()) {
			navigation.cancel();
		}
	});

	const steps = [
		{ label: 'Metadata', description: 'Fill in run details' },
		{ label: 'Processing', description: 'Start analysis pipeline' },
		{ label: 'Annotation', description: 'Annotate pulses' },
		{ label: 'Publish', description: 'Publish to Data Catalogue' }
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
		endpoint: '/db/configurations',
		idField: 'configurationNumber',
		displayName: 'configurations'
	});

	let allMembers: KeycloakMember[] = [];
	let operator1ManualEdit = true;
	let operator2ManualEdit = true;

	let experimentOptions: MenuOption[] = [];
	let configurationOptions: MenuOption[] = [];
	let configurationsLoading = true;

	let pulseQualityOptions: MenuOption[] = [
		{ label: 'Success', value: 'Success' },
		{ label: 'Fail', value: 'Fail' }
	];

	let coilCurrentTypeOptions: MenuOption[] = [
		{ label: 'AC', value: 'AC' },
		{ label: 'DC', value: 'DC' }
	];

	let coilHeatingTypeOptions: MenuOption[] = [
		{ label: 'AC Induction', value: 'Induction' },
		{ label: 'DC Heater', value: 'DC' }
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
		// Warn before leaving the annotation page (step 2) with unsaved changes.
		if (currentStep === 2 && step !== 2 && !confirmDiscardUnsavedAnnotation()) {
			return;
		}
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
			case 'annotated': return 3; // show publish
			case 'ingesting': return 3; // resume publish polling
			case 'ingested': return 3; // read-only publish
			default: return 0;
		}
	}

	async function loadRunData() {
		try {
			const runUUID = $page.params.runUUID;
			const allRuns = await runService.fetchAll();
			const existing = allRuns.find((r) => r.runUUID === runUUID);

			if (!existing) {
				console.error('Run not found:', runUUID);
				loading = false;
				return;
			}

			runMetadata = existing;
			experimentNumber = existing.experimentNumber ?? 0;
			sampleNumber = existing.sampleNumber ?? 0;
			runNumber = existing.runNumber ?? 0;
			currentStep = existing.currentStep ?? determineStepFromStatus(existing.status);
			runMetadata.currentStep = currentStep;

			if (existing.status !== 'draft' || existing.currentStep > 0) {
				metadataSaved = true;
			}

			if (existing.status === 'processing' && existing.dagRunId) {
				startPolling(existing.dagRunId);
			}

			if (existing.status === 'ingesting' && existing.ingestDagRunId) {
				startPublishPolling(existing.ingestDagRunId);
			}

			if (['processed', 'annotated', 'ingested'].includes(existing.status)) {
				processingDone = true;
				const xcomWarning =
					runMetadata.pulseMap.length === 0 ? await refreshPulseMapFromXCom() : '';

				await loadPulses();

				if (xcomWarning && !pulseLoadError) {
					pulseLoadError = xcomWarning;
				}
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
			pulseLoadError = '';
			pulses = await runService.fetchPulseCombinedMetadata(runMetadata);
		} catch (error) {
			console.error('Error loading pulses:', error);
			pulseLoadError = `Failed to load pulse data: ${(error as Error).message}`;
		}
	}

	async function refreshPulseMapFromXCom(): Promise<string> {
		if (testMode) {
			return '';
		}

		if (!runMetadata.dagRunId) {
			return 'No pipeline run is recorded for this run, so the pulse map cannot be re-fetched from Airflow.';
		}

		try {
			const postprocessResults = await runService.fetchPostprocessResults(runMetadata.dagRunId);
			const pulseMap = normalizePulseMap(postprocessResults.pulses);

			if (pulseMap.length === 0) {
				return `Airflow returned no pulses for DAG run ${runMetadata.dagRunId}.`;
			}

			runMetadata.pulseMap = pulseMap;
			await runService.saveRun(runMetadata);
			return '';
		} catch (error) {
			console.error('Error re-fetching pulse map from XCom:', error);
			return `Could not re-fetch the pulse map from Airflow (${(error as Error).message}); using the saved pulse map instead.`;
		}
	}

	// Re-pull the pulse data for this run — the pipeline output may not have been
	// readable yet on the first attempt.
	async function handleRetryLoadPulses() {
		if (!confirmDiscardUnsavedAnnotation()) {
			return;
		}

		const previousPulseId =
			selectedPulseIndex !== null ? pulses[selectedPulseIndex]?.pulseId ?? null : null;

		reloadingPulses = true;
		try {
			const xcomWarning = await refreshPulseMapFromXCom();
			await loadPulses();

			if (xcomWarning && !pulseLoadError) {
				pulseLoadError = xcomWarning;
			}

			// Keep the viewer on the same pulse number if it is still there.
			const index =
				previousPulseId !== null
					? pulses.findIndex((pulse) => pulse.pulseId === previousPulseId)
					: -1;
			if (index >= 0) {
				showPulse(index);
				selectOnly(index);
			} else {
				selectedPulseIndex = null;
				selectedProcessedData = null;
				checkedPulseIds = new Set();
				selectionAnchor = null;
			}
			hasUnsavedAnnotation = false;
		} finally {
			reloadingPulses = false;
		}
	}

	let metadataSaved = false;

	async function handleSaveMetadata(value: RunMetadata) {
		if (saving) return;
		const updated = RunMetadata.fromJSON({ ...value, ...RunMetadata.schema.parse(value) });
		updated.status = 'draft';

		saving = true;
		try {
			await runService.saveRun(updated);
			runMetadata = updated;
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
		if (!window.confirm('Are you sure you want to delete this run?')) return;

		try {
			await runService.delete(runMetadata);
			alert('Run deleted successfully');
			goto('/runs');
		} catch (error) {
			console.error('Error deleting run metadata:', error);
			alert(`Failed to delete: ${(error as Error).message}`);
		}
	}

	let processingDone = false;

	async function handleTriggerDAG() {
		if (testMode) {
			dagStatusText = 'Triggering pipeline...';
			try {
				const seedResult = await runService.seedTestData(experimentNumber, sampleNumber, runNumber);
				runMetadata.pulseMap = normalizePulseMap(seedResult.pulses);
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
			dagNotice = '';
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

		postprocessPolling?.abort();
		const polling = new AbortController();
		postprocessPolling = polling;

		let lastState = '';
		waitForDAGCompletion(dagRunId, 5000, 10 * 60 * 1000, 'postprocessing', (status: DAGStatus) => {
			lastState = status.state;
			dagStatusText = `State: ${status.state}`;
		}, polling.signal)
			.then(async () => {
				dagStatusText = '';

				if (!testMode) {
					const postprocessResults = await runService.fetchPostprocessResults(dagRunId);
					runMetadata.pulseMap = normalizePulseMap(postprocessResults.pulses);
				}

				runMetadata.status = 'processed';
				await runService.saveRun(runMetadata);

				await loadPulses();
				processingDone = true;
			})
			.catch((err) => {
				if (polling.signal.aborted) {
					return;
				}
				dagError = err.message || 'DAG processing failed';
				dagStatusText = '';

				if (lastState === 'failed') {
					runMetadata.status = 'draft';
					runService.saveRun(runMetadata).catch((saveErr) => {
						console.error('Error persisting failed run status:', saveErr);
					});
				}
			});
	}

	async function handleCancelDAG() {
		if (!window.confirm('Are you sure you want to cancel the postprocessing run?')) return;

		cancellingDag = true;
		try {
			await runService.cancelPostprocess(runMetadata.dagRunId);
			postprocessPolling?.abort();

			runMetadata.dagRunId = '';
			runMetadata.status = 'draft';
			await runService.saveRun(runMetadata);

			dagStatusText = '';
			dagError = '';
			dagNotice = 'Postprocessing run was cancelled.';
		} catch (error) {
			console.error('Error cancelling DAG:', error);
			alert(`Failed to cancel: ${(error as Error).message}`);
		} finally {
			cancellingDag = false;
		}
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
					pulse.pulseId,
					pulse.annotationData
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

	async function handlePublish() {
		saving = true;
		publishError = '';
		try {
			if (pulses.length === 0) {
				await loadPulses();
			}

			if (pulses.length === 0) {
				publishError =
					pulseLoadError ||
					'No pulses loaded for this run — publishing would send an empty pulse list. Reload the run and check the postprocessing output before publishing.';
				return;
			}

			// Ensure processed data is loaded for every pulse
			const pulsesToFetch = pulses.filter((pulse) => !processedDataByPulse.has(pulse.pulseId));

			if (pulsesToFetch.length > 0) {
				const postprocessResponse = await runService.fetchPostprocessData({
					experimentId: experimentNumber,
					sampleId: sampleNumber,
					runId: runNumber,
					pulses: pulsesToFetch.map((pulse) => ({
						pulseId: pulse.pulseId,
						seqId: pulse.seqId
					}))
				});

				for (const { pulseId, processedData } of postprocessResponse.pulses ?? []) {
					if (processedData) {
						processedDataByPulse.set(pulseId, PulseProcessedMetadata.fromJSON(processedData));
					}
				}
			}

			// Combine each pulse annotation with its processed data
			const pulsesMetadata = pulses.map((pulse) => ({
				pulseId: pulse.pulseId,
				annotation: PulseAnnotationMetadata.toJSON(pulse.annotationData),
				processedData: processedDataByPulse.has(pulse.pulseId)
					? PulseProcessedMetadata.toJSON(processedDataByPulse.get(pulse.pulseId)!)
					: null
			}));

			const missingProcessed = pulsesMetadata.filter((pulse) => !pulse.processedData);
			if (missingProcessed.length > 0) {
				publishError = `No processed data for pulse(s) ${missingProcessed
					.map((pulse) => pulse.pulseId)
					.join(', ')}. Re-run postprocessing before publishing.`;
				return;
			}

			const result = await runService.publishToDataCatalogue(runMetadata, pulsesMetadata);

			if (result.testMode) {
				runMetadata.status = 'ingested';
				await runService.saveRun(runMetadata);
				saveNotify = true;
				setTimeout(() => { saveNotify = false; }, 3000);
			} else if (result.dag_run_id) {
				runMetadata.ingestDagRunId = result.dag_run_id;
				runMetadata.status = 'ingesting';
				await runService.saveRun(runMetadata);
				startPublishPolling(result.dag_run_id);
			} else {
				publishError = 'Publish DAG did not return a run ID. Check server logs.';
			}
		} catch (error) {
			console.error('Error publishing to Data Catalogue:', error);
			publishError = (error as Error).message;
		} finally {
			saving = false;
		}
	}

	function startPublishPolling(dagRunId: string) {
		publishStatusText = 'Publishing...';
		publishError = '';

		let lastState = '';
		waitForDAGCompletion(dagRunId, 5000, 10 * 60 * 1000, 'ingest', (status: DAGStatus) => {
			lastState = status.state;
			publishStatusText = `State: ${status.state}`;
		})
			.then(async () => {
				publishStatusText = '';
				runMetadata.status = 'ingested';
				await runService.saveRun(runMetadata);
				saveNotify = true;
				setTimeout(() => { saveNotify = false; }, 3000);
			})
			.catch((err) => {
				publishError = err.message || 'Publish DAG failed';
				publishStatusText = '';

				if (lastState === 'failed') {
					runMetadata.status = 'annotated';
					runService.saveRun(runMetadata).catch((saveErr) => {
						console.error('Error persisting failed publish status:', saveErr);
					});
				}
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
				label: `${config.configurationNumber} - ${config.configurationName}`,
				value: config.configurationNumber
			}));
		} catch (error) {
			console.error('Error fetching configurations:', error);
		} finally {
			configurationsLoading = false;
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
				<Form
					initial={formInitial}
					schema={formSchema(RunMetadata.schema)}
					novalidate
					on:change={(e) => handleSaveMetadata(e.detail)}
					let:draft
					let:refresh
					let:current
					let:errors={rawErrors}
				>
					{@const errors = formErrors(RunMetadata.schema, rawErrors)}
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
							value={draft.configurationNumber}
							loading={configurationsLoading}
							autoplacement={false}
							on:change={(e) => {
								draft.configurationNumber = e.detail.value;
								refresh();
							}}
							error={errors.configurationNumber}
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
							error={errors.operator1?.firstName}
						/>
						<TextField
							label="Last Name"
							value={current.operator1?.lastName}
							on:change={(e) => { draft.operator1.lastName = e.detail.value; operator1ManualEdit = true; refresh(); }}
							error={errors.operator1?.lastName}
						/>
						<TextField
							label="Email"
							value={current.operator1?.email}
							on:change={(e) => { draft.operator1.email = e.detail.value; operator1ManualEdit = true; refresh(); }}
							error={errors.operator1?.email}
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
							error={errors.operator2?.firstName}
						/>
						<TextField
							label="Last Name"
							value={current.operator2?.lastName}
							on:change={(e) => { draft.operator2.lastName = e.detail.value; operator2ManualEdit = true; refresh(); }}
							error={errors.operator2?.lastName}
						/>
						<TextField
							label="Email"
							value={current.operator2?.email}
							on:change={(e) => { draft.operator2.email = e.detail.value; operator2ManualEdit = true; refresh(); }}
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

						<h3 class="col-span-3 font-bold mt-4">Coolant Information</h3>
						<SelectField
							options={sampleCoolingOption}
							label="Sample Cooling"
							value={draft.coolantInformation.sampleCooling}
							autoplacement={false}
							on:change={(e) => { 
								draft.coolantInformation.sampleCooling = e.detail.value; 
								refresh(); 
							}}
							error={errors.coolantInformation?.sampleCooling}
						/>
						<SelectField
							options={coolantTypeOptions}
							label="Coolant Type"
							value={draft.coolantInformation.coolantType}
							autoplacement={false}
							on:change={(e) => { draft.coolantInformation.coolantType = e.detail.value; refresh(); }}
							disabled={!current.coolantInformation?.sampleCooling}
							error={errors.coolantInformation?.coolantType}
						/>
						<TextField
							label="Target Coolant Flow"
							value={draft.coolantInformation.targetCoolantFlow}
							type="integer"
							on:change={(e) => { draft.coolantInformation.targetCoolantFlow = e.detail.value; refresh(); }}
							disabled={!current.coolantInformation?.sampleCooling}
							error={errors.coolantInformation?.targetCoolantFlow}
						/>
						<TextField
							label="Target Coolant Temperature"
							value={draft.coolantInformation.targetCoolantTemperature}
							type="integer"
							on:change={(e) => { draft.coolantInformation.targetCoolantTemperature = e.detail.value; refresh(); }}
							disabled={!current.coolantInformation?.sampleCooling}
							error={errors.coolantInformation?.targetCoolantTemperature}
						/>
						<h3 class="col-span-3 font-bold mt-4">Comment</h3>
						<div class="col-span-full">
						<TextField 
							label="Comment" 
							value={draft.comment}
							type="text"
							on:change={(e) => { draft.comment = e.detail.value; refresh(); }}
							multiline clearable />
						</div>
					</div>

					<div class="flex justify-between mt-6">
						<div></div>
						<div class="flex gap-2">
							<Button variant="fill" color="danger" on:click={handleDeleteMetadata}>Delete Run</Button>
							<Button type="submit" variant="fill" color="success" loading={saving} disabled={saving}>Save Run</Button>
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
						{#if dagNotice}
							<p class="text-yellow-500 mb-2">{dagNotice}</p>
						{/if}
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
							<div class="flex gap-2">
								<Button on:click={() => setStep(0)}>Back</Button>
								{#if runMetadata.status === 'processing' && runMetadata.dagRunId}
									<Button variant="outline" on:click={() => startPolling(runMetadata.dagRunId)}>
										Retry
									</Button>
								{:else}
									<Button variant="fill" on:click={handleTriggerDAG}>
										Trigger Analysis
									</Button>
								{/if}
							</div>
						</div>
					{/if}
					{#if !testMode && runMetadata.status === 'processing' && runMetadata.dagRunId}
						<div class="mt-4">
							<Button variant="fill" color="danger" loading={cancellingDag} disabled={cancellingDag} on:click={handleCancelDAG}>
								Cancel Processing
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
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-lg font-bold">Pulse Annotation</h3>
					<Button icon={mdiRefresh} disabled={reloadingPulses} on:click={handleRetryLoadPulses}>
						{reloadingPulses ? 'Retrying...' : 'Retry Data Fetch'}
					</Button>
				</div>

				{#if pulseLoadError}
					<p class="text-red-500 text-sm mb-4">{pulseLoadError}</p>
				{/if}

				{#if pulses.length === 0}
					<p class="text-gray-400">No pulses discovered. The pipeline may not have produced any pulse directories.</p>
					<div class="mt-4">
						<Button on:click={() => setStep(1)}>Back</Button>
					</div>
				{:else}
					{#if checkedPulseIds.size > 1}
						<div class="bg-surface-100 rounded-lg p-4 mb-4">
							<h5 class="font-semibold text-sm uppercase tracking-wide text-gray-400 mb-2">
								Edit {checkedPulseIds.size} selected pulses
							</h5>
							<div class="grid grid-cols-[1fr_2fr] gap-4">
								<SelectField
									label="Pulse Quality"
									options={pulseQualityOptions}
									value={bulkPulseQuality}
									placeholder="Mixed"
									clearable={false}
									autoplacement={false}
									on:change={(e) => {
										if (e.detail.value && e.detail.value !== bulkPulseQuality) {
											applyBulkAnnotation({ pulseQuality: e.detail.value });
										}
									}}
								/>
								<TextField
									label="Comment"
									value={bulkComment}
									placeholder={bulkComment === '' && checkedPulses.some((pulse) => pulse.annotationData.comment) ? 'Mixed' : ''}
									on:change={(e) => {
										const comment = String(e.detail.value ?? '');
										if (comment !== bulkComment) {
											applyBulkAnnotation({ comment });
										}
									}}
								/>
							</div>
						</div>
					{/if}

					<div class="grid grid-cols-4 gap-4">
						<!-- Left panel: Pulse list -->
						<div class="col-span-1 bg-surface-100 rounded-lg p-3 overflow-y-auto max-h-[70vh]">
							<div class="flex items-center justify-between mb-3">
								<h4 class="text-sm font-semibold uppercase tracking-wide text-gray-400">Pulses</h4>
								<button class="text-xs text-gray-400 hover:underline" on:click={toggleAllPulsesChecked}>
									{allPulsesChecked ? 'Deselect all' : 'Select all'}
								</button>
							</div>
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<div class="select-none" on:keydown={handlePulseListKeydown}>
								{#each pulses as pulse, i}
									<button
										bind:this={pulseButtons[i]}
										aria-pressed={checkedPulseIds.has(pulse.pulseId)}
										class="w-full text-left px-3 py-3 rounded-md mb-1 flex items-center justify-between transition-colors outline-none
											{checkedPulseIds.has(pulse.pulseId) ? 'bg-blue-600 text-white' : 'hover:bg-surface-300'}
											{selectedPulseIndex === i ? 'ring-2 ring-inset ring-blue-300' : ''}"
										on:click={(e) => handlePulseClick(e, i)}
									>
										<span class="font-semibold">Pulse {pulse.pulseId}</span>
										<span
											class="w-3 h-3 rounded-full {pulse.annotationData.pulseQuality === 'Success' ? 'bg-green-500' : pulse.annotationData.pulseQuality === 'Fail' ? 'bg-red-500' : 'bg-gray-400'}"
										></span>
									</button>
								{/each}
							</div>
						</div>

						<!-- Right panel: Data viewer -->
						<div class="col-span-3 bg-surface-100 rounded-lg p-4 overflow-y-auto max-h-[70vh]">
							{#if selectedPulseIndex === null}
								<div class="flex items-center justify-center h-full text-gray-400">
									<p>Select a pulse from the list to view its data.</p>
								</div>
							{:else}
								<h4 class="text-md font-bold mb-3">Pulse {pulses[selectedPulseIndex].pulseId} Data</h4>

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
											<TextField label="Coolant Flow" value={selectedProcessedData.coolantInformation.coolantFlow} disabled />
											<TextField label="Coolant Temperature In" value={selectedProcessedData.coolantInformation.coolantTemperatureIn} disabled />
											<TextField label="Coolant Temperature Out" value={selectedProcessedData.coolantInformation.coolantTemperatureOut} disabled />
											<TextField label="Delta Temperature" value={selectedProcessedData.coolantInformation.deltaTemperature} disabled />
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
											value={pulses[selectedPulseIndex].annotationData.pulseQuality}
											autoplacement={false}
											on:change={(e) => {
												if (selectedPulseIndex !== null) {
													pulses[selectedPulseIndex].annotationData.pulseQuality = e.detail.value;
													pulses = pulses;
													hasUnsavedAnnotation = true;
												}
											}}
										/>
										<TextField
											label="Comment"
											value={pulses[selectedPulseIndex].annotationData.comment}
											on:change={(e) => {
												if (selectedPulseIndex !== null) {
													pulses[selectedPulseIndex].annotationData.comment = String(e.detail.value ?? '');
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
								Continue to Publish
							</Button>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Step 4: Publish -->
		{#if currentStep === 3}
			<div class="bg-surface-200 rounded-lg shadow p-6 text-surface-content mt-4">
				<h3 class="text-lg font-bold mb-4">Publish to Data Catalogue</h3>
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
											<td>{pulse.pulseId}</td>
											<td>{pulse.annotationData.pulseQuality}</td>
											<td>{pulse.annotationData.comment}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}

				{#if runMetadata.status !== 'ingested'}
					{#if publishStatusText}
						<div class="flex items-center gap-3 mb-4">
							<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
							<span class="text-gray-300">{publishStatusText}</span>
						</div>
					{/if}
					{#if publishError}
						<div class="mt-4">
							<p class="text-red-600 mb-2">{publishError}</p>
							<div class="flex gap-2">
								<Button on:click={() => setStep(2)}>Back</Button>
								<Button variant="outline" disabled={saving} on:click={() => handlePublish()}>Retry</Button>
							</div>
						</div>
					{/if}
					{#if !publishStatusText && !publishError}
						<div class="flex justify-between">
							<Button on:click={() => setStep(2)}>Back</Button>
							<Button variant="fill" color="success" disabled={saving} on:click={handlePublish}>
								{saving ? 'Triggering...' : 'Publish to Data Catalogue'}
							</Button>
						</div>
					{/if}
				{:else}
					<div class="flex items-center gap-2 text-green-600 font-semibold">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						Successfully published to Data Catalogue
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
