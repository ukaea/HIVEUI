<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, DateField } from 'svelte-ux';
	import { tableOrderStore, SelectField } from 'svelte-ux';
	import { page } from '$app/stores';
	import { env } from '$env/dynamic/public';
	import { ExperimentMetadata, PersonMetadata } from '$lib/models';
	import { GenericDataService } from '$lib/services/GenericDataService';
	import { ExperimentMetadataModel } from '$lib/models/ExperimentMetadata';
	import { MemberService } from '$lib/services/MembersService';

	let allExperiments: ExperimentMetadata[] = [];
	let selectedExperiment: ExperimentMetadata | null = null;
	let allMembers: PersonMetadata[] = [];

	let open = false;
	let isNewEntry = false;
	let localOnly = false;
	let isManualEdit = false;

	const experimentOrder = tableOrderStore({ initialBy: 'experimentNumber', initialDirection: 'asc' });

	experimentOrder.subscribe(() => {
		allExperiments = allExperiments.sort($experimentOrder.handler);
	});

	const experimentService = new GenericDataService<ExperimentMetadata>({
		modelClass: ExperimentMetadataModel,
		endpoint: '/local/experiments',
		idField: 'experimentNumber',
		displayName: 'experiments'
	});

	async function fetchExperiments() {
		try {
			allExperiments = await experimentService.fetchAll();
		} catch (error) {
			console.error('Error fetching experiments:', error);
			alert((error as Error).message);
		}
	}

	async function fetchMembers() {
		try {
			allMembers = await MemberService.getMembers('HIVE');
		} catch (error) {
			console.error('Error fetching members:', error);
			alert((error as Error).message);
		}
	}

	async function handleMetadataSubmit() {
		if (!selectedExperiment) {
			alert('No metadata selected.');
			return;
		}

		//Validate against zod schema
		const parseResult = ExperimentMetadata.schema.safeParse(selectedExperiment);
		if (!parseResult.success) {
			console.error('Validation errors:', parseResult.error.errors);
			return;
		}

		try {
			await experimentService.submit(selectedExperiment);
			alert(isNewEntry ? 'New experiment submitted successfully!' : 'Experiment updated successfully!');
			handleModalClose();
			await fetchExperiments();
		} catch (error) {
			console.error('Submission error:', error);
			alert(`Failed to submit experiment: ${(error as Error).message}`);
		}
	}

	async function handleDelete() {
		if (!selectedExperiment) return;

		if (confirm(`Are you sure you want to delete experiment ${selectedExperiment.experimentNumber}?`)) {
			try {
				await experimentService.delete(selectedExperiment);

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
		isManualEdit = true;
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
		isManualEdit = false;
	}

	function handleFormCancel() {
		handleModalClose();
	}

	onMount(() => {
		if (env.PUBLIC_LOCAL_ONLY == 'true') {
			localOnly = true;
		}
		fetchExperiments();
		fetchMembers();
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
				{ name: 'experimentNumber', align: 'left', header: 'Experiment Number' },
				{ name: 'description', align: 'left', header: 'Description' },
				{ name: 'customer.organisation', align: 'left', header: 'Customer' },
				{ name: 'leadInvestigator.lastName', align: 'left', header: 'Lead Investigator' },
				{
					name: 'startDate',
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
		<Form initial={selectedExperiment} schema={ExperimentMetadata.schema} let:draft let:refresh let:current let:revertAll let:errors>
			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1">Experiment Details</h4>
				<TextField
					label="Experiment Number"
					type="integer"
					value={draft.experimentNumber}
					on:change={(e) => {
						draft.experimentNumber = e.detail.value;
						refresh();
					}}
					error={errors.experimentNumber}
				/>
				<TextField
					label="Description"
					value={draft.description}
					on:change={(e) => {
						draft.description = e.detail.value;
						refresh();
					}}
					error={errors.description}
				/>
				<DateField
					label="Start Date"
					value={draft.startDate}
					format="dd/MM/yyyy"
					picker
					clearable
					on:change={(e) => {
						draft.startDate = e.detail.value;
						refresh();
					}}
					error={errors.startDate}
				/>
				<DateField
					label="End Date"
					value={draft.endDate}
					format="dd/MM/yyyy"
					picker
					clearable
					on:change={(e) => {
						draft.endDate = e.detail.value;
						refresh();
					}}
					error={errors.endDate}
				/>
			</div>

			<div class="p-4 grid grid-cols-2 gap-4">
				<h4 class="col-span-2 mt-1 flex items-center gap-3">
					<div>Lead Investigator</div>
					<div>
						<SelectField
							label="Select from Members"
							value={isManualEdit ? '' : current.leadInvestigator?.email}
							options={allMembers.map((member) => ({ label: `${member.firstName} ${member.lastName}`, value: member.email }))}
							on:change={(e) => {
								const selectedMember = allMembers.find((member) => member.email === e.detail.value);
								if (selectedMember) {
									draft.leadInvestigator = {
										firstName: selectedMember.firstName,
										lastName: selectedMember.lastName,
										email: selectedMember.email
									};
									isManualEdit = false;
									refresh();
								}
							}}
						/>
					</div>
				</h4>
				<TextField
					label="First Name"
					value={current.leadInvestigator?.firstName}
					on:change={(e) => {
						draft.leadInvestigator.firstName = e.detail.value;
						isManualEdit = true;
						refresh();
					}}
					error={errors.leadInvestigator?.firstName}
				/>
				<TextField
					label="Last Name"
					value={current.leadInvestigator?.lastName}
					on:change={(e) => {
						draft.leadInvestigator.lastName = e.detail.value;
						isManualEdit = true;
						refresh();
					}}
					error={errors.leadInvestigator?.lastName}
				/>
				<TextField
					label="Email"
					value={current.leadInvestigator?.email}
					on:change={(e) => {
						draft.leadInvestigator.email = e.detail.value;
						isManualEdit = true;
						refresh();
					}}
					error={errors.leadInvestigator?.email}
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
					error={errors.customer?.contactPerson?.firstName}
				/>
				<TextField
					label="Contact Last Name"
					value={draft.customer.contactPerson.lastName}
					on:change={(e) => {
						draft.customer.contactPerson.lastName = e.detail.value;
						refresh();
					}}
					error={errors.customer?.contactPerson?.lastName}
				/>
				<TextField
					label="Contact Email"
					value={draft.customer.contactPerson.email}
					on:change={(e) => {
						draft.customer.contactPerson.email = e.detail.value;
						refresh();
					}}
					error={errors.customer?.contactPerson?.email}
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
						type="submit"
						variant="fill"
						on:click={() => {
							selectedExperiment = current;
							handleMetadataSubmit();
						}}>Save</Button
					>
					<Button
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
