<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, DateField } from 'svelte-ux';
	import { tableOrderStore, SelectField, type MenuOption, Notification } from 'svelte-ux';
	import { page } from '$app/stores';
	import { PUBLIC_LOCAL_ONLY, PUBLIC_METACAT_URL, PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';
	import { mdiCheck, mdiWindowClose, mdiCheckCircleOutline } from '@mdi/js';
	import { getJsonFiles, getJsonContent } from '$lib/jsonUtils';

	class Person {
		firstName: string;
		lastName: string;
		email: string;

		constructor() {
			this.firstName = '';
			this.lastName = '';
			this.email = '';
		}
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

	class CoolantFlow {
		rate: string; // FlowRate type
		setpoint: string;
		value: string;
		variance: string;

		constructor() {
			this.rate = '';
			this.setpoint = '';
			this.value = '';
			this.variance = '';
		}
	}

	class CoolantTemperature {
		setpoint: string;
		in: string;
		inVariance: string;
		out: string;
		outVariance: string;
		delta: string;

		constructor() {
			this.setpoint = '';
			this.in = '';
			this.inVariance = '';
			this.out = '';
			this.outVariance = '';
			this.delta = '';
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
		coolantFlow: CoolantFlow;
		coolantTemperature: CoolantTemperature;
		coolantPressure: CoolantPressure;
		constructor() {
			this.coolantType = '';
			this.coolantFlow = new CoolantFlow();
			this.coolantTemperature = new CoolantTemperature();
			this.coolantPressure = new CoolantPressure();
		}
	}

	class PulseMetadata {
		pulseID: string;
		firstOperator: Person;
		secondOperator: Person;
		pulseStart: Date;
		pulseDuration: string;
		dataCaptureStart: Date;
		operatorComment: string;
		pulseQuality: string;
		coilInformation: CoilInformation;
		coolantInformation: CoolantInformation;
		constructor() {
			this.pulseID = '';
			this.firstOperator = new Person();
			this.secondOperator = new Person();
			this.pulseStart = new Date();
			this.pulseDuration = '';
			this.dataCaptureStart = new Date();
			this.operatorComment = '';
			this.pulseQuality = '';
			this.coilInformation = new CoilInformation();
			this.coolantInformation = new CoolantInformation();
		}
	}

	class ExperimentSelectMetadata {
		experimentID: string;
		constructor() {
			this.experimentID = '';
		}
	}

	class ConfiguationSelectMetadata {
		configurationID: string;
		constructor() {
			this.configurationID = '';
		}
	}

	// Includes the experiment and configurations
	class CompiledPulseMetadata {
		pulse: PulseMetadata;
		experimentID: string;
		configurationID: string;
		status: string;
		constructor() {
			this.pulse = new PulseMetadata();
			this.experimentID = '';
			this.configurationID = '';
			this.status = '';
		}
	}

	let sortedData: CompiledPulseMetadata[] = [];
	let sortedExperiments: ExperimentSelectMetadata[] = [];
	let sortedConfigurations: ConfiguationSelectMetadata[] = [];

	const order = tableOrderStore({ initialBy: 'pulse.pulseID', initialDirection: 'asc' });
	let open = false;
	let selectedMetadata: CompiledPulseMetadata | null = null;
	let isNewEntry = false;
	let localOnly = false;

	function mapToPulse(apiResponse: any): CompiledPulseMetadata {
		const metadata = new CompiledPulseMetadata();
		const mapped =  Object.assign(metadata, apiResponse);

		// Ensure pulseStart and dataCaptureStart are Date objects
		if (mapped.pulse.pulseStart) {
			mapped.pulse.pulseStart = new Date(mapped.pulse.pulseStart);
		}
		if (mapped.pulse.dataCaptureStart) {
			mapped.pulse.dataCaptureStart = new Date(mapped.pulse.dataCaptureStart);
		}

		return mapped;
	}

	function mapToExperiment(apiResponse: any): ExperimentSelectMetadata {
		const metadata = new ExperimentSelectMetadata();
		// Assume all fields are valid
		return Object.assign(metadata, apiResponse);
	}

	function mapToConfiguration(apiResponse: any): ConfiguationSelectMetadata {
		const metadata = new ConfiguationSelectMetadata();
		// Assume all fields are valid
		return Object.assign(metadata, apiResponse);
	}

	async function fetchExperiments() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			if (localOnly) {
				const files = await getJsonFiles('experiments');
				const data = await Promise.all(files.map((filename: string) => getJsonContent('experiments/' + filename)));
				sortedExperiments = data.map(mapToExperiment).sort($order.handler);
				experimentOptions = sortedExperiments.map((experiment) => {
					return { label: experiment.experimentID, value: experiment.experimentID };
				});
				return;
			}

			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/proposals?filter=%7B%7D`, { headers: { Authorization: `Bearer ${accessToken}` } });

			if (!response.ok) throw new Error('Failed to fetch proposals');
			const data = await response.json();
			// Map the API response to ExperimentMetadata
			sortedExperiments = data.map(mapToExperiment).sort($order.handler);
			experimentOptions = sortedExperiments.map((experiment) => {
				return { label: experiment.experimentID, value: experiment.experimentID };
			});
		} catch (error) {
			console.error('Error fetching proposals:', error);
			alert('Failed to load proposals. Please try again later.');
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
				const configurations = await Promise.all(files.map((filename: string) => getJsonContent('configurations/' + filename)));

				// Map and sort the configuration
				sortedConfigurations = configurations.map(mapToConfiguration).sort($order.handler);
				configurationOptions = sortedConfigurations.map((configuration) => {
					return { label: configuration.configurationID, value: configuration.configurationID };
				});
				return;
			}

			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/configurations`, { headers: { Authorization: `Bearer ${accessToken}` } });
			if (!response.ok) throw new Error('Failed to fetch configurations');
			const data = await response.json();
			sortedConfigurations = data.map(mapToConfiguration).sort($order.handler);
			configurationOptions = sortedConfigurations.map((configuration) => {
				return { label: configuration.configurationID, value: configuration.configurationID };
			});
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

			const url = isNewEntry ? `${PUBLIC_METACAT_URL}/api/v1/pulses` : `${PUBLIC_METACAT_URL}/api/v1/pulses/${metadata.pulse.pulseID}`;

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
			const pulseID = metadata.pulse.pulseID;
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
	}

	async function handleFlagFile(metadata: CompiledPulseMetadata) {
		try {
			const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}`;
			const fileName = `currentPulse.json`;

			const flagData = {
				pulseID: metadata.pulse.pulseID,
				pulseLocation: `pulses/${metadata.pulse.pulseID}.json`,
				pulseStatus: metadata.status,
				experimentID: metadata.experimentID,
				configurationID: metadata.configurationID
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

		if (confirm(`Are you sure you want to delete the pulse with ID: ${selectedMetadata.pulse.pulseID}?`)) {
			if (localOnly) {
				const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/pulses/${selectedMetadata.pulse.pulseID}.json`;
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
				fetch(`${PUBLIC_METACAT_URL}/api/v1/datasets/${selectedMetadata.pulse.pulseID}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
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
				{ name: 'pulse.pulseID', align: 'left', header: 'Pulse ID' },
				{ name: 'experimentID', align: 'left', header: 'Experiment ID' },
				// { name: 'pulse.pulseStart', align: 'left', header: 'Pulse Start' },
				{
					name: 'pulse.pulseStart',
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
				{ name: 'pulse.pulseQuality', align: 'left', header: 'Pulse Quality' },
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
					label="Pulse ID"
					value={draft.pulse.pulseID}
					on:change={(e) => {
						draft.pulse.pulseID = e.detail.value;
						refresh();
					}}
				/>
				<SelectField
					options={experimentOptions}
					label="Experiment"
					value={draft.experimentID}
					autoplacement={false}
					on:change={(e) => {
						draft.experimentID = e.detail.value;
						refresh();
					}}
				/>
				<SelectField
					options={configurationOptions}
					label="Configuration"
					value={draft.configurationID}
					autoplacement={false}
					on:change={(e) => {
						draft.configurationID = e.detail.value;
						refresh();
					}}
				/>
				<DateField
					label="Pulse Start"
					format="dd/MM/yyyy HH:mm"
					picker
					value={draft.pulse.pulseStart}
					on:change={(e) => {
						draft.pulse.pulseStart = e.detail.value;
						refresh();
					}}
				/>
				<DateField
					label="Data Capture Start"
					format="dd/MM/yyyy HH:mm"
					picker
					value={draft.pulse.dataCaptureStart}
					on:change={(e) => {
						draft.pulse.dataCaptureStart = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Pulse Duration"
					value={draft.pulse.pulseDuration}
					on:change={(e) => {
						draft.pulse.pulseDuration = e.detail.value;
						refresh();
					}}
				/>

				<h3 class="col-span-3 font-bold mt-4">Operator 1</h3>
				<TextField
					label="First Name"
					value={draft.pulse.firstOperator.firstName}
					on:change={(e) => {
						draft.pulse.firstOperator.firstName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Last Name"
					value={draft.pulse.firstOperator.lastName}
					on:change={(e) => {
						draft.pulse.firstOperator.lastName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Email"
					value={draft.pulse.firstOperator.email}
					on:change={(e) => {
						draft.pulse.firstOperator.email = e.detail.value;
						refresh();
					}}
				/>

				<h3 class="col-span-3 font-bold mt-4">Operator 2</h3>
				<TextField
					label="First Name"
					value={draft.pulse.secondOperator.firstName}
					on:change={(e) => {
						draft.pulse.secondOperator.firstName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Last Name"
					value={draft.pulse.secondOperator.lastName}
					on:change={(e) => {
						draft.pulse.secondOperator.lastName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Email"
					value={draft.pulse.secondOperator.email}
					on:change={(e) => {
						draft.pulse.secondOperator.email = e.detail.value;
						refresh();
					}}
				/>

				<h3 class="col-span-3 font-bold mt-4">Pulse Details</h3>
				<div class="col-span-3">
					<TextField
						label="Comment"
						value={draft.pulse.comment}
						on:change={(e) => {
							draft.pulse.operatorComment = e.detail.value;
							refresh();
						}}
						multiline
					/>
				</div>
				<SelectField
					options={pulseQualityOptions}
					label="Pulse Quality"
					value={draft.pulse.pulseQuality}
					autoplacement={false}
					on:change={(e) => {
						draft.pulse.pulseQuality = e.detail.value;
						refresh();
					}}
				/>

				<h3 class="col-span-3 font-bold mt-4">Coil Information</h3>
				<SelectField
					options={coilCurrentTypeOptions}
					label="Current Type"
					value={draft.pulse.coilInformation.currentType}
					autoplacement={false}
					on:change={(e) => {
						draft.pulse.coilInformation.currentType = e.detail.value;
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
					value={draft.pulse.coilInformation.inputPower}
					on:change={(e) => {
						draft.pulse.coilInformation.inputPower = e.detail.value;
						refresh();
					}}
					disabled={inputPowerToggle}
				/>
				<TextField
					label="Input Current"
					value={draft.pulse.coilInformation.inputCurrent}
					on:change={(e) => {
						draft.pulse.coilInformation.inputCurrent = e.detail.value;
						refresh();
					}}
					disabled={inputPowerToggle}
				/>
				<TextField
					label="Input Voltage"
					value={draft.pulse.coilInformation.inputVoltage}
					on:change={(e) => {
						draft.pulse.coilInformation.inputVoltage = e.detail.value;
						refresh();
					}}
					disabled={inputPowerToggle}
				/>

				<h3 class="col-span-3 font-bold mt-4">Coolant Information</h3>
				<SelectField
					options={coolantTypeOptions}
					label="Coolant Type"
					value={draft.pulse.coolantInformation.coolantType}
					autoplacement={false}
					on:change={(e) => {
						draft.pulse.coolantInformation.coolantType = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Target Coolant Flow"
					value={draft.pulse.coolantInformation.coolantFlow.setpoint}
					on:change={(e) => {
						draft.pulse.coolantInformation.coolantFlow.setpoint = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Target Coolant Temperature"
					value={draft.pulse.coolantInformation.coolantTemperature.setpoint}
					on:change={(e) => {
						draft.pulse.coolantInformation.setpoint = e.detail.value;
						refresh();
					}}
				/>
			</div>

			<div class="flex justify-between mt-4 relative">
				<div class="flex gap-2">
					{#if !isCompletingPulse}
						<Button variant="outline" color="success" on:click={handleCompletePulse}>Complete Pulse</Button>
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
		overflow: hidden;
	}

	:global(.pulseInputDialog) {
		max-height: 90vh;
	}

	:global(.styled-table) {
		width: 100%;
		border-collapse: collapse;
	}

	:global(.styled-table th) {
		background-color: #2563eb;
		color: white;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.75rem 1.5rem;
		text-align: left;
	}

	:global(.styled-table td) {
		padding: 1rem 1.5rem;
		color: #1f2937;
	}

	:global(.styled-table tr:nth-child(even)) {
		background-color: #f9fafb;
	}

	:global(.styled-table tr:hover) {
		background-color: #f3f4f6;
	}
</style>
