<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, SelectField } from 'svelte-ux';
	import { tableOrderStore } from 'svelte-ux';
	import { ThermocoupleMetadata, CameraMetadata, LensMetadata, DicMetadata, FlowmeterMetadata, PyrometerMetadata, IrCameraMetadata, EquipmentMetadata } from '$lib/models';
	import { GenericDataService } from '$lib/services/GenericDataService';
	import { env } from '$env/dynamic/public';
	import Zod from 'zod';

	let allEquipment: EquipmentMetadata[] = [];
	let selectedEquipment: EquipmentMetadata | null = null;
	let selectedEquipmentType: string | null | undefined = null;

	let isNewEntry = false;
	let open = false;

	const equipmentOrder = tableOrderStore({ initialBy: 'equipmentName', initialDirection: 'asc' });
	equipmentOrder.subscribe(() => {
		allEquipment = allEquipment.sort($equipmentOrder.handler);
	});

	const equipmentService = new GenericDataService<EquipmentMetadata>({
		modelClass: EquipmentMetadata,
		endpoint: env.PUBLIC_LOCAL_ONLY === 'true' ? '/local/equipment' : '/remote/instruments',
		idField: 'equipmentName',
		displayName: 'equipment'
	});

	const equipmentTypes = [
		{ label: 'Thermocouple', value: 'thermocouple' },
		{ label: 'Camera', value: 'camera' },
		{ label: 'Lens', value: 'lens' },
		{ label: 'Flowmeter', value: 'flowmeter' },
		{ label: 'Pyrometer', value: 'pyrometer' },
		{ label: 'IR Camera', value: 'ir-camera' }
	];

	async function fetchEquipment() {
		try {
			allEquipment = await equipmentService.fetchAll();
		} catch (error) {
			console.error('Error fetching equipment:', error);
			alert((error as Error).message);
		}
	}

	async function handleMetadataSubmit() {
		if (!selectedEquipment) {
			alert('No metadata selected.');
			return;
		}

		if (!selectedEquipmentType) {
			alert('No equipment type selected.');
			return;
		}

		let schema = getSchema(selectedEquipmentType);
		if (!schema) {
			alert('No schema found for the selected equipment type.');
			return;
		}

		//Validate against zod schema
		const parseResult = schema.safeParse(selectedEquipment);
		if (!parseResult.success) {
			console.error('Validation errors:', parseResult.error.errors);
			return;
		}

		try {
			await equipmentService.submit(selectedEquipment);
			alert(isNewEntry ? 'New equipment submitted successfully!' : 'Equipment updated successfully!');
			handleModalClose();
			await fetchEquipment();
		} catch (error) {
			console.error('Submission error:', error);
			alert(`Failed to submit equipment: ${(error as Error).message}`);
		}
	}

	function createNewEquipment(type: string | null | undefined): any {
		switch (type) {
			case 'thermocouple':
				return JSON.parse(JSON.stringify(new ThermocoupleMetadata()));
			case 'camera':
				return JSON.parse(JSON.stringify(new CameraMetadata()));
			case 'lens':
				return JSON.parse(JSON.stringify(new LensMetadata()));
			case 'dic':
				return JSON.parse(JSON.stringify(new DicMetadata()));
			case 'flowmeter':
				return JSON.parse(JSON.stringify(new FlowmeterMetadata()));
			case 'pyrometer':
				return JSON.parse(JSON.stringify(new PyrometerMetadata()));
			case 'ir-camera':
				return JSON.parse(JSON.stringify(new IrCameraMetadata()));
			default:
				return null;
		}
	}

	async function handleDelete() {
		if (!selectedEquipment) return;

		if (confirm(`Are you sure you want to delete equipment ${selectedEquipment.equipmentName}?`)) {
			try {
				await equipmentService.delete(selectedEquipment);
				alert('Equipment deleted successfully');
				handleModalClose();
				await fetchEquipment();
			} catch (error) {
				console.error('Error deleting equipment metadata:', error);
				alert(`Failed to delete equipment: ${(error as Error).message}`);
			}
		}
	}

	function handleRowClick(row: any): void {
		selectedEquipment = JSON.parse(JSON.stringify(row));
		selectedEquipmentType = row.equipmentType || 'thermocouple';
		console.log('Selected Equipment:', selectedEquipment);
		isNewEntry = false;
		open = true;
	}

	function handleNewEntry(): void {
		if (!selectedEquipmentType) {
			alert('Please select an equipment type first.');
			return;
		}

		selectedEquipment = { ...new EquipmentMetadata() };
		selectedEquipment.equipmentType = selectedEquipmentType;
		selectedEquipment.equipment = createNewEquipment(selectedEquipmentType);

		isNewEntry = true;
		open = true;
	}

	function handleModalClose() {
		open = false;
		selectedEquipment = null;
		isNewEntry = false;
	}

	function handleFormCancel() {
		handleModalClose();
	}

	onMount(() => {
		fetchEquipment();
	});

	function getSchema(selectedEquipmentType: string | null | undefined): Zod.ZodType<any, Zod.ZodTypeDef, any> | undefined {
		switch (selectedEquipmentType) {
			case 'thermocouple':
				return ThermocoupleMetadata.schema;
			case 'camera':
				return CameraMetadata.schema;
			case 'lens':
				return LensMetadata.schema;
			case 'flowmeter':
				return FlowmeterMetadata.schema;
			case 'pyrometer':
				return PyrometerMetadata.schema;
			case 'ir-camera':
				return IrCameraMetadata.schema;
			default:
				return undefined;
		}
	}
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<div class="mb-4 flex justify-between items-center">
		<h2 class="text-2xl font-bold">Equipment</h2>
		<div class="flex gap-2 items-center">
			<div class="font-bold">
				<SelectField
					label="Equipment Type"
					value={selectedEquipmentType}
					options={equipmentTypes}
					on:change={(e) => {
						selectedEquipmentType = e.detail.value;
					}}
				/>
			</div>
			<Button on:click={handleNewEntry} variant="fill" disabled={!selectedEquipmentType}>New Equipment</Button>
		</div>
	</div>
	<div class="table-container">
		<Table
			data={allEquipment}
			columns={[
				{ name: 'equipmentName', align: 'left', header: 'Name' },
				{ name: 'equipmentType', align: 'left', header: 'Type' }
			]}
			order={equipmentOrder}
			on:cellClick={(e) => handleRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>
</div>

<Dialog {open} on:close={handleModalClose} class="equipmentInputDialog">
	<div slot="title">{isNewEntry ? 'Create New Equipment' : 'Edit Equipment'}</div>
	<div class="p-4">
		<Form initial={selectedEquipment} schema={getSchema(selectedEquipmentType)} let:draft let:refresh let:state let:current let:revertAll let:errors>
			{#if selectedEquipmentType === 'thermocouple'}
				<div class="p-4 grid grid-cols-2 gap-4">
					<h4 class="col-span-2 mt-1">General Information</h4>
					<TextField
						label="Equipment Name"
						value={draft.equipmentName}
						on:change={(e) => {
							draft.equipmentName = e.detail.value;
							refresh();
						}}
						error={errors.equipmentName}
					/>

					<TextField
						label="Equipment Type"
						value={draft.equipmentType}
						on:change={(e) => {
							draft.equipment.tcType = e.detail.value;
							refresh();
						}}
						disabled
						error={errors.equipmentType}
					/>

					<h4 class="col-span-2 mt-1">Thermocouple Information</h4>
					<TextField
						label="Attachment"
						value={draft.equipment.attachment}
						on:change={(e) => {
							draft.equipment.attachment = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.attachment}
					/>
					<TextField
						label="Thermocouple Type"
						value={draft.equipment.thermocoupleType}
						on:change={(e) => {
							draft.equipment.thermocoupleType = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.thermocoupleType}
					/>
					<TextField
						label="Circle Diameter (mm)"
						type="integer"
						value={draft.equipment.circleDiameter}
						on:change={(e) => {
							draft.equipment.circleDiameter = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.circleDiameter}
					/>
					<TextField
						label="Noise Floor (%)"
						type="integer"
						value={draft.equipment.noiseFloor}
						on:change={(e) => {
							draft.equipment.noiseFloor = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.noiseFloor}
					/>
				</div>
			{:else if selectedEquipmentType === 'camera'}
				<div class="p-4 grid grid-cols-2 gap-4">
					<h4 class="col-span-2 mt-1">General Information</h4>
					<TextField
						label="Equipment Name"
						value={draft.equipmentName}
						on:change={(e) => {
							draft.equipmentName = e.detail.value;
							refresh();
						}}
						error={errors.equipmentName}
					/>

					<TextField
						label="Equipment Type"
						value={draft.equipmentType}
						on:change={(e) => {
							draft.equipment.tcType = e.detail.value;
							refresh();
						}}
						disabled
						error={errors.equipmentType}
					/>

					<h4 class="col-span-2 mt-1">Camera Information</h4>
					<TextField
						label="Make"
						value={draft.equipment.make}
						on:change={(e) => {
							draft.equipment.make = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.make}
					/>
					<TextField
						label="Model"
						value={draft.equipment.model}
						on:change={(e) => {
							draft.equipment.model = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.model}
					/>
					<TextField
						label="Serial Number"
						value={draft.equipment.serialNumber}
						on:change={(e) => {
							draft.equipment.serialNumber = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.serialNumber}
					/>
					<TextField
						label="Asset ID"
						value={draft.equipment.assetId}
						on:change={(e) => {
							draft.equipment.assetId = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.assetId}
					/>
					<h4 class="col-span-2 mt-4">Resolution (px)</h4>
					<TextField
						label="Resolution X"
						type="integer"
						value={draft.equipment.resolution.x}
						on:change={(e) => {
							draft.equipment.resolution.x = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.resolution?.x}
					/>
					<TextField
						label="Resolution Y"
						type="integer"
						value={draft.equipment.resolution.y}
						on:change={(e) => {
							draft.equipment.resolution.y = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.resolution?.y}
					/>
				</div>
			{:else if selectedEquipmentType === 'lens'}
				<div class="p-4 grid grid-cols-2 gap-4">
					<h4 class="col-span-2 mt-1">General Information</h4>
					<TextField
						label="Equipment Name"
						value={draft.equipmentName}
						on:change={(e) => {
							draft.equipmentName = e.detail.value;
							refresh();
						}}
						error={errors.equipmentName}
					/>

					<TextField
						label="Equipment Type"
						value={draft.equipmentType}
						on:change={(e) => {
							draft.equipment.tcType = e.detail.value;
							refresh();
						}}
						disabled
						error={errors.equipmentType}
					/>

					<h4 class="col-span-2 mt-1">Lens Information</h4>
					<TextField
						label="Make"
						value={draft.equipment.deviceInformation.make}
						on:change={(e) => {
							draft.equipment.deviceInformation.make = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.make}
					/>
					<TextField
						label="Model"
						value={draft.equipment.deviceInformation.model}
						on:change={(e) => {
							draft.equipment.deviceInformation.model = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.model}
					/>
					<TextField
						label="Serial Number"
						value={draft.equipment.deviceInformation.serialNumber}
						on:change={(e) => {
							draft.equipment.deviceInformation.serialNumber = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.serialNumber}
					/>
					<TextField
						label="Focal Length (mm)"
						value={draft.equipment.deviceInformation.focalLength}
						on:change={(e) => {
							draft.equipment.deviceInformation.focalLength = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.focalLength}
					/>
					<TextField
						label="Aperture"
						value={draft.equipment.deviceInformation.aperture}
						on:change={(e) => {
							draft.equipment.deviceInformation.aperture = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.aperture}
					/>
					<h4 class="col-span-2 mt-4">Field of View (px)</h4>
					<TextField
						label="Field of View X"
						value={draft.equipment.deviceInformation.fieldOfViewX}
						on:change={(e) => {
							draft.equipment.deviceInformation.fieldOfViewX = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.fieldOfViewX}
					/>
					<TextField
						label="Field of View Y"
						value={draft.equipment.deviceInformation.fieldOfViewY}
						on:change={(e) => {
							draft.equipment.deviceInformation.fieldOfViewY = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.fieldOfViewY}
					/>
				</div>
			{:else if selectedEquipmentType === 'flowmeter'}
				<div class="p-4 grid grid-cols-2 gap-4">
					<h4 class="col-span-2 mt-1">General Information</h4>
					<TextField
						label="Equipment Name"
						value={draft.equipmentName}
						on:change={(e) => {
							draft.equipmentName = e.detail.value;
							refresh();
						}}
						error={errors.equipmentName}
					/>

					<TextField
						label="Equipment Type"
						value={draft.equipmentType}
						on:change={(e) => {
							draft.equipment.tcType = e.detail.value;
							refresh();
						}}
						disabled
						error={errors.equipmentType}
					/>

					<h4 class="col-span-2 mt-1">Flowmeter Information</h4>
					<TextField
						label="Make"
						value={draft.equipment.make}
						on:change={(e) => {
							draft.equipment.make = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.make}
					/>
					<TextField
						label="Model"
						value={draft.equipment.model}
						on:change={(e) => {
							draft.equipment.model = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.model}
					/>
					<TextField
						label="Serial Number"
						value={draft.equipment.serialNumber}
						on:change={(e) => {
							draft.equipment.serialNumber = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.serialNumber}
					/>
					<TextField
						label="Asset ID"
						value={draft.equipment.assetId}
						on:change={(e) => {
							draft.equipment.assetId = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.assetId}
					/>
					<TextField
						label="Flowmeter Type"
						value={draft.equipment.flowmeterType}
						on:change={(e) => {
							draft.equipment.flowmeterType = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.flowmeterType}
					/>
					<h4 class="col-span-2 mt-4">Flow Range (L/min)</h4>
					<TextField
						label="Minimum Flow"
						type="integer"
						value={draft.equipment.flowRange.minimum}
						on:change={(e) => {
							draft.equipment.flowRange.minimum = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.flowRange?.minimum}
					/>
					<TextField
						label="Maximum Flow"
						type="integer"
						value={draft.equipment.flowRange.maximum}
						on:change={(e) => {
							draft.equipment.flowRange.maximum = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.flowRange?.maximum}
					/>
				</div>
			{:else if selectedEquipmentType === 'pyrometer'}
				<div class="p-4 grid grid-cols-2 gap-4">
					<h4 class="col-span-2 mt-1">General Information</h4>
					<TextField
						label="Equipment Name"
						value={draft.equipmentName}
						on:change={(e) => {
							draft.equipmentName = e.detail.value;
							refresh();
						}}
						error={errors.equipmentName}
					/>

					<TextField
						label="Equipment Type"
						value={draft.equipmentType}
						on:change={(e) => {
							draft.equipment.tcType = e.detail.value;
							refresh();
						}}
						disabled
						error={errors.equipmentType}
					/>

					<h4 class="col-span-2 mt-1">Pyrometer Information</h4>
					<TextField
						label="Make"
						value={draft.equipment.make}
						on:change={(e) => {
							draft.equipment.make = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.make}
					/>
					<TextField
						label="Model"
						value={draft.equipment.model}
						on:change={(e) => {
							draft.equipment.model = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.model}
					/>
					<TextField
						label="Serial Number"
						value={draft.equipment.serialNumber}
						on:change={(e) => {
							draft.equipment.serialNumber = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.serialNumber}
					/>
					<TextField
						label="Asset ID"
						value={draft.equipment.assetId}
						on:change={(e) => {
							draft.equipment.assetId = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.assetId}
					/>
					<h4 class="col-span-2 mt-4">Spectral Range (μm)</h4>
					<TextField
						label="Minimum Wavelength"
						type="integer"
						value={draft.equipment.spectralRange.minimum}
						on:change={(e) => {
							draft.equipment.spectralRange.minimum = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.spectralRange?.minimum}
					/>
					<TextField
						label="Maximum Wavelength"
						type="integer"
						value={draft.equipment.spectralRange.maximum}
						on:change={(e) => {
							draft.equipment.spectralRange.maximum = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.spectralRange?.maximum}
					/>
					<h4 class="col-span-2 mt-4">Temperature Range (°C)</h4>
					<TextField
						label="Minimum Temperature"
						type="integer"
						value={draft.equipment.temperatureRange.minimum}
						on:change={(e) => {
							draft.equipment.temperatureRange.minimum = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.temperatureRange?.minimum}
					/>
					<TextField
						label="Maximum Temperature"
						type="integer"
						value={draft.equipment.temperatureRange.maximum}
						on:change={(e) => {
							draft.equipment.temperatureRange.maximum = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.temperatureRange?.maximum}
					/>
				</div>
			{:else if selectedEquipmentType === 'ir-camera'}
				<div class="p-4 grid grid-cols-2 gap-4">
					<h4 class="col-span-2 mt-1">General Information</h4>
					<TextField
						label="Equipment Name"
						value={draft.equipmentName}
						on:change={(e) => {
							draft.equipmentName = e.detail.value;
							refresh();
						}}
						error={errors.equipmentName}
					/>

					<TextField
						label="Equipment Type"
						value={draft.equipmentType}
						on:change={(e) => {
							draft.equipment.tcType = e.detail.value;
							refresh();
						}}
						disabled
						error={errors.equipmentType}
					/>

					<h4 class="col-span-2 mt-1">IR Camera Information</h4>
					<TextField
						label="Make"
						value={draft.equipment.deviceInformation.make}
						on:change={(e) => {
							draft.equipment.deviceInformation.make = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.make}
					/>
					<TextField
						label="Model"
						value={draft.equipment.deviceInformation.model}
						on:change={(e) => {
							draft.equipment.deviceInformation.model = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.model}
					/>
					<TextField
						label="Serial Number"
						value={draft.equipment.deviceInformation.serialNumber}
						on:change={(e) => {
							draft.equipment.deviceInformation.serialNumber = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.serialNumber}
					/>
					<h4 class="col-span-2 mt-4">Resolution (px)</h4>
					<TextField
						label="Resolution X"
						type="integer"
						value={draft.equipment.deviceInformation.resolution.x}
						on:change={(e) => {
							draft.equipment.deviceInformation.resolution.x = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.resolution?.x}
					/>
					<TextField
						label="Resolution Y"
						type="integer"
						value={draft.equipment.deviceInformation.resolution.y}
						on:change={(e) => {
							draft.equipment.deviceInformation.resolution.y = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.resolution?.y}
					/>
					<h4 class="col-span-2 mt-4">Spectral Range (μm)</h4>
					<TextField
						label="Minimum Wavelength"
						type="integer"
						value={draft.equipment.deviceInformation.spectralRange.minimum}
						on:change={(e) => {
							draft.equipment.deviceInformation.spectralRange.minimum = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.spectralRange?.minimum}
					/>
					<TextField
						label="Maximum Wavelength"
						type="integer"
						value={draft.equipment.deviceInformation.spectralRange.maximum}
						on:change={(e) => {
							draft.equipment.deviceInformation.spectralRange.maximum = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.spectralRange?.maximum}
					/>
					<h4 class="col-span-2 mt-4">Temperature Range (°C)</h4>
					<TextField
						label="Minimum Temperature"
						type="integer"
						value={draft.equipment.deviceInformation.temperatureRange.minimum}
						on:change={(e) => {
							draft.equipment.deviceInformation.temperatureRange.minimum = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.temperatureRange?.minimum}
					/>
					<TextField
						label="Maximum Temperature"
						type="integer"
						value={draft.equipment.deviceInformation.temperatureRange.maximum}
						on:change={(e) => {
							draft.equipment.deviceInformation.temperatureRange.maximum = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceInformation?.temperatureRange?.maximum}
					/>
					<h4 class="col-span-2 mt-4">Device Settings</h4>
					<TextField
						label="Emissivity"
						type="decimal"
						value={draft.equipment.deviceSettings.emissivity}
						on:change={(e) => {
							draft.equipment.deviceSettings.emissivity = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceSettings?.emissivity}
					/>
					<TextField
						label="Framerate (Hz)"
						type="integer"
						value={draft.equipment.deviceSettings.framerate}
						on:change={(e) => {
							draft.equipment.deviceSettings.framerate = e.detail.value;
							refresh();
						}}
						error={errors.equipment?.deviceSettings?.framerate}
					/>
				</div>
			{/if}

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
							selectedEquipment = current;
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

	:global(.equipmentInputDialog) {
		max-height: 90vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
</style>
