<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField } from 'svelte-ux';
	import { tableOrderStore } from '@layerstack/svelte-table';
	import { SampleMetadata } from '$lib/models';
	import { GenericDataService } from '$lib/services/GenericDataService';
	import { SampleMetadataModel } from '$lib/models/SampleMetadata';
	import { env } from '$env/dynamic/public';
	import { allowDigitsOnly } from '$lib/client/allowDigitsOnly';

	let allSamples: SampleMetadata[] = [];
	let selectedSample: SampleMetadata | null = null;

	let open = false;
	let isNewEntry = false;

	const sampleOrder = tableOrderStore({ initialBy: 'sampleNumber', initialDirection: 'asc' });

	sampleOrder.subscribe(() => {
		allSamples = allSamples.sort($sampleOrder.handler);
	});

	const sampleService = new GenericDataService<SampleMetadata>({
		modelClass: SampleMetadataModel,
		endpoint: env.PUBLIC_LOCAL_ONLY === 'true' ? '/local/samples' : '/remote/samples',
		idField: 'sampleNumber',
		displayName: 'samples'
	});

	async function fetchSamples() {
		try {
			allSamples = await sampleService.fetchAll();
		} catch (error) {
			console.error('Error fetching samples:', error);
			alert((error as Error).message);
		}
	}

	async function handleMetadataSubmit() {
		if (!selectedSample) {
			alert('No metadata selected.');
			return;
		}

		//Special fields for sample
		selectedSample.ownerGroup = "HIVE";
		selectedSample.accessGroups = ["HIVE"];

		// Validate against zod schema
		const parseResult = SampleMetadata.schema.safeParse(selectedSample);
		if (!parseResult.success) {
			console.error('Validation errors:', parseResult.error.issues);
			return;
		}

		try {
			await sampleService.submit(selectedSample);
			alert(isNewEntry ? 'New sample submitted successfully!' : 'Sample updated successfully!');
			handleModalClose();
			await fetchSamples();
		} catch (error) {
			console.error('Submission error:', error);
			alert(`Failed to submit sample: ${(error as Error).message}`);
		}
	}

	async function handleDelete() {
		if (!selectedSample) return;

		if (confirm(`Are you sure you want to delete sample ${selectedSample.sampleNumber}?`)) {
			try {
				await sampleService.delete(selectedSample);
				alert('Sample deleted successfully');
				handleModalClose();
				await fetchSamples();
			} catch (error) {
				console.error('Delete error:', error);
				alert(`Failed to delete sample: ${(error as Error).message}`);
			}
		}
	}

	function handleRowClick(row: SampleMetadata): void {
		selectedSample = { ...row };
		isNewEntry = false;
		open = true;
	}

	function handleNewEntry(): void {
		selectedSample = { ...new SampleMetadata() };
		isNewEntry = true;
		open = true;
	}

	function handleModalClose() {
		open = false;
		selectedSample = null;
	}

	function handleFormCancel() {
		handleModalClose();
	}

	onMount(() => {
		fetchSamples();
	});
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<div class="mb-4 flex justify-between items-center">
		<h2 class="text-2xl font-bold">Samples</h2>
		<Button on:click={handleNewEntry} variant="fill">New Sample</Button>
	</div>
	<div class="table-container">
		<Table
			data={allSamples}
			columns={[
				{
					name: 'sampleNumber',
					align: 'left',
					header: 'Sample Number',
					// @ts-expect-error
					format: (value) => (value == null ? '' : `S-${value}`)
				},
				{ name: 'name', align: 'left', header: 'Name' }
			]}
			order={sampleOrder}
			on:cellClick={(e) => handleRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>
</div>

<Dialog {open} on:close={handleModalClose} class="sampleInputDialog">
	<div slot="title">{isNewEntry ? 'Create New Sample' : 'Edit Sample Metadata'}</div>
	<div class="p-4">
		<Form initial={selectedSample} schema={SampleMetadata.schema} let:draft let:refresh let:current let:revertAll let:errors>
			<div class="p-4 flex gap-4">
				<TextField
					label="Sample Number"
					type="integer"
					value={draft.sampleNumber}
					disabled={!isNewEntry}
					required
					class="w-40 shrink-0"
					on:keydown={allowDigitsOnly}
					on:change={(e) => {
						draft.sampleNumber = e.detail.value;
						refresh();
					}}
					error={errors.sampleNumber}
				/>
				<TextField
					label="Name"
					value={draft.name}
					required
					disabled={!isNewEntry}
					class="flex-1 min-w-0"
					on:change={(e) => {
						draft.name = e.detail.value;
						refresh();
					}}
					error={errors.name}
				/>
			</div>

			<div class="flex gap-2 mt-4 {!isNewEntry ? 'justify-between' : 'justify-end'}">
				{#if !isNewEntry}
					<div>
						<Button on:click={handleDelete} variant="outline" color="danger">Delete</Button>
					</div>
				{/if}
				<div class="flex gap-2">
					{#if isNewEntry}
						<Button
							type="submit"
							variant="fill"
							on:click={() => {
								selectedSample = current;
								handleMetadataSubmit();
							}}>Save</Button
						>
					{/if}
					<Button
						on:click={() => {
							revertAll();
							handleFormCancel();
						}}
						style={{ marginLeft: 'auto' }}>{isNewEntry ? 'Cancel' : 'Close'}</Button
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

	:global(.sampleInputDialog label:has(input:required, textarea:required) .label::after) {
		content: ' *';
		color: hsl(0 85% 65%);
	}

	:global(.sampleInputDialog) {
		width: min(48rem, calc(100vw - 2rem));
		max-height: 90vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
</style>
