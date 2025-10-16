<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, DateField, Drawer, MenuItem, sort, format, Logger } from 'svelte-ux';
	import { tableOrderStore, SelectField, Toggle, delay, cls, type MenuOption } from 'svelte-ux';
	import { page } from '$app/stores';
	import { PUBLIC_LOCAL_ONLY} from '$env/static/public';
	import { ExperimentMetadata, HeatingTypeMetadata, PersonMetadata, CustomerMetadata, ConfigurationMetadata } from '$lib/models';
	import { GenericDataService } from '$lib/services/GenericDataService';
	import { ExperimentMetadataModel } from '$lib/models/ExperimentMetadata';

	let allExperiments: ExperimentMetadata[] = [];
	let allConfigurations: ConfigurationMetadata[] = [];
	let selectedExperiment: ExperimentMetadata | null = null;

	let open = false;
	let isNewEntry = false;
	let localOnly = false;
	
	const experimentOrder = tableOrderStore({ initialBy: 'experimentTitle', initialDirection: 'asc' });
	const configurationOrder = tableOrderStore({ initialBy: 'configurationName', initialDirection: 'asc' });

	experimentOrder.subscribe(() => {
		allExperiments = allExperiments.sort($experimentOrder.handler);
	});

	configurationOrder.subscribe(() => {
		allConfigurations = allConfigurations.sort($configurationOrder.handler);
	});

	const heatingTypeOptions: MenuOption[] = Object.values(HeatingTypeMetadata).map((type) => ({
		label: type,
		value: type
	}));

	const experimentService = new GenericDataService<ExperimentMetadata>(
		{
			modelClass: ExperimentMetadataModel,
			endpoint: '/api/v1/experiments',
			localFolder: 'experiments',
			idField: 'experimentUUID',
			displayName: 'experiments'
		}
	);

	const configurationService = new GenericDataService<ConfigurationMetadata>(
		{
			modelClass: ConfigurationMetadata,
			endpoint: '/api/v1/configurations',
			localFolder: 'configurations',
			idField: 'configurationUUID',
			displayName: 'configurations'
		}
	);

	async function fetchConfigurations() {
		try {
			allConfigurations = await configurationService.fetchAll(
				localOnly,
				$page.data.session
			);
		} catch (error) {
			console.error('Error fetching configurations:', error);
			alert((error as Error).message);
		}
	}

	async function fetchExperiments() {
        try {
            allExperiments = await experimentService.fetchAll(
                localOnly,
                $page.data.session
            );
        } catch (error) {
            console.error('Error fetching experiments:', error);
            alert((error as Error).message);
        }
    }

	async function handleMetadataSubmit() {
        if (!selectedExperiment) {
            alert('No metadata selected.');
            return;
        }

        try {
            await experimentService.submit(
                selectedExperiment,
                localOnly,
                $page.data.session,
                isNewEntry
            );
            
            alert(isNewEntry 
                ? 'New experiment submitted successfully!' 
                : 'Experiment updated successfully!'
            );
            
            handleModalClose();
            await fetchExperiments();
        } catch (error) {
            console.error('Submission error:', error);
            alert(`Failed to submit experiment: ${(error as Error).message}`);
        }
    }

	async function handleDelete() {
        if (!selectedExperiment) return;

        if (confirm(`Are you sure you want to delete the experiment with UUID: ${selectedExperiment.experimentUUID}?`)) {
            try {
                await experimentService.delete(
                    selectedExperiment,
                    localOnly,
                    $page.data.session
                );
                
                alert('Experiment deleted successfully');
                handleModalClose();
                await fetchExperiments();
            } catch (error) {
                console.error('Delete error:', error);
                alert(`Failed to delete experiment: ${(error as Error).message}`);
            }
        }
    }

	function handleRowClick(row: ExperimentMetadata): void {
		selectedExperiment = { ...row };
		isNewEntry = false;
		open = true;
	}

	function handleNewEntry(): void {
		selectedExperiment = { ...new ExperimentMetadata() };
		isNewEntry = true;
		open = true;
	}

	function handleModalClose() {
		open = false;
		selectedExperiment = null;
		isNewEntry = false;
	}

	function handleFormCancel() {
		handleModalClose();
	}

	onMount(() => {
		if (PUBLIC_LOCAL_ONLY == 'true') {
			localOnly = true;
		}
		fetchExperiments();
		fetchConfigurations();
	});
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<div class="mb-4 flex justify-between items-center">
		<h2 class="text-2xl font-bold">Experiments</h2>
		<Button on:click={handleNewEntry} variant="fill">New Experiment</Button>
	</div>
	<div class="table-container">
		<Table
			data={allExperiments}
			columns={[
				{ name: 'experimentTitle', align: 'left', header: 'Experiment Title' },
				{ name: 'customer.organisation', align: 'left', header: 'Customer' },
				{ name: 'coilName', align: 'left', header: 'Coil Name' },
				{ name: 'leadInvestigator.email', align: 'left', header: 'Lead Investigator' },
				{ name: 'heatingType', align: 'left', header: 'Heating Type' },
				{
					name: 'experimentStart',
					align: 'left',
					header: 'Start Date',
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
				}
			]}
			order={experimentOrder}
			on:cellClick={(e) => handleRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>
</div>

<Dialog {open} on:close={handleModalClose} class="experimentInputDialog">
	<div slot="title">{isNewEntry ? 'Create New Experiment' : 'Edit Experiment Metadata'}</div>
	<div class="p-4">
		<Form initial={selectedExperiment} let:draft let:refresh let:current let:revertAll>
			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1">Experiment Details</h4>
				<TextField
					label="Experiment Title"
					value={draft.experimentTitle}
					on:change={(e) => {
						draft.experimentTitle = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Experiment UUID"
					value={isNewEntry ? (draft.experimentUUID = crypto.randomUUID()) : draft.experimentUUID}
					on:change={(e) => {
						draft.experimentUUID = e.detail.value;
						refresh();
					}}
					disabled
				/>
				<TextField
					label="Coil Name"
					value={draft.coilName}
					on:change={(e) => {
						draft.coilName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Coil UUID"
					value={draft.coilUUID}
					on:change={(e) => {
						draft.coilUUID = e.detail.value;
						refresh();
					}}
				/>
				<DateField
					label="Experiment Start"
					format="dd/MM/yyyy"
					picker
					clearable
					value={draft.experimentStart}
					on:change={(e) => {
						draft.experimentStart = e.detail.value;
						refresh();
					}}
				/>
				<DateField
					label="Experiment End"
					format="dd/MM/yyyy"
					picker
					clearable
					value={draft.experimentEnd}
					on:change={(e) => {
						draft.experimentEnd = e.detail.value;
						refresh();
					}}
				/>
				<SelectField
					label="Heating Type"
					value={draft.heatingType}
					options={heatingTypeOptions}
					on:change={(e) => {
						draft.heatingType = e.detail.value;
						refresh();
					}}
				/>
				<SelectField
					label="Sample Cooling"
					value={draft.sampleCooling}
					options={[
						{ label: 'Enabled', value: true },
						{ label: 'Disabled', value: false }
					]}
					on:change={(e) => {
						draft.sampleCooling = e.detail.value;
						refresh();
					}}
				/>
			</div>

			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1">Lead Investigator</h4>
				<TextField
					label="First Name"
					value={draft.leadInvestigator.firstName}
					on:change={(e) => {
						draft.leadInvestigator.firstName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Last Name"
					value={draft.leadInvestigator.lastName}
					on:change={(e) => {
						draft.leadInvestigator.lastName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Email"
					value={draft.leadInvestigator.email}
					on:change={(e) => {
						draft.leadInvestigator.email = e.detail.value;
						refresh();
					}}
				/>
			</div>

			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1">Customer Information</h4>
				<div class="col-span-2">
					<TextField
						label="Organisation Name"
						value={draft.customer.organisation}
						on:change={(e) => {
							draft.customer.organisation = e.detail.value;
							refresh();
						}}
					/>
				</div>

				<TextField
					label="Contact First Name"
					value={draft.customer.contactPerson.firstName}
					on:change={(e) => {
						draft.customer.contactPerson.firstName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Contact Last Name"
					value={draft.customer.contactPerson.lastName}
					on:change={(e) => {
						draft.customer.contactPerson.lastName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Contact Email"
					value={draft.customer.contactPerson.email}
					on:change={(e) => {
						draft.customer.contactPerson.email = e.detail.value;
						refresh();
					}}
				/>
			</div>

			<div class="flex gap-2 mt-4 {!isNewEntry ? 'justify-between' : 'justify-end'}">
				{#if !isNewEntry}
					<div>
						<Button on:click={handleDelete} variant="outline" color="danger">Delete</Button>
					</div>
				{/if}
				<div class="flex gap-2">
					<Button
						on:click={() => {
							selectedExperiment = current;
							handleMetadataSubmit();
						}}
						variant="fill">Save</Button
					><Button
						on:click={() => {
							revertAll();
							handleFormCancel();
						}}
						style={{ marginLeft: 'auto' }}>Cancel</Button
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

	:global(.experimentInputDialog) {
		max-height: 90vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
</style>
