<script lang="ts">
	import { onMount } from 'svelte';
	import { writable, type Writable } from 'svelte/store';
	import { Button, ExpansionPanel, Field, Input } from 'svelte-ux';
	import { mdiPlus, mdiTrashCan } from '@mdi/js';
	import { v4 as uuidv4 } from 'uuid';
	import { PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';

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

	class ExperimentMetadata {
		campaignID: string;
		experimentID: string;
		leadInvestigator: Person;
		customer: string;
		experimentStart: string;
		experimentEnd: string;
		experimentType: string;
		sampleCooling: string;
		constructor() {
			this.campaignID = '';
			this.experimentID = '';
			this.leadInvestigator = new Person();
			this.customer = '';
			this.experimentStart = '';
			this.experimentEnd = '';
			this.experimentType = '';
			this.sampleCooling = '';
		}
	}

	class SaveMetadata {
		targetPath: string;
		metadata: ExperimentMetadata;

		constructor() {
			this.targetPath = '';
			this.metadata = new ExperimentMetadata();
		}
	}

	const fullMetadata = writable<ExperimentMetadata>(new ExperimentMetadata());

	let baseSaveLocation: string = PUBLIC_ROOT_FOLDER_LOCATION + '/KeyChallenge4' + '/EXP_01' + '/hive_experiment.json';
	let currentSaveLocation: string = baseSaveLocation;

	let currentMetadata: ExperimentMetadata;
	fullMetadata.subscribe((value) => {
		currentMetadata = value;
	});

	function updateSavePath() {
		currentSaveLocation = PUBLIC_ROOT_FOLDER_LOCATION + '/' + currentMetadata.campaignID + '/EXP_' + currentMetadata.experimentID + '/hive_experiment.json';
	}

	onMount(() => {});

	function resetForm() {
		fullMetadata.set(new ExperimentMetadata());
		currentSaveLocation = baseSaveLocation;
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
		const filename = `hive_experiment_${date.toISOString().replace(/[:T]/g, '-').slice(0, -5)}.json`;
		a.download = filename;

		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);

		URL.revokeObjectURL(url);
	}
</script>

<div class="flex flex-col items-center justify-start min-h-screen bg-neutral p-4 w-full">
	<div class="w-full max-w-screen-xl">
		<ExpansionPanel open={true} class="hivepanel">
			<div slot="trigger" class="flex-1 p-3">Experiment</div>
			<div class="p-4 grid grid-cols-2 gap-4">
				<Field label="Campaign ID">
					<Input placeholder="Campaign identifier" bind:value={currentMetadata.campaignID} on:change={() => updateSavePath()} />
				</Field>
				<Field label="Experiment ID">
					<Input placeholder="Experiment identifier" bind:value={currentMetadata.experimentID} on:change={() => updateSavePath()} />
				</Field>
				<Field label="Lead Investigator First Name">
					<Input placeholder="First name" bind:value={currentMetadata.leadInvestigator.firstName} />
				</Field>
				<Field label="Lead Investigator Last Name">
					<Input placeholder="Last name" bind:value={currentMetadata.leadInvestigator.lastName} />
				</Field>
				<Field label="Lead Investigator Email">
					<Input placeholder="Lead investigator email" bind:value={currentMetadata.leadInvestigator.email} />
				</Field>
				<Field label="Customer">
					<Input placeholder="Customer name" bind:value={currentMetadata.customer} />
				</Field>
				<Field label="Experiment Start">
					<Input type="datetime-local" bind:value={currentMetadata.experimentStart} />
				</Field>
				<Field label="Experiment End">
					<Input type="datetime-local" bind:value={currentMetadata.experimentEnd} />
				</Field>
				<Field label="Experiment Type">
					<Input placeholder="Induction / DC" bind:value={currentMetadata.experimentType} />
				</Field>
				<Field label="Sample Cooling">
					<Input placeholder="True / False" bind:value={currentMetadata.sampleCooling} />
				</Field>
			</div>
			<div>
				<Field label="Save Location">
					<Input placeholder="Save location" bind:value={currentSaveLocation} />
				</Field>
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
