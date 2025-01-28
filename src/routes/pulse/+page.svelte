<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField} from 'svelte-ux';
	import { tableOrderStore, SelectField, type MenuOption, Notification } from 'svelte-ux';
	import { page } from '$app/stores';
	import { PUBLIC_METACAT_URL, PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';
	import {mdiCheck, mdiWindowClose, mdiCheckCircleOutline } from '@mdi/js';

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
		pulseStart: string;
		pulseDuration: string;
		dataCaptureStart: string;
		operatorComment: string;
		pulseQuality: string;
		coilInformation: CoilInformation;
		coolantInformation: CoolantInformation;
		constructor() {
			this.pulseID = '';
			this.firstOperator = new Person();
			this.secondOperator = new Person();
			this.pulseStart = '';
			this.pulseDuration = '';
			this.dataCaptureStart = '';
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

	class DiagnosticSelectMetadata {
		diagnosticSetupID: string;
		constructor() {
			this.diagnosticSetupID = '';
		}
	}

	// Includes the experiment and diagnostics
	class CompiledPulseMetadata {
		pulse: PulseMetadata;
		experimentID: string;
		diagnosticSetupID: string;
		status: string;
		constructor() {
			this.pulse = new PulseMetadata();
			this.experimentID = '';
			this.diagnosticSetupID = '';
			this.status = '';
		}
	}

	let sortedData: CompiledPulseMetadata[] = [];
	let sortedExperiments: ExperimentSelectMetadata[] = [];
	let sortedDiagnostics: DiagnosticSelectMetadata[] = [];

	const order = tableOrderStore({ initialBy: 'pulse.pulseID', initialDirection: 'asc' });
	let open = false;
	let selectedMetadata: CompiledPulseMetadata | null = null;
	let isNewEntry = false;

	function mapToPulse(apiResponse: any): CompiledPulseMetadata {
		const metadata = new CompiledPulseMetadata();
		// Assume all fields are valid
		return Object.assign(metadata, apiResponse);
	}

	function mapToExperiment(apiResponse: any): ExperimentSelectMetadata {
		const metadata = new ExperimentSelectMetadata();
		// Assume all fields are valid
		return Object.assign(metadata, apiResponse);
	}

	function mapToDiagnosticSetup(apiResponse: any): DiagnosticSelectMetadata {
		const metadata = new DiagnosticSelectMetadata();
		// Assume all fields are valid
		return Object.assign(metadata, apiResponse);
	}

	async function fetchExperiments() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}
			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/proposals?filter=%7B%7D`, {
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});
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

	async function getJsonFiles(directory: string) {
		try {
			const response = await fetch(`/api/get-json-list?path=${encodeURIComponent(directory)}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch file list: ${response.statusText}`);
			}

			const data = await response.json();
			if (!data.success) {
				throw new Error(data.message || 'Failed to fetch file list');
			}

			return data.files;
		} catch (error) {
			console.error('Error fetching file list:', error);
			throw error;
		}
	}

	async function getJsonContent(filename: string) {
		try {
			const response = await fetch(`/api/get-json?filename=${encodeURIComponent(filename)}`);
			if (!response.ok) {
				throw new Error(`Failed to fetch file content: ${response.statusText}`);
			}

			const data = await response.json();
			if (!data.success) {
				throw new Error(data.message || 'Failed to fetch file content');
			}

			return data.data;
		} catch (error) {
			console.error('Error fetching file content:', error);
			throw error;
		}
	}

	async function fetchDiagnosticSetups() {
		try {
			const files = await getJsonFiles('diagnosticsetups');
			const diagnosticSetups = await Promise.all(files.map((filename: string) => getJsonContent('diagnosticsetups/' + filename)));

			// Map and sort the diagnostic setups
			sortedDiagnostics = diagnosticSetups.map(mapToDiagnosticSetup).sort($order.handler);

			diagnosticSetupOptions = sortedDiagnostics.map((diagnostic) => {
				return { label: diagnostic.diagnosticSetupID, value: diagnostic.diagnosticSetupID };
			});
		} catch (error) {
			console.error('Error fetching diagnostic setups:', error);
			alert('Failed to load diagnostic setups. Please try again later.');
		}
	}

	async function fetchPulses() {
		try {
			const pulseFiles = await getJsonFiles('pulses');
			const pulseData = await Promise.all(pulseFiles.map((filename: string) => getJsonContent('pulses/' + filename)));

			sortedData = pulseData.map(mapToPulse).sort($order.handler);
		} catch (error) {
			console.error('Error fetching pulses:', error);
			alert('Failed to load pulses. Please try again later.');
		}
	}

	async function handleMetadataSubmit(event: CustomEvent<CompiledPulseMetadata>) {
		const metadata = event.detail;

		try {
			await handlePulseFileSubmission(metadata);
			console.log('Metadata file saved successfully');
			saveNotify = true;
			
			setTimeout(() => {
				saveNotify = false;
			}, 3000);

			await fetchPulses();
		} catch (error) {
			console.error('File submission failed:', error);
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
				'pulseID': metadata.pulse.pulseID,
				'pulseLocation': `pulses/${metadata.pulse.pulseID}.json`,
				'pulseStatus': metadata.status,
				'experimentID': metadata.experimentID,
				'diagnosticSetupID': metadata.diagnosticSetupID
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

	onMount(() => {
		fetchPulses();
		fetchExperiments();
		fetchDiagnosticSetups();
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

	let diagnosticSetupOptions: MenuOption[] = [];

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
				{ name: 'pulse.pulseStart', align: 'left', header: 'Pulse Start' },
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
			<div class="absolute right-20 top-0 z-10">
			</div>
		</div>	
	</div>
	<div class="p-4">
		<Form initial={selectedMetadata} on:change={handleMetadataSubmit} let:commit let:draft let:refresh>
			<div class="p-4 grid grid-cols-3 gap-4">
				<h3 class="col-span-3 font-bold mt-4">Pulse Information</h3>
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
					options={diagnosticSetupOptions}
					label="Diagnostic Setup"
					value={draft.diagnosticSetupID}
					autoplacement={false}
					on:change={(e) => {
						draft.diagnosticSetupID = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Pulse ID"
					value={draft.pulse.pulseID}
					on:change={(e) => {
						draft.pulse.pulseID = e.detail.value;
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
				{#if !isCompletingPulse}
					<Button variant="outline" color="success" on:click={handleCompletePulse}>Complete Pulse</Button>
				{:else}
					<div class="flex gap-2">
						<Button variant="outline" color="success" on:click={handleConfirmComplete} icon={mdiCheck}>Confirm</Button>
						<Button variant="outline" color="danger" on:click={handleCancelComplete} icon={mdiWindowClose}>Cancel</Button>
					</div>
				{/if}
			 
				<div class="absolute left-1/2 -translate-x-1/2 -top-3 z-10">
					<Notification title="Successfully Saved!" icon={mdiCheckCircleOutline} color="success" closeIcon open={saveNotify} />
					<Notification title="Successfully Completed!" icon={mdiCheckCircleOutline} color="success" closeIcon open={completeNotify} />					
				</div>
				
				<div class="flex gap-2">
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
