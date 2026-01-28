<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, DateField } from 'svelte-ux';
	import { tableOrderStore, SelectField, type MenuOption, Notification } from 'svelte-ux';
	import { mdiCheck, mdiWindowClose, mdiCheckCircleOutline } from '@mdi/js';
	import { CompiledPulseMetadata, ExperimentMetadata, ConfigurationMetadata } from '$lib/models';
	import { triggerDAG } from '$lib/triggerPipeline';
	import { env } from '$env/dynamic/public';
	import { GenericDataService } from '$lib/services/GenericDataService';
	import { PulseDataService } from '$lib/services/PulseDataService';
	import { ExperimentMetadataModel } from '$lib/models/ExperimentMetadata';

	let allPulses: CompiledPulseMetadata[] = [];
	let allExperiments: ExperimentMetadata[] = [];
	let allConfigurations: ConfigurationMetadata[] = [];
	let selectedMetadata: CompiledPulseMetadata | null = null;
	let sortedPostProcessData: CompiledPulseMetadata | null = null;

	let open = false;
	let isNewEntry = false;
	let isCompletingPulse = false;
	let saveNotify = false;
	let completeNotify = false;
	let inputPowerToggle = true;

	const order = tableOrderStore({ initialBy: 'pulseNumber', initialDirection: 'asc' });

	order.subscribe(() => {
		allPulses = allPulses.sort($order.handler);
	});

	// Services
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

	const pulseService = new PulseDataService<CompiledPulseMetadata>({
		modelClass: CompiledPulseMetadata,
		endpoint: '/local/HIVE/',
		displayName: 'pulse',
		idField: "pulseNumber",
		experimentField: "experimentNumber",
		sampleField: "sampleNumber",
		isPulse: true
	});

	// Fetch functions
	async function fetchPulses() {
		try {
			allPulses = await pulseService.fetchAll($order.handler);
		} catch (error) {
			console.error('Error fetching pulses:', error);
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

	// Handler functions
	async function handleMetadataSubmit() {
		if (!selectedMetadata) {
			alert('No metadata selected.');
			return;
		}

		try {

			//Validate against zod schema
			const parseResult = CompiledPulseMetadata.schema.safeParse(selectedMetadata)
			if (!parseResult.success) {
				console.error('Validation errors:', parseResult.error.errors);
				return;
			}

			await pulseService.submitPulse(selectedMetadata);
			alert(isNewEntry ? 'New pulse submitted successfully!' : 'Pulse updated successfully!');
			handleModalClose();
			await fetchPulses();
		} catch (error) {
			console.error('Submission error:', error);
			alert(`Failed to submit pulse: ${(error as Error).message}`);
		}
	}

	async function handlePostProcess() {
		if (!selectedMetadata) {
			alert('No metadata selected.');
			return;
		}

		try {
			//Validate against zod schema
			const parseResult = CompiledPulseMetadata.schema.safeParse(selectedMetadata)
			if (!parseResult.success) {
				console.error('Validation errors:', parseResult.error.errors);
				return;
			}
			await pulseService.executePostprocess(selectedMetadata)
			alert(isNewEntry ? 'New pulse submitted successfully!' : 'Pulse updated successfully!');

			sortedPostProcessData = await pulseService.fetchProcessedData(selectedMetadata.processPath)

			saveNotify = true;
			setTimeout(() => {
				saveNotify = false;
			}, 3000);

			await fetchPulses();
		} catch (error) {
			console.error('Error executing post processing:', error);
			alert(`Post processing failed: ${(error as Error).message}`);
		}
	}

	async function handleTrigger() {
		const { result, error } = await triggerDAG(env.PUBLIC_AIRFLOW_DIRECTORY, env.PUBLIC_AIRFLOW_INPUT_FILE);
		if (error) {
			console.error('Error triggering DAG:', error);
		}
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

		try {
			await pulseService.submitPulse(selectedMetadata);
			await handleFlagFile(selectedMetadata);

			completeNotify = true;
			setTimeout(() => {
				completeNotify = false;
			}, 3000);

			await fetchPulses();
			await handleTrigger();
		} catch (error) {
			console.error('Error completing pulse:', error);
			alert(`Failed to complete pulse: ${(error as Error).message}`);
		}
	}

	async function handleFlagFile(metadata: CompiledPulseMetadata) {
		try {
			const filePath = `${env.PUBLIC_ROOT_FOLDER_LOCATION}`;
			const fileName = `currentPulse.json`;

			const flagData = {
				pulseNumber: metadata.pulseNumber,
				pulseLocation: `HIVE/E-${metadata.experimentNumber}/S-${metadata.sampleNumber}/P-${metadata.pulseNumber}`,
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
				throw new Error(`Failed to save flag file: ${errorData.message}`);
			}
		} catch (error) {
			console.error('Error saving flag file:', error);
			throw error;
		}
	}

	async function handleDelete() {
		if (!selectedMetadata) return;

		if (confirm(`Are you sure you want to delete pulse ${selectedMetadata.pulseNumber}?`)) {
			try {
				await pulseService.delete(selectedMetadata);
				alert('Pulse deleted successfully');
				handleModalClose();
				await fetchPulses();
			} catch (error) {
				console.error('Delete error:', error);
				alert(`Failed to delete pulse: ${(error as Error).message}`);
			}
		}
	}

	async function handleRowClick(row: CompiledPulseMetadata): void {
		selectedMetadata = { ...row };
		isNewEntry = false;
		open = true;

		if (selectedMetadata.processPath) {
			try {
				sortedPostProcessData = await pulseService.fetchProcessedData(selectedMetadata.processPath);
			} catch (err) {
				console.error("Failed to fetch processed data", err);
			}
		} else {
			sortedPostProcessData = null;
		}
	}

	function handleNewEntry(): void {
		selectedMetadata = { ...new CompiledPulseMetadata() };
		isNewEntry = true;
		sortedPostProcessData = null;
		open = true;
	}

	function handleModalClose() {
		open = false;
		selectedMetadata = null;
		isNewEntry = false;
		sortedPostProcessData = null;
		isCompletingPulse = false;
	}

	function handleFormCancel() {
		handleModalClose();
	}

	onMount(() => {
		fetchPulses();
		fetchExperiments();
		fetchConfigurations();
	});

	// Form options
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
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<div class="mb-4 flex justify-between items-center">
		<h2 class="text-2xl font-bold">Pulse Metadata</h2>
		<Button on:click={handleNewEntry} variant="fill">New Pulse</Button>
	</div>
	<div class="table-container">
		<Table
			data={allPulses}
			columns={[
				{ name: 'pulseNumber', align: 'left', header: 'Pulse Number' },
				{ name: 'experimentNumber', align: 'left', header: 'Experiment Number' },
				{ name: 'configurationId', align: 'left', header: 'Configuration Id' },
				{
					name: 'pulseStart',
					align: 'left',
					header: 'Pulse Start',
					// @ts-expect-error
					format: (value) => {
						if (!value) return '';
						const date = new Date(value);
						return (
							date.toLocaleDateString('en-GB', {
								day: '2-digit',
								month: '2-digit',
								year: 'numeric'
							}) +
							' (' +
							date.toLocaleTimeString('en-GB', {
								hour: '2-digit',
								minute: '2-digit'
							}) +
							')'
						);
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
		</div>
	</div>
	<div class="p-4">
		<Form initial={selectedMetadata} schema={CompiledPulseMetadata.schema} let:draft let:refresh let:current let:revertAll let:errors>
			<div class="p-4 grid grid-cols-3 gap-4">
				<h3 class="col-span-3 font-bold mt-4">Pulse Information</h3>
				<SelectField
					options={experimentOptions}
					label="Experiment Number"
					value={draft.experimentNumber}
					disabled={!isNewEntry}
					autoplacement={false}
					on:change={(e) => {
						draft.experimentNumber = e.detail.value;
						refresh();
					}}
					error={errors.experimentNumber}
				/>
				<TextField
					label="Sample Number"
					type="integer"
					disabled={!isNewEntry}
					value={draft.sampleNumber}
					on:change={(e) => {
						draft.sampleNumber = e.detail.value;
						refresh();
					}}
					error={errors.sampleNumber}
				/>
				<TextField
					label="Pulse Number"
					value={draft.pulseNumber}
					type="integer"
					disabled={!isNewEntry}
					on:change={(e) => {
						draft.pulseNumber = e.detail.value;
						refresh();
					}}
					error={errors.pulseNumber}
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
					on:change={(e) => {
						draft.operator1.firstName = e.detail.value;
						refresh();
					}}
					error={errors.operator1?.firstName}
				/>
				<TextField
					label="Last Name"
					value={draft.operator1.lastName}
					on:change={(e) => {
						draft.operator1.lastName = e.detail.value;
						refresh();
					}}
					error={errors.operator1?.lastName}
				/>
				<TextField
					label="Email"
					value={draft.operator1.email}
					on:change={(e) => {
						draft.operator1.email = e.detail.value;
						refresh();
					}}
					error={errors.operator1?.email}
				/>

				<h3 class="col-span-3 font-bold mt-4">Operator 2</h3>
				<TextField
					label="First Name"
					value={draft.operator2.firstName}
					on:change={(e) => {
						draft.operator2.firstName = e.detail.value;
						refresh();
					}}
					error={errors.operator2?.firstName}
				/>
				<TextField
					label="Last Name"
					value={draft.operator2.lastName}
					on:change={(e) => {
						draft.operator2.lastName = e.detail.value;
						refresh();
					}}
					error={errors.operator2?.lastName}
				/>
				<TextField
					label="Email"
					value={draft.operator2.email}
					on:change={(e) => {
						draft.operator2.email = e.detail.value;
						refresh();
					}}
					error={errors.operator2?.email}
				/>

				<h3 class="col-span-3 font-bold mt-4">Heating Information</h3>
				<SelectField
					options={coilHeatingTypeOptions}
					label="Heating Type"
					value={draft.heatingInformation.heatingType}
					autoplacement={false}
					on:change={(e) => {
						draft.heatingInformation.heatingType = e.detail.value;
						refresh();
					}}
					error={errors.heatingInformation?.heatingType}
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
					error={errors.heatingInformation?.currentType}
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
					error={errors.heatingInformation?.inputPower}
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
					error={errors.heatingInformation?.inputCurrent}
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
					error={errors.heatingInformation?.inputVoltage}
				/>
				<TextField
					label="Output Current"
					value={draft.heatingInformation.outputCurrent}
					type="integer"
					on:change={(e) => {
						draft.heatingInformation.outputCurrent = e.detail.value;
						refresh();
					}}
					error={errors.heatingInformation?.outputCurrent}
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
					on:change={(e) => {
						draft.coolantInformation.coolantType = e.detail.value;
						refresh();
					}}
					error={errors.coolantInformation?.coolantType}
				/>
				<TextField
					label="Target Coolant Flow"
					value={draft.coolantInformation.targetCoolantFlow}
					type="integer"
					on:change={(e) => {
						draft.coolantInformation.targetCoolantFlow = e.detail.value;
						refresh();
					}}
					error={errors.coolantInformation?.targetCoolantFlow}
				/>
				<TextField
					label="Target Coolant Temperature"
					value={draft.coolantInformation.targetCoolantTemperature}
					type="integer"
					on:change={(e) => {
						draft.coolantInformation.targetCoolantTemperature = e.detail.value;
						refresh();
					}}
					error={errors.coolantInformation?.targetCoolantTemperature}
				/>
				<TextField
					label="Measured Coolant Flow"
					value={draft.coolantInformation.measuredCoolantFlow}
					type="integer"
					on:change={(e) => {
						draft.coolantInformation.measuredCoolantFlow = e.detail.value;
						refresh();
					}}
					error={errors.coolantInformation?.measuredCoolantFlow}
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
					<Button
						type="submit"
						variant="fill"
						on:click={() => {
							selectedMetadata = current;
							handleMetadataSubmit();
						}}>Save</Button
					>
					<Button variant="fill" on:click={() => {
								selectedMetadata = current; 
								handlePostProcess(); }}>Pulse Completed</Button>
					<Button
						on:click={() => {
							revertAll();
							handleFormCancel();
						}}>Cancel</Button
					>
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
