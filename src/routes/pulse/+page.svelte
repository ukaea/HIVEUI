<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, DateField, Logger } from 'svelte-ux';
	import { tableOrderStore, SelectField, type MenuOption, Notification } from 'svelte-ux';
	import { page } from '$app/stores';
	import { PUBLIC_LOCAL_ONLY, PUBLIC_METACAT_URL, PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';
	import { mdiCheck, mdiWindowClose, mdiCheckCircleOutline } from '@mdi/js';
	import { getJsonFiles, getJsonContent } from '$lib/jsonUtils';
	import { ExperimentMetadata, ConfigurationMetadata, PersonMetadata } from '$lib/models';
	import { triggerDAG } from '$lib/triggerPipeline';
	import { PUBLIC_AIRFLOW_DIRECTORY, PUBLIC_AIRFLOW_INPUT_FILE } from '$env/static/public';

	async function handleTrigger() {
		const { result, error } = await triggerDAG(PUBLIC_AIRFLOW_DIRECTORY, PUBLIC_AIRFLOW_INPUT_FILE);
	}

	class CoilInformation {
		currentType: string;
		inputPower: string;
		inputCurrent: string;
		inputVoltage: string;
		outputFrequency: string;
		outputPower: string;
		outputCurrent: string;
		outputVoltage: string;
		constructor() {
			this.currentType = '';
			this.inputPower = '';
			this.inputCurrent = '';
			this.inputVoltage = '';
			this.outputFrequency = '';
			this.outputPower = '';
			this.outputCurrent = '';
			this.outputVoltage = '';
		}
	}

	class ThermocoupleInformation {
		thermocoupleID: string;
		maxValue: string;

		constructor(){
			this.thermocoupleID = '';
			this.maxValue = '';
		}
	}


	class CoolantPressure {
		in: string;
		out: string;
		delta: string;

		constructor() {
			this.in = '';
			this.out = '';
			this.delta = '';
		}
	}

	class CoolantInformation {
		coolantType: string;
		targetCoolantFlow: string;
		targetCoolantTemperature: string;
		measuredCoolantFlow: string;
		coolantFlowVariance:string;
		coolantPressureIn: string;
		coolantPressureOut: string;
		deltaPressure: string;
		coolantTemperatureIn: string;
		coolantTemperatureInVariance: string;
		coolantTemperatureOut: string;
		coolantTemperatureOutVariance: string;
		deltaTemperature: string;
		constructor() {
			this.coolantType = '';
			this.targetCoolantFlow = '';
			this.targetCoolantTemperature = '';
			this.measuredCoolantFlow = '';
			this.coolantFlowVariance = '';
			this.coolantPressureIn = '';
			this.coolantPressureOut = '';
			this.deltaPressure = '';
			this.coolantTemperatureIn = '';
			this.coolantTemperatureInVariance = '';
			this.coolantTemperatureOut = '';
			this.coolantTemperatureOutVariance = '';
			this.deltaTemperature = '';
		}
	}

	// Includes the experiment and configurations
	class CompiledPulseMetadata {
		pulseID: string;
		dataCaptureStart: Date;
		pulseStart: Date;
		pulseEnd: string;
		pulseDuration: string;
		operator1: PersonMetadata;
		operator2: PersonMetadata;
		coilInformation: CoilInformation;
		coolantInformation: CoolantInformation;
		thermocoupleInformation: ThermocoupleInformation;
		comment: string;
		pulseQuality: string;
		pulseUUID: string;
		experimentUUID: string;
		configurationUUID: string;
		status: string;
		constructor() {
			this.pulseID = '';
			this.dataCaptureStart = new Date();
			this.pulseStart = new Date();
			this.pulseEnd = new Date();
			this.pulseDuration = '';
			this.operator1 = new PersonMetadata();
			this.operator2 = new PersonMetadata();
			this.coilInformation = new CoilInformation();
			this.coolantInformation = new CoolantInformation();
			this.thermocoupleInformation = new ThermocoupleInformation();
			this.comment = '';
			this.pulseQuality = '';
			this.pulseUUID = '';
			this.experimentUUID = '';
			this.configurationUUID = '';
			this.status = '';
		}
	}

	let sortedData: CompiledPulseMetadata[] = [];
	let sortedExperiments: ExperimentMetadata[] = [];
	let sortedConfigurations: ConfigurationMetadata[] = [];

	const order = tableOrderStore({ initialBy: 'pulseID', initialDirection: 'asc' });
	const experimentOrder = tableOrderStore({ initialBy: 'experimentName', initialDirection: 'asc' });
	const configurationOrder = tableOrderStore({ initialBy: 'configurationName', initialDirection: 'asc' });

	order.subscribe((value) => {
		sortedData = sortedData.sort($order.handler);
	});

	let open = false;
	let selectedMetadata: CompiledPulseMetadata | null = null;
	let isNewEntry = false;
	let localOnly = false;

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

		console.log('Mapped Pulse:', mapped);

		return mapped;
	}

	async function fetchExperiments() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			if (localOnly) {
				const files = await getJsonFiles('experiments');
				const experimentData = await Promise.all(files.map((filename: string) => getJsonContent('experiments/' + filename)));
				const experiments = await Promise.all(experimentData.map(ExperimentMetadata.fromJSON));
				sortedExperiments = experiments.sort($experimentOrder.handler);

				experimentOptions = sortedExperiments.map((experiment) => ({
					label: experiment.experimentTitle,
					value: experiment.experimentUUID
				}));
				return;
			}

			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/experiments`, { headers: { Authorization: `Bearer ${accessToken}` } });

			if (!response.ok) throw new Error('Failed to fetch experiments');
			const data = await response.json();
			sortedExperiments = data.map(ExperimentMetadata.fromJSON).sort($experimentOrder.handler);
		} catch (error) {
			console.error('Error fetching experiments:', error);
			alert('Failed to load experiments. Please try again later.');
		}
	}

	async function fetchConfigurations() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			if (localOnly) {
				const files = await getJsonFiles('configurations');
				const configurationData = await Promise.all(files.map((filename: string) => getJsonContent('configurations/' + filename)));
				const configurations = await Promise.all(configurationData.map(ConfigurationMetadata.fromJSON));
				sortedConfigurations = configurations.sort($configurationOrder.handler);

				configurationOptions = sortedConfigurations.map((configuration) => ({
					label: configuration.configurationName,
					value: configuration.configurationUUID
				}));
				return;
			}

			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/configurations`, { headers: { Authorization: `Bearer ${accessToken}` } });

			if (!response.ok) throw new Error('Failed to fetch configurations');
			const data = await response.json();
			const configurations = await Promise.all(data.map(ConfigurationMetadata.fromJSON));
			sortedConfigurations = configurations.sort($configurationOrder.handler);
		} catch (error) {
			console.error('Error fetching configurations:', error);
			alert('Failed to load configurations. Please try again later.');
		}
	}

	async function fetchPulses() {
		try {
			if (localOnly) {
				const pulseFiles = await getJsonFiles('pulses');
				const pulseData = await Promise.all(pulseFiles.map((filename: string) => getJsonContent('pulses/' + filename)));
				sortedData = pulseData.map(mapToPulse).sort($order.handler);
				return;
			}
		} catch (error) {
			console.error('Error fetching pulses:', error);
			alert('Failed to load pulses. Please try again later.');
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

		if (localOnly) {
			handleModalClose();
			await fetchPulses(); // Refresh the data
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
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			const url = isNewEntry ? `${PUBLIC_METACAT_URL}/api/v1/pulses` : `${PUBLIC_METACAT_URL}/api/v1/pulses/${metadata.pulseID}`;

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
			const pulseID = metadata.pulseID;
			const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/pulses/`;
			const fileName = `${pulseID}.json`;

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
			const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}`;
			const fileName = `currentPulse.json`;

			const flagData = {
				pulseID: metadata.pulseID,
				pulseLocation: `pulses/${metadata.pulseID}.json`,
				pulseStatus: metadata.status,
				experimentUUID: metadata.experimentUUID,
				configurationUUID: metadata.configurationUUID
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

		if (confirm(`Are you sure you want to delete the pulse with ID: ${selectedMetadata.pulseID}?`)) {
			if (localOnly) {
				const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/pulses/${selectedMetadata.pulseID}.json`;
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
				const accessToken = $page.data.session?.sessionToken;
				fetch(`${PUBLIC_METACAT_URL}/api/v1/datasets/${selectedMetadata.pulseID}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
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
		if (PUBLIC_LOCAL_ONLY == 'true') {
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
				{ name: 'pulseID', align: 'left', header: 'Pulse ID' },
				{name: 'experimentUUID', align: 'left', header: 'Experiment Name',
					// @ts-expect-error
					format: (value) => {
						if (!value) return '';
						const experiment = sortedExperiments.find((exp) => exp.experimentUUID === value);
						return experiment ? experiment.experimentTitle : '';
					}
				},
				{ name: 'configurationUUID', align: 'left', header: 'Configuration Name',
					// @ts-expect-error
					format: (value) => {
						if (!value) return '';
						const configuration = sortedConfigurations.find((conf) => conf.configurationUUID === value);
						return configuration ? configuration.configurationName : '';
					}
				},
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
				<TextField
					label="Pulse UUID"
					value={draft.pulseID}
					on:change={(e) => {
						draft.pulseID = e.detail.value;
						refresh();
					}}
				/>
				<SelectField
					options={experimentOptions}
					label="Experiment"
					value={draft.experimentUUID}
					autoplacement={false}
					on:change={(e) => {
						draft.experimentUUID = e.detail.value;
						refresh();
					}}
				/>
				<SelectField
					options={configurationOptions}
					label="Configuration"
					value={draft.configurationUUID}
					autoplacement={false}
					on:change={(e) => {
						draft.configurationUUID = e.detail.value;
						refresh();
					}}
				/>
				<DateField
					label="Pulse Start"
					format="dd/MM/yyyy HH:mm"
					picker
					value={draft.pulseStart}
					on:change={(e) => {
						draft.pulseStart = e.detail.value;
						refresh();
					}}
				/>
				<DateField
					label="Data Capture Start"
					format="dd/MM/yyyy HH:mm"
					picker
					value={draft.dataCaptureStart}
					on:change={(e) => {
						draft.dataCaptureStart = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Pulse Duration"
					value={draft.pulseDuration}
					on:change={(e) => {
						draft.pulseDuration = e.detail.value;
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

				<h3 class="col-span-3 font-bold mt-4">Coil Information</h3>
				<SelectField
					options={coilCurrentTypeOptions}
					label="Current Type"
					value={draft.coilInformation.currentType}
					autoplacement={false}
					on:change={(e) => {
						draft.coilInformation.currentType = e.detail.value;
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
					value={draft.coilInformation.inputPower}
					on:change={(e) => {
						draft.coilInformation.inputPower = e.detail.value;
						refresh();
					}}
					disabled={inputPowerToggle}
				/>
				<TextField
					label="Input Current"
					value={draft.coilInformation.inputCurrent}
					on:change={(e) => {
						draft.coilInformation.inputCurrent = e.detail.value;
						refresh();
					}}
					disabled={inputPowerToggle}
				/>
				<TextField
					label="Input Voltage"
					value={draft.coilInformation.inputVoltage}
					on:change={(e) => {
						draft.coilInformation.inputVoltage = e.detail.value;
						refresh();
					}}
					disabled={inputPowerToggle}
				/>

				<h3 class="col-span-3 font-bold mt-4">Coolant Information</h3>
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
					on:change={(e) => {
						draft.coolantInformation.targetCoolantFlow = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Target Coolant Temperature"
					value={draft.coolantInformation.targetCoolantTemperature}
					on:change={(e) => {
						draft.coolantInformation.targetCoolantTemperature = e.detail.value;
						refresh();
					}}
				/>
			</div>

			<div class="flex justify-between mt-4 relative">
				<div class="flex gap-2">
					{#if !isCompletingPulse}
						<Button variant="outline" color="success" on:click={handleCompletePulse}>Pulse Completed</Button>
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
</style>
