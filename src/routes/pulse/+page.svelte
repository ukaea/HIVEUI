<script lang="ts">
	import { onMount } from 'svelte';
	import { writable, type Writable } from 'svelte/store';
	import { Button, ExpansionPanel, Field, Input } from 'svelte-ux';
	import { mdiPlus, mdiTrashCan } from '@mdi/js';
	import { v4 as uuidv4 } from 'uuid';
	import { PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';

	class HivePulse {
		pulseID: string;
		firstOperator: Person;
		secondOperator: Person;
		pulseStart: string;
		pulseDuration: string;
		dataCaptureStart: string;
		pulseQuality: string; // PulseQuality type
		coilInformation: CoilInformation;
		coolantInformation: CoolantInformation;
		operatorComment?: string;

		constructor() {
			this.pulseID = '';
			this.firstOperator = new Person();
			this.secondOperator = new Person();
			this.pulseStart = '';
			this.pulseDuration = '';
			this.dataCaptureStart = '';
			this.pulseQuality = '';
			this.coilInformation = new CoilInformation();
			this.coolantInformation = new CoolantInformation();
			this.operatorComment = '';
		}
	}

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

	class CoolantInformation {
		coolantType: string; // CoolantType
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

	class CoilInformation {
		currentType: string; // CurrentType
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

	class SaveMetadata {
		targetPath: string;
		metadata: HivePulse;

		constructor() {
			this.targetPath = '';
			this.metadata = new HivePulse();
		}
	}

	const fullMetadata = writable<HivePulse>(new HivePulse());

	let currentSaveLocation: string = PUBLIC_ROOT_FOLDER_LOCATION + '/EXP_01' + '/hive_metadata.json';

	let currentMetadata: HivePulse;
	fullMetadata.subscribe((value) => {
		currentMetadata = value;
	});

	onMount(() => {});

	function resetForm() {
		fullMetadata.set(new HivePulse());
		currentSaveLocation = `${PUBLIC_ROOT_FOLDER_LOCATION}/EXP_01/hive_metadata.json`;
	}

	async function handleSubmit() {
		try {
			let saveMetadata: SaveMetadata = {
				targetPath: currentSaveLocation,
				metadata: currentMetadata
			};

			const response = await fetch('/api/save-json', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(saveMetadata)
			});

			if (response.ok) {
				alert('Metadata saved successfully!');
			} else {
				const errorData = await response.json();
				alert(`Error saving metadata: ${errorData.message}`);
			}
		} catch (error) {
			console.error('Error:', error);
			alert('An error occurred while saving the metadata.');
		}
	}

	function exportForm() {
		const blob = new Blob([JSON.stringify(currentMetadata, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		const date = new Date();
		const filename = `hive_metadata_${date.toISOString().replace(/[:T]/g, '-').slice(0, -5)}.json`;
		a.download = filename;

		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);

		URL.revokeObjectURL(url);
	}
</script>

<div class="flex flex-col items-center justify-start min-h-screen bg-neutral p-4 w-full">
	<div class="w-full max-w-screen-xl">
		<ExpansionPanel>
			<div slot="trigger" class="flex-1 p-3">Pulse Information</div>
			<div class="p-4 flex flex-col space-y-4">
				<Field label="Pulse ID">
					<Input placeholder="Pulse identifier" bind:value={currentMetadata.pulseID} />
				</Field>
				<Field label="Operator 1 first name">
					<Input placeholder="First name" bind:value={currentMetadata.firstOperator.firstName} />
				</Field>
				<Field label="Operator 1 last name">
					<Input placeholder="Last name" bind:value={currentMetadata.firstOperator.lastName} />
				</Field>
				<Field label="Operator 1 email">
					<Input placeholder="Operator 1 email" bind:value={currentMetadata.firstOperator.email} />
				</Field>
				<Field label="Operator 2 first name">
					<Input placeholder="First name" bind:value={currentMetadata.secondOperator.firstName} />
				</Field>
				<Field label="Operator 2 last name">
					<Input placeholder="Last name" bind:value={currentMetadata.secondOperator.lastName} />
				</Field>
				<Field label="Operator 2 email">
					<Input placeholder="Operator 2 email" bind:value={currentMetadata.secondOperator.email} />
				</Field>
				<Field label="Pulse Start">
					<Input type="datetime-local" bind:value={currentMetadata.pulseStart} />
				</Field>
				<Field label="Pulse Duration">
					<Input type="number" placeholder="Duration" bind:value={currentMetadata.pulseDuration} />
				</Field>
				<Field label="Data Capture Start">
					<Input type="datetime-local" bind:value={currentMetadata.dataCaptureStart} />
				</Field>
				<Field label="Operator Comment">
					<Input placeholder="Operator comment" bind:value={currentMetadata.operatorComment} />
				</Field>
				<Field label="Pulse Quality">
					<Input placeholder="Success / Fail" bind:value={currentMetadata.pulseQuality} />
				</Field>
				<div class="col-span-2">
					<ExpansionPanel>
						<div slot="trigger" class="flex-1 p-3">Coil Information</div>
						<div class="p-4 grid grid-cols-2 gap-4">
							<Field label="Current Type">
								<Input placeholder="AC / DC" bind:value={currentMetadata.coilInformation.currentType} />
							</Field>
							<Field label="Input Power">
								<Input type="number" bind:value={currentMetadata.coilInformation.inputPower} />
							</Field>
							<Field label="Input Current">
								<Input type="number" bind:value={currentMetadata.coilInformation.inputCurrent} />
							</Field>
							<Field label="Input Voltage">
								<Input type="number" bind:value={currentMetadata.coilInformation.inputVoltage} />
							</Field>
							<Field label="Output Frequency">
								<Input type="number" bind:value={currentMetadata.coilInformation.outputFrequency} />
							</Field>
							<Field label="Output Power">
								<Input type="number" bind:value={currentMetadata.coilInformation.outputPower} />
							</Field>
							<Field label="Output Current">
								<Input type="number" bind:value={currentMetadata.coilInformation.outputCurrent} />
							</Field>
							<Field label="Output Voltage">
								<Input type="number" bind:value={currentMetadata.coilInformation.outputVoltage} />
							</Field>
						</div>
					</ExpansionPanel>
					<ExpansionPanel>
						<div slot="trigger" class="flex-1 p-3">Coolant Information</div>
						<div class="p-4 grid grid-cols-2 gap-4">
							<Field label="Coolant Type">
								<Input placeholder="Water / Demineralised Water / Treated Water" bind:value={currentMetadata.coolantInformation.coolantType} />
							</Field>
							<Field label="Coolant Flow Rate">
								<Input placeholder="High / Low" bind:value={currentMetadata.coolantInformation.coolantFlow.rate} />
							</Field>
							<Field label="Coolant Flow Setpoint">
								<Input type="number" bind:value={currentMetadata.coolantInformation.coolantFlow.setpoint} />
							</Field>
							<Field label="Coolant Flow Value">
								<Input type="number" bind:value={currentMetadata.coolantInformation.coolantFlow.value} />
							</Field>
							<Field label="Coolant Flow Variance">
								<Input type="number" bind:value={currentMetadata.coolantInformation.coolantFlow.variance} />
							</Field>
							<Field label="Coolant Temperature Setpoint">
								<Input type="number" bind:value={currentMetadata.coolantInformation.coolantTemperature.setpoint} />
							</Field>
							<Field label="Coolant Temperature In">
								<Input type="number" bind:value={currentMetadata.coolantInformation.coolantTemperature.in} />
							</Field>
							<Field label="Coolant Temperature In Variance">
								<Input type="number" bind:value={currentMetadata.coolantInformation.coolantTemperature.inVariance} />
							</Field>
							<Field label="Coolant Temperature Out">
								<Input type="number" bind:value={currentMetadata.coolantInformation.coolantTemperature.out} />
							</Field>
							<Field label="Coolant Temperature Out Variance">
								<Input type="number" bind:value={currentMetadata.coolantInformation.coolantTemperature.outVariance} />
							</Field>
							<Field label="Coolant Temperature Delta">
								<Input type="number" bind:value={currentMetadata.coolantInformation.coolantTemperature.delta} />
							</Field>
							<Field label="Coolant Pressure In">
								<Input type="number" bind:value={currentMetadata.coolantInformation.coolantPressure.in} />
							</Field>
							<Field label="Coolant Pressure Out">
								<Input type="number" bind:value={currentMetadata.coolantInformation.coolantPressure.out} />
							</Field>
							<Field label="Coolant Pressure Delta">
								<Input type="number" bind:value={currentMetadata.coolantInformation.coolantPressure.delta} />
							</Field>
						</div>
					</ExpansionPanel>
				</div>
			</div>
		</ExpansionPanel>
	</div>
	<div class="button-group w-full max-w-screen-xl">
		<div class="left-buttons">
			<button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" on:click={exportForm}>Download</button>
		</div>
		<div class="right-buttons">
			<button class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600" on:click={resetForm}>Reset</button>
			<button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" on:click={handleSubmit}>Submit</button>
		</div>
	</div>
</div>

<style>
	.button-center {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 10px;
	}

	.button-group {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 10px;
	}

	.right-buttons {
		display: flex;
		gap: 10px;
	}
</style>
