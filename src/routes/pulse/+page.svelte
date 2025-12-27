<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, DateField, Logger } from 'svelte-ux';
	import { tableOrderStore, SelectField, type MenuOption, Notification } from 'svelte-ux';
	import { page } from '$app/stores';
	import { mdiCheck, mdiWindowClose, mdiCheckCircleOutline } from '@mdi/js';
	import {  CompiledPulseMetadata, ExperimentMetadata, ConfigurationMetadata, PersonMetadata } from '$lib/models';

	import { triggerDAG } from '$lib/triggerPipeline';
	import { env } from '$env/dynamic/public';
	import { GenericDataService } from '$lib/services/GenericDataService';
	import { ExperimentMetadataModel } from '$lib/models/ExperimentMetadata';
	import { CoolantInformation, HeatingInformation, ThermocoupleInformation } from '$lib/models/CompiledPulseMetadata';
	import { authClient } from '$lib/auth-client';

	async function handleTrigger() {
		const { result, error } = await triggerDAG(env.PUBLIC_AIRFLOW_DIRECTORY, env.PUBLIC_AIRFLOW_INPUT_FILE);
	}

	const handleDisplayElement = (elementId, postProcessData, displayType = "block") => {
		const target = document.getElementById(elementId)

		if (!target) {
			console.error(`Element with ID '${elementId}' not found`);
			return;
		}

		target.style.display = postProcessData ? displayType : 'none';
	}

	// Includes the experiment and configurations
	class PostProcessMetadata {
		pulseNumber: string;
		dataCaptureStart: Date;
		pulseStart: Date;
		pulseEnd: Date;
		pulseDuration: string;
		operator1: PersonMetadata;
		operator2: PersonMetadata;
		heatingInformation: HeatingInformation;
		coolantInformation: CoolantInformation;
		thermocoupleInformation: ThermocoupleInformation;
		comment: string;
		pulseQuality: string;
		experimentNumber: string;
		configurationId: number;
		status: string;
		constructor() {
			this.pulseNumber = '';
			this.dataCaptureStart = new Date();
			this.pulseStart = new Date();
			this.pulseEnd = new Date();
			this.pulseDuration = '';
			this.operator1 = new PersonMetadata();
			this.operator2 = new PersonMetadata();
			this.heatingInformation = new HeatingInformation();
			this.coolantInformation = new CoolantInformation();
			this.thermocoupleInformation = new ThermocoupleInformation();
			this.comment = '';
			this.pulseQuality = '';
			this.experimentNumber = '';
			this.configurationId = 0;
			this.status = '';
		}
	}

	let sortedData: CompiledPulseMetadata[] = [];
	let sortedExperiments: ExperimentMetadata[] = [];
	let sortedConfigurations: ConfigurationMetadata[] = [];
	let sortedPostProcessData: PostProcessMetadata | null = null;

	const order = tableOrderStore({ initialBy: 'pulseNumber', initialDirection: 'asc' });
	const experimentOrder = tableOrderStore({ initialBy: 'experimentName', initialDirection: 'asc' });
	const configurationOrder = tableOrderStore({ initialBy: 'configurationName', initialDirection: 'asc' });

	
	const experimentService = new GenericDataService<ExperimentMetadata>({
		modelClass: ExperimentMetadataModel,
		endpoint: '/api/v1/experiments',
		localFolder: 'experiments',
		idField: 'experimentNumber',
		displayName: 'experiments'
	});

	const configurationService = new GenericDataService<ConfigurationMetadata>({
		modelClass: ConfigurationMetadata,
		endpoint: '/api/v1/configurations',
		localFolder: 'configurations',
		idField: 'configurationId',
		displayName: 'configurations'
	});

	order.subscribe((value) => {
		sortedData = sortedData.sort($order.handler);
	});

	const session = authClient.useSession();
	let open = false;
	let selectedMetadata: CompiledPulseMetadata | null = null;
	let isNewEntry = false;
	let localOnly = false;
	let shouldCloseDialog = true;

	function mapToPulse(apiResponse: any): CompiledPulseMetadata {
		const metadata = new CompiledPulseMetadata();
		const mapped =  Object.assign(metadata, apiResponse);

		// Ensure pulseStart and dataCaptureStart are Date objects
		if (mapped.pulseStart) {
			mapped.pulseStart = new Date(mapped.pulseStart);
		}
		if (mapped.dataCaptureStart) {
			mapped.dataCaptureStart = new Date(mapped.dataCaptureStart);
		}

		return mapped;
	}

	async function fetchExperiments() {
		try {
			sortedExperiments = await experimentService.fetchAll(localOnly);
			experimentOptions = sortedExperiments.map((exp) => ({
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
			sortedConfigurations = await configurationService.fetchAll(localOnly);
			configurationOptions = sortedConfigurations.map((config) => ({
				label: `${config.configurationId} - ${config.configurationName}`,
				value: config.configurationId
			}));
		} catch (error) {
			console.error('Error fetching configurations:', error);
			alert((error as Error).message);
		}
	}

	async function fetchPulses() {
		try {
			if (localOnly) {
				// const pulseFiles = await getJsonFiles('pulses');
				// const pulseData = await Promise.all(pulseFiles.map((filename: string) => getJsonContent('pulses/' + filename)));
				// sortedData = pulseData.map(mapToPulse).sort($order.handler);
				// return;
				// const globalPulseData = await getJsonFile(`${PUBLIC_ROOT_FOLDER_LOCATION}`, 'global-pulse-data.json');

				// Contains a list of Pulse Ids and their status

			}
		} catch (error) {
			console.error('Error fetching pulses:', error);
			alert('Failed to load pulses. Please try again later.');
		}
	}

	async function fetchPostProcessData(directory, filename) {
		if (!directory && !filename) {
			return null;
		}
		try {
			const accessToken = $session.data?.user.accessToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			if (localOnly) {
				sortedPostProcessData = await getJsonContent(`${directory}/${filename}`);
			} else {
				const accessToken = $page.data.session?.user.sessionToken;
				if (!accessToken) {
					throw new Error('No access token available');
				}
				const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/postprocess`, { headers: { Authorization: `Bearer ${accessToken}` } });

				if (!response.ok) throw new Error('Failed to fetch configurations');
				const data = await response.json();
				sortedPostProcessData = await Promise.all(data.map(mapToPulse).sort($order.handler)); 
			}
		} catch (error) {
			console.error('Error fetching postprocess data:', error);
			alert(`Failed to load postprocess data. Please try again later: ${error.message}`);
		}
	}

	async function handleMetadataSubmit(event: CustomEvent<CompiledPulseMetadata>) {
		const metadata = event.detail;

		try {
			await handlePulseFileSubmission(metadata);
			saveNotify = true;

			setTimeout(() => {
				saveNotify = false;
			}, 3000);
		} catch (error) {
			console.error('File submission failed:', error);
		}

		if (localOnly && shouldCloseDialog) {
			handleModalClose();
			await fetchPulses(); // Refresh the data
			return;
		} else if (localOnly) {
			await fetchPulses();
			shouldCloseDialog = true;
			return;
		}

		try {
			await handleAPISubmission(metadata, isNewEntry);
			await fetchPulses();
		} catch (error) {
			console.error('API submission failed:', error);
		}
	}

	async function handleAPISubmission(metadata: CompiledPulseMetadata, isNewEntry: boolean): Promise<void> {
		//Not currently implemented
		try {
			const accessToken = $session.data?.user.accessToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			const url = isNewEntry ? `${env.PUBLIC_METACAT_URL}/api/v1/pulses` : `${env.PUBLIC_METACAT_URL}/api/v1/pulses/${metadata.pulseNumber}`;

			const response = await fetch(url, {
				method: isNewEntry ? 'POST' : 'PUT',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify(metadata)
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(`Failed to save metadata: ${errorData.message}`);
			}
		} catch (error) {
			console.error('Error saving metadata:', error);
			throw error;
		}
	}

	async function handlePulseFileSubmission(metadata: CompiledPulseMetadata): Promise<void> {
		try {
			const pulseNumber = metadata.pulseNumber;
			const sampleNumber = metadata.sampleNumber;
			const experimentNumber = metadata.experimentNumber;
			const filePath = `${env.PUBLIC_ROOT_FOLDER_LOCATION}/HIVE/E-${experimentNumber}/S-${sampleNumber}/P-${pulseNumber}`;
			const fileName = "manual-metadata.json";

			const saveMetadata = {
				targetPath: `${filePath}/${fileName}`,
				metadata: metadata
			};

			const fileResponse = await fetch('/api/save-json', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(saveMetadata)
			});

			if (!fileResponse.ok) {
				const errorData = await fileResponse.json();
				throw new Error(`Failed to save metadata file: ${errorData.message}`);
			}
		} catch (error) {
			console.error('Error saving metadata file:', error);
			throw error;
		}
	}


	function handleRowClick(row: CompiledPulseMetadata): void {
		selectedMetadata = { ...row };
		isNewEntry = false;
		open = true;
	}

	function handleNewEntry(): void {
		selectedMetadata = { ...new CompiledPulseMetadata() };
		isNewEntry = true;
		open = true;
	}

	function handleModalClose() {
		open = false;
		selectedMetadata = null;
		isNewEntry = false;
	}

	function handleCompletePulse() {
		if (!selectedMetadata) {
			return;
		}

		isCompletingPulse = true;
	}

	function handleCancelComplete() {
		isCompletingPulse = false;
	}

	async function runPostProcess(pulseNumber) {
		const ID = pulseNumber
	}


	async function handlePostProcess(commitFn, draft) {
		if (!draft) {
			console.error("Pulse Number not provided")
			alert(`Failed to run post processing: No ID provided`);
			return;
		}
		shouldCloseDialog = false;
		const pulseNumber = draft.pulseNumber
		const sampleNumber = draft.sampleNumber;
		const experimentNumber = draft.experimentNumber;
		const fileDir = `${PUBLIC_ROOT_FOLDER_LOCATION}/HIVE/E-${experimentNumber}/S-${sampleNumber}/P-${pulseNumber}/raw`;
		const fileName = "manual-metadata.json";

		try {
			await commitFn();

			await runPostProcess(`${pulseNumber}`)

			await fetchPostProcessData(fileDir, fileName)

		} catch (error) {
			console.error("Error running post processing:", error);
			alert(`Post processing failed: ${error.message}`);
		}
	}

	async function handleConfirmComplete() {
		if (!selectedMetadata) {
			return;
		}
		isCompletingPulse = false;

		selectedMetadata.status = 'Completed';

		await handlePulseFileSubmission(selectedMetadata);
		await handleFlagFile(selectedMetadata);

		completeNotify = true;
		setTimeout(() => {
			completeNotify = false;
		}, 3000);

		await fetchPulses();

		await handleTrigger();
	}

	async function handleFlagFile(metadata: CompiledPulseMetadata) {
		try {
			const filePath = `${env.PUBLIC_ROOT_FOLDER_LOCATION}`;
			const fileName = `currentPulse.json`;

			const flagData = {
				pulseNumber: metadata.pulseNumber,
				pulseLocation: `pulses/${metadata.pulseNumber}.json`,
				pulseStatus: metadata.status,
				experimentNumber: metadata.experimentNumber,
				configurationId: metadata.configurationId
			};

			const saveMetadata = {
				targetPath: `${filePath}/${fileName}`,
				metadata: flagData
			};

			const fileResponse = await fetch('/api/save-json', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(saveMetadata)
			});

			if (!fileResponse.ok) {
				const errorData = await fileResponse.json();
				throw new Error(`Failed to save metadata file: ${errorData.message}`);
			}
		} catch (error) {
			console.error('Error saving metadata file:', error);
			throw error;
		}
	}

	function handleDelete(): void {
		if (!selectedMetadata) return;

		if (confirm(`Are you sure you want to delete the pulse with ID: ${selectedMetadata.pulseNumber}?`)) {
			if (localOnly) {
				const filePath = `${env.PUBLIC_ROOT_FOLDER_LOCATION}/pulses/${selectedMetadata.pulseNumber}.json`;
				fetch('/api/delete-json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetPath: filePath }) })
					.then((response) => {
						if (!response.ok) throw new Error('Failed to delete local file');
						alert('Pulse deleted successfully');
						fetchPulses();
					})
					.catch((error) => {
						console.error('Error deleting local file:', error);
						alert(`Failed to delete pulse: ${error.message}`);
					});
			} else {
				const accessToken = $session.data?.user.accessToken;
				fetch(`${env.PUBLIC_METACAT_URL}/api/v1/datasets/${selectedMetadata.pulseNumber}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
					.then((response) => {
						if (!response.ok) throw new Error('Failed to delete pulse from API');
						alert('Pulse deleted successfully');
						fetchPulses();
					})
					.catch((error) => {
						console.error('Error deleting pulse from API:', error);
						alert(`Failed to delete pulse: ${error.message}`);
					});
			}
			handleModalClose();
		}
	}	

	onMount(() => {
		if (env.PUBLIC_LOCAL_ONLY == 'true') {
			localOnly = true;
		}
		fetchPulses();
		fetchExperiments();
		fetchConfigurations();
	});

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

	let experimentOptions: MenuOption[] = [];

	let configurationOptions: MenuOption[] = [];

	let inputPowerToggle = true;
	let isCompletingPulse = false;

	let saveNotify = false;
	let completeNotify = false;
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<div class="mb-4 flex justify-between items-center">
		<h2 class="text-2xl font-bold">Pulse Metadata</h2>
		<Button on:click={handleNewEntry} variant="fill">New Pulse</Button>
	</div>
	<div class="table-container">
		<Table
			data={sortedData}
			columns={[
				{ name: 'pulseNumber', align: 'left', header: 'Pulse Number' },
				{name: 'experimentNumber', align: 'left', header: 'Experiment Number'},
				{ name: 'configurationId', align: 'left', header: 'Configuration Id'},
				{
					name: 'pulseStart',
					align: 'left',
					header: 'Pulse Start',
					// @ts-expect-error
					format: (value) => {
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
				},
				{ name: 'pulseQuality', align: 'left', header: 'Pulse Quality' },
				{ name: 'status', align: 'left', header: 'Status' }
			]}
			{order}
			on:cellClick={(e) => handleRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>
</div>

<Dialog {open} on:close={handleModalClose} class="pulseInputDialog">
	<div slot="title">
		<div class="flex justify-between mt-4 relative">
			<div>{isNewEntry ? 'Create New Pulse' : 'Edit Pulse Metadata'}</div>
			<div class="absolute right-20 top-0 z-10"></div>
		</div>
	</div>
	<div class="p-4">
		<Form initial={selectedMetadata} on:change={handleMetadataSubmit} let:commit let:draft let:refresh>
			<div class="p-4 grid grid-cols-3 gap-4">
				<h3 class="col-span-3 font-bold mt-4">Pulse Information</h3>
				<SelectField
					options={experimentOptions}
					label="Experiment Number"
					value={draft.experimentNumber}
					autoplacement={false}
					on:change={(e) => {
						draft.experimentNumber = e.detail.value;
						draft.pulseId = `${draft.experimentNumber || ''}-${draft.sampleNumber || ''}-${draft.pulseNumber || ''}`;
						refresh();
					}}
				/>
				<TextField
					label="Sample Number"
					type="integer"
					value={draft.sampleNumber}
					on:change={(e) => {
						draft.sampleNumber = e.detail.value;
						draft.pulseId = `${draft.experimentNumber || ''}-${draft.sampleNumber || ''}-${draft.pulseNumber || ''}`;
						refresh();
					}}
				/>
				<TextField
					label="Pulse Number"
					value={draft.pulseNumber}
					type="integer"
					on:change={(e) => {
						draft.pulseNumber = e.detail.value;
						draft.pulseId = `${draft.experimentNumber || ''}-${draft.sampleNumber || ''}-${draft.pulseNumber || ''}`;
						refresh();
					}}
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
				/>

				<h3 class="col-span-3 font-bold mt-4">Operator 1</h3>
				<TextField
					label="First Name"
					value={draft.operator1.firstName}
					on:change={(e) => {
						draft.operator1.firstName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Last Name"
					value={draft.operator1.lastName}
					on:change={(e) => {
						draft.operator1.lastName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Email"
					value={draft.operator1.email}
					on:change={(e) => {
						draft.operator1.email = e.detail.value;
						refresh();
					}}
				/>

				<h3 class="col-span-3 font-bold mt-4">Operator 2</h3>
				<TextField
					label="First Name"
					value={draft.operator2.firstName}
					on:change={(e) => {
						draft.operator2.firstName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Last Name"
					value={draft.operator2.lastName}
					on:change={(e) => {
						draft.operator2.lastName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Email"
					value={draft.operator2.email}
					on:change={(e) => {
						draft.operator2.email = e.detail.value;
						refresh();
					}}
				/>

				<h3 class="col-span-3 font-bold mt-4">Heating Information</h3>
				<SelectField
					options={coilHeatingTypeOptions}
					label="Heating Type"
					value={draft.heatingInformation.heatingType}
					autoplacement={false}
					on:change={(e) => {
						draft.heatingInformation.heatingType = e.detail.value;
					}}
				/>

				<SelectField
					options={coilCurrentTypeOptions}
					label="Current Type"
					value={draft.heatingInformation.currentType}
					autoplacement={false}
					on:change={(e) => {
						draft.heatingInformation.currentType = e.detail.value;
						if (e.detail.value === 'AC') {
							inputPowerToggle = true;
						} else {
							inputPowerToggle = false;
						}
						refresh();
					}}
				/>

				<TextField
					label="Input Power"
					value={draft.heatingInformation.inputPower}
					type="integer"
					on:change={(e) => {
						draft.heatingInformation.inputPower = e.detail.value;
						refresh();
					}}
					disabled={inputPowerToggle}
				/>
				<TextField
					label="Input Current"
					value={draft.heatingInformation.inputCurrent}
					type="integer"
					on:change={(e) => {
						draft.heatingInformation.inputCurrent = e.detail.value;
						refresh();
					}}
					disabled={inputPowerToggle}
				/>
				<TextField
					label="Input Voltage"
					value={draft.heatingInformation.inputVoltage}
					type="integer"
					on:change={(e) => {
						draft.heatingInformation.inputVoltage = e.detail.value;
						refresh();
					}}
					disabled={inputPowerToggle}
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
				/>
				<SelectField
					options={coolantTypeOptions}
					label="Coolant Type"
					value={draft.coolantInformation.coolantType}
					autoplacement={false}
					on:change={(e) => {
						draft.coolantInformation.coolantType = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Target Coolant Flow"
					value={draft.coolantInformation.targetCoolantFlow}
					type="integer"
					on:change={(e) => {
						draft.coolantInformation.targetCoolantFlow = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Target Coolant Temperature"
					value={draft.coolantInformation.targetCoolantTemperature}
					type="integer"
					on:change={(e) => {
						draft.coolantInformation.targetCoolantTemperature = e.detail.value;
						refresh();
					}}
				/>
				<div class="col-span-3 grid grid-cols-3 gap-4">  
				<h3 class="col-span-3 font-bold mt-4">Pulse Details</h3>
				<div class="col-span-3">
					<TextField
						label="Comment"
						value={draft.comment}
						on:change={(e) => {
							draft.comment = e.detail.value;
							refresh();
						}}
						multiline
					/>
				</div>
				<SelectField
					options={pulseQualityOptions}
					label="Pulse Quality"
					value={draft.pulseQuality}
					autoplacement={false}
					on:change={(e) => {
						draft.pulseQuality = e.detail.value;
						refresh();
					}}
				/>
				</div>
				{#if sortedPostProcessData}
					<h6 class="col-span-3 font-bold mt-4">Post Processing Information</h6>
					<div class="col-span-3 grid grid-cols-3 gap-4 bordered"> 
					<h6 class="col-span-3 font-bold mt-4 small-heading">Pulse Information</h6>
						<DateField
							label="Pulse Start"
							format="dd/MM/yyyy HH:mm"
							picker
							value={sortedPostProcessData ? (draft ? 
											(draft.pulseStart = 
											sortedPostProcessData.pulseStart) : '') :
											draft?.pulseStart || ''}
							disabled
						/>
						<DateField
							label="Data Capture Start"
							format="dd/MM/yyyy HH:mm"
							picker
							value={sortedPostProcessData ? (draft ? 
											(draft.dataCaptureStart =
											sortedPostProcessData.dataCaptureStart) : '') :
											draft.dataCaptureStart || ''}
							disabled
						/>
						<TextField
							label="Pulse Duration"
							value={sortedPostProcessData ? (draft ? 
											(draft.pulseDuration = 
											sortedPostProcessData.pulseDuration) : '') : 
											draft.pulseDuration || ''}
							disabled
						/>
						<DateField
							label="Pulse End"
							format="dd/MM/yyyy HH:mm"
							picker
							value={sortedPostProcessData ? (draft ? 
											(draft.pulseEnd =
											sortedPostProcessData.pulseEnd) : '') :
											draft.pulseEnd || ''}
							disabled
						/>
						<div class="col-span-3 grid grid-cols-3 gap-4">
						<h6 class="col-span-3 font-bold mt-4 small-heading">Heating Information</h6>
						<TextField
							label="Output Frequency"
							value={sortedPostProcessData ? (draft ? 
												(draft.heatingInformation.outputFrequency = 
												sortedPostProcessData.heatingInformation.inputPower) : '') : 
												draft?.heatingInformation.outputFrequency || ''}
							disabled
						/>
						<TextField
							label="Measured Power"
							value={sortedPostProcessData ? (draft ? 
											(draft.heatingInformation.measuredPower = 
											sortedPostProcessData.heatingInformation.inputPower) : '') :
											draft?.heatingInformation.measuredPower || ''}
							disabled
						/>
						<TextField
							label="Output Current"
							value={sortedPostProcessData ? (draft ? 
											(draft.heatingInformation.outputCurrent = 
											sortedPostProcessData.heatingInformation.inputPower) : '') :
											draft?.heatingInformation.outputCurrent || ''}
							disabled
						/>
						<TextField
							label="Output Voltage"
							value={sortedPostProcessData ? (draft ? 
											(draft.heatingInformation.outputVoltage = 
											sortedPostProcessData.heatingInformation.inputPower) : '') :
											draft?.heatingInformation.outputVoltage || ''}
							disabled
						/>
						</div>
						<div class="col-span-3 grid grid-cols-3 gap-4">
						<h6 class="col-span-3 font-bold mt-4 small-heading">Coolant Information</h6>
						<TextField
							label="Measured Coolant Flow"
							value={sortedPostProcessData ? (draft ? 
												(draft.coolantInformation.measuredCoolantFlow = 
												sortedPostProcessData.heatingInformation.inputPower) : '') : 
												draft?.coolantInformation.measuredCoolantFlow || ''}
							disabled
						/>
						<TextField
							label="Coolant Flow Variance"
							value={sortedPostProcessData ? (draft ? 
												(draft.coolantInformation.coolantFlowVariance = 
												sortedPostProcessData.heatingInformation.inputPower) : '') : 
												draft?.coolantInformation.coolantFlowVariance || ''}
							disabled
						/>
						<TextField
							label="Coolant Pressure In"
							value={sortedPostProcessData ? (draft ? 
												(draft.coolantInformation.coolantPressureIn = 
												sortedPostProcessData.heatingInformation.inputPower) : '') : 
												draft?.coolantInformation.coolantPressureIn || ''}
							disabled
						/>
						<TextField
							label="Coolant Pressure Out"
							value={sortedPostProcessData ? (draft ? 
												(draft.coolantInformation.coolantPressureOut = 
												sortedPostProcessData.heatingInformation.inputPower) : '') : 
												draft?.coolantInformation.coolantPressureOut || ''}
							disabled
						/>
						<TextField
							label="Delta Pressure"
							value={sortedPostProcessData ? (draft ? 
												(draft.coolantInformation.deltaPressure = 
												sortedPostProcessData.heatingInformation.inputPower) : '') : 
												draft?.coolantInformation.deltaPressure || ''}
							disabled
						/>
						<TextField
							label="Coolant Temperature In"
							value={sortedPostProcessData ? (draft ? 
												(draft.coolantInformation.coolantTemperatureIn = 
												sortedPostProcessData.heatingInformation.inputPower) : '') : 
												draft?.coolantInformation.coolantTemperatureIn || ''}
							disabled
						/>
						<TextField
							label="Coolant Temperature In Variance"
							value={sortedPostProcessData ? (draft ? 
												(draft.coolantInformation.coolantTemperatureInVariance = 
												sortedPostProcessData.heatingInformation.inputPower) : '') : 
												draft?.coolantInformation.coolantTemperatureInVariance || ''}
							disabled
						/>
						<TextField
							label="Coolant Temperature Out"
							value={sortedPostProcessData ? (draft ? 
												(draft.coolantInformation.coolantTemperatureOut = 
												sortedPostProcessData.heatingInformation.inputPower) : '') : 
												draft?.coolantInformation.coolantTemperatureOut || ''}
							disabled
						/>
						<TextField
							label="Coolant Temperature Out Variance"
							value={sortedPostProcessData ? (draft ? 
												(draft.coolantInformation.coolantTemperatureOutVariance = 
												sortedPostProcessData.heatingInformation.inputPower) : '') : 
												draft?.coolantInformation.coolantTemperatureOutVariance || ''}
							disabled
						/>
						<TextField
							label="Delta Temperature"
							value={sortedPostProcessData ? (draft ? 
												(draft.coolantInformation.deltaPressure = 
												sortedPostProcessData.heatingInformation.inputPower) : '') : 
												draft?.coolantInformation.deltaPressure || ''}
							disabled
						/>
						</div>
						<div class="col-span-3 grid grid-cols-3 gap-4">
						<h6 class="col-span-3 font-bold mt-4 small-heading">Thermocouple Information</h6>
						<TextField
							label="Thermocouple ID"
							value={sortedPostProcessData ? (draft ? 
												(draft.thermocoupleInformation.thermocoupleID = 
												sortedPostProcessData.heatingInformation.inputPower) : '') : 
												draft?.thermocoupleInformation.thermocoupleID || ''}
							disabled
						/>
						<TextField
							label="Max Value"
							value={sortedPostProcessData ? (draft ? 
												(draft.thermocoupleInformation.maxValue = 
												sortedPostProcessData.heatingInformation.inputPower) : '') : 
												draft?.thermocoupleInformation.maxValue || ''}
							disabled
						/>
						</div>
					</div>
				{/if}
			</div>

			<div class="flex justify-between mt-4 relative">
				<div class="flex gap-2">
					{#if !isCompletingPulse}
						<Button variant="outline" color="success" on:click={handleCompletePulse}>Ingest</Button>
					{:else}
						<Button variant="outline" color="success" on:click={handleConfirmComplete} icon={mdiCheck}>Confirm</Button>
						<Button variant="outline" color="danger" on:click={handleCancelComplete} icon={mdiWindowClose}>Cancel</Button>
					{/if}
				</div>

				<div class="absolute left-1/2 -translate-x-1/2 -top-3 z-10">
					<Notification title="Successfully Saved!" icon={mdiCheckCircleOutline} color="success" closeIcon open={saveNotify} />
					<Notification title="Successfully Completed!" icon={mdiCheckCircleOutline} color="success" closeIcon open={completeNotify} />
				</div>

				<div class="flex gap-2">
					{#if !isNewEntry}
						<div class="mr-4">
							<Button variant="outline" color="danger" on:click={handleDelete}>Delete</Button>
						</div>
					{/if}
					<Button on:click={() => commit()} variant="fill">Save</Button>
					<Button on:click={(event) => {handlePostProcess(commit, draft)}} variant="fill"> Pulse Completed </Button>
					<Button on:click={handleModalClose}>Cancel</Button>
				</div>
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

	:global(.pulseInputDialog) {
		max-height: 90vh;
	}
	.bordered {
		border:1px solid grey; 
		padding: 10px; 
		border-radius: 5px;
	}
	.small-heading{
		font-size: 12px;
		font-weight: 600;
	}
</style>
