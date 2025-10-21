<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, SelectField } from 'svelte-ux';
	import { tableOrderStore } from 'svelte-ux';
	import { page } from '$app/stores';
	import { PUBLIC_LOCAL_ONLY, PUBLIC_METACAT_URL, PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';
	import { getJsonFiles, getJsonContent } from '$lib/jsonUtils';
	import {
		ThermocoupleMetadata,
		CameraMetadata,
		LensMetadata,
		DicMetadata,
		FlowmeterMetadata,
		PyrometerMetadata,
		IrCameraMetadata
	} from '$lib/models';

	let sortedData: any[] = [];
	let selectedMetadata: any = null;
	let selectedEquipmentType = '';
	let isNewEntry = false;
	let open = false;
	let localOnly = false;

	const equipmentOrder = tableOrderStore({ initialBy: 'equipmentName', initialDirection: 'asc' });

	const equipmentTypes = [
		{ label: 'Thermocouple', value: 'thermocouple' },
		{ label: 'Camera', value: 'camera' },
		{ label: 'Lens', value: 'lens' },
		{ label: 'Flowmeter', value: 'flowmeter' },
		{ label: 'Pyrometer', value: 'pyrometer' },
		{ label: 'IR Camera', value: 'ir-camera' }
	];

	equipmentOrder.subscribe(() => {
		sortedData = sortedData.sort($equipmentOrder.handler);
	});

	function createNewEquipment(type: string) {
		switch(type) {
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
				return JSON.parse(JSON.stringify(new ThermocoupleMetadata()));
		}
	}

	async function fetchEquipment() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			if (localOnly) {
				const files = await getJsonFiles('equipment');
				const equipmentData = await Promise.all(files.map((filename: string) => getJsonContent('equipment/' + filename)));

				// Transform equipment data to include display properties
				const equipment = equipmentData.map((data: any) => {
					const equipmentType = data.equipmentType || 'unknown';
					let name = '';
					let make = '';
					let model = '';

					// Extract display information based on equipment type
					if (data) {
						make = data.make || '';
						model = data.model || '';
						name = `${make} ${model}`.trim();
					} else if (equipmentType === 'thermocouple') {
						name = `${data.tcType || 'Thermocouple'} - ${data.location || 'Unknown Location'}`;
						make = data.tcType || '';
						model = data.attachment || '';
					}

					return {
						...data,
						type: equipmentType,
						name: name || `${equipmentType} - ${data.equipmentUUID || 'No UUID'}`,
						make: make,
						model: model
					};
				});

				sortedData = equipment.sort($equipmentOrder.handler);
				return;
			}

			// For API mode, fetch from endpoint
			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/equipment`, {
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (!response.ok) throw new Error('Failed to fetch equipment');
			const data = await response.json();
			sortedData = data.sort($equipmentOrder.handler);
		} catch (error) {
			console.error('Error fetching equipment:', error);
			alert('Failed to load equipment. Please try again later.');
		}
	}

	async function handleMetadataSubmit() {
		const rawMetadata = selectedMetadata;
		if (!rawMetadata) {
			alert('No equipment metadata to save.');
			return;
		}

		// Generate UUID if it's a new entry
		if (isNewEntry) {
			rawMetadata.equipmentUUID = crypto.randomUUID();
		}

		console.log('Submitting equipment metadata:', rawMetadata);

		try {
			await handleFileSubmission(rawMetadata);
		} catch (error) {
			console.error('File submission failed:', error);
		}

		if (localOnly) {
			handleModalClose();
			await fetchEquipment();
			return;
		}

		try {
			await handleAPISubmission(rawMetadata, isNewEntry);
			handleModalClose();
			await fetchEquipment();
		} catch (error) {
			console.error('API submission failed:', error);
		}
	}

	async function handleFileSubmission(rawMetadata: any): Promise<void> {
		try {
			const equipmentUUID = rawMetadata.equipmentUUID || crypto.randomUUID();
			rawMetadata.equipmentUUID = equipmentUUID;

			const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/equipment/`;
			const fileName = `${equipmentUUID}.json`;
			// Convert back to the appropriate class for proper JSON serialization
			let cleanedMetadata;
			switch(selectedEquipmentType) {
				case 'thermocouple':
					const thermocouple = ThermocoupleMetadata.fromJSON(rawMetadata);
					cleanedMetadata = ThermocoupleMetadata.toJSON(thermocouple);
					break;
				case 'camera':
					const camera = CameraMetadata.fromJSON(rawMetadata);
					cleanedMetadata = CameraMetadata.toJSON(camera);
					break;
				case 'lens':
					const lens = LensMetadata.fromJSON(rawMetadata);
					cleanedMetadata = LensMetadata.toJSON(lens);
					break;
				case 'dic':
					const dic = DicMetadata.fromJSON(rawMetadata);
					cleanedMetadata = DicMetadata.toJSON(dic);
					break;
				case 'flowmeter':
					const flowmeter = FlowmeterMetadata.fromJSON(rawMetadata);
					cleanedMetadata = FlowmeterMetadata.toJSON(flowmeter);
					break;
				case 'pyrometer':
					const pyrometer = PyrometerMetadata.fromJSON(rawMetadata);
					cleanedMetadata = PyrometerMetadata.toJSON(pyrometer);
					break;
				case 'ir-camera':
					const irCamera = IrCameraMetadata.fromJSON(rawMetadata);
					cleanedMetadata = IrCameraMetadata.toJSON(irCamera);
					break;
				default:
					cleanedMetadata = rawMetadata;
			}

			// Add equipment type and UUID to the metadata
			cleanedMetadata.equipmentType = selectedEquipmentType;
			cleanedMetadata.equipmentUUID = equipmentUUID;

			const saveMetadata = { targetPath: `${filePath}/${fileName}`, metadata: cleanedMetadata };

			const fileResponse = await fetch('/api/save-json', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(saveMetadata)
			});

			if (!fileResponse.ok) {
				const errorData = await fileResponse.json();
				throw new Error(`Failed to save metadata file: ${errorData.message}`);
			}

			console.log('Equipment metadata file saved successfully');
			alert('Equipment metadata file saved successfully');
		} catch (error: any) {
			console.error('Error saving metadata file:', error);
			alert(`Failed to save metadata file: ${error.message}`);
			throw error;
		}
	}

	async function handleAPISubmission(rawMetadata: any, isNewEntry: boolean): Promise<void> {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			const url = `${PUBLIC_METACAT_URL}/api/v1/equipment?schema=any`;
			const method = isNewEntry ? 'POST' : 'POST';
			const endpointResponse = await fetch(url, {
				method: method,
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify(rawMetadata)
			});

			if (!endpointResponse.ok) throw new Error('Failed to save equipment to endpoint');

			console.log('Equipment submitted to API successfully');
			alert(isNewEntry ? 'New equipment submitted successfully!' : 'Equipment updated successfully!');
		} catch (error: any) {
			console.error('Error submitting equipment to API:', error);
			alert(`Failed to submit equipment to API: ${error.message}`);
			throw error;
		}
	}

	function handleRowClick(row: any): void {
		selectedMetadata = JSON.parse(JSON.stringify(row));
		selectedEquipmentType = row.type || 'thermocouple';
		isNewEntry = false;
		open = true;
	}

	function handleNewEntry(): void {
		selectedMetadata = createNewEquipment(selectedEquipmentType);
		isNewEntry = true;
		open = true;
	}

	function handleModalClose() {
		open = false;
		selectedMetadata = null;
		isNewEntry = false;
	}

	function handleFormCancel() {
		handleModalClose();
	}

	function handleDelete(): void {
		if (!selectedMetadata) return;

		const equipmentUUID = selectedMetadata.equipmentUUID;
		if (confirm(`Are you sure you want to delete this equipment with UUID: ${equipmentUUID}?`)) {
			if (localOnly) {
				const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/equipment/${equipmentUUID}.json`;
				fetch('/api/delete-json', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ targetPath: filePath })
				})
				.then((response) => {
					if (!response.ok) throw new Error('Failed to delete local file');
					alert('Equipment deleted successfully');
					fetchEquipment();
				})
				.catch((error) => {
					console.error('Error deleting local file:', error);
					alert(`Failed to delete equipment: ${error.message}`);
				});
			} else {
				const accessToken = $page.data.session?.sessionToken;
				fetch(`${PUBLIC_METACAT_URL}/api/v1/equipment/${equipmentUUID}`, {
					method: 'DELETE',
					headers: { Authorization: `Bearer ${accessToken}` }
				})
				.then((response) => {
					if (!response.ok) throw new Error('Failed to delete equipment from API');
					alert('Equipment deleted successfully');
					fetchEquipment();
				})
				.catch((error) => {
					console.error('Error deleting equipment from API:', error);
					alert(`Failed to delete equipment: ${error.message}`);
				});
			}
			handleModalClose();
		}
	}

	onMount(() => {
		if (PUBLIC_LOCAL_ONLY == 'true') {
			localOnly = true;
		}
		fetchEquipment();
	});
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
			data={sortedData}
			columns={[
				{ name: 'type', align: 'left', header: 'Type' },
				{ name: 'name', align: 'left', header: 'Name' },
				{ name: 'make', align: 'left', header: 'Make' },
				{ name: 'model', align: 'left', header: 'Model' }
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
		<Form initial={selectedMetadata} let:draft let:refresh let:current let:revertAll>

			{#if selectedEquipmentType === 'thermocouple'}
				<div class="p-4 grid grid-cols-2 gap-4">
					<h4 class="col-span-2 mt-1">Thermocouple Information</h4>
					<TextField
						label="Attachment"
						value={draft.attachment}
						on:change={(e) => {
							draft.attachment = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Thermocouple Type"
						value={draft.tcType}
						on:change={(e) => {
							draft.tcType = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Circle Diameter (mm)"
						value={draft.circleDiameter}
						on:change={(e) => {
							draft.circleDiameter = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Noise Floor (%)"
						value={draft.noiseFloor}
						on:change={(e) => {
							draft.noiseFloor = e.detail.value;
							refresh();
						}}
					/>
				</div>
			{:else if selectedEquipmentType === 'camera'}
				<div class="p-4 grid grid-cols-2 gap-4">
					<h4 class="col-span-2 mt-1">Camera Information</h4>
					<TextField
						label="Make"
						value={draft.make}
						on:change={(e) => {
							draft.make = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Model"
						value={draft.model}
						on:change={(e) => {
							draft.model = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Serial Number"
						value={draft.serialNumber}
						on:change={(e) => {
							draft.serialNumber = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Asset ID"
						value={draft.assetId}
						on:change={(e) => {
							draft.assetId = e.detail.value;
							refresh();
						}}
					/>
					<h4 class="col-span-2 mt-4">Resolution (px)</h4>
					<TextField
						label="Resolution X"
						type="number"
						value={draft.resolution.x}
						on:change={(e) => {
							draft.resolution.x = Number(e.detail.value);
							refresh();
						}}
					/>
					<TextField
						label="Resolution Y"
						type="number"
						value={draft.resolution.y}
						on:change={(e) => {
							draft.resolution.y = Number(e.detail.value);
							refresh();
						}}
					/>
				</div>
			{:else if selectedEquipmentType === 'lens'}
				<div class="p-4 grid grid-cols-2 gap-4">
					<h4 class="col-span-2 mt-1">Lens Information</h4>
					<TextField
						label="Make"
						value={draft.make}
						on:change={(e) => {
							draft.deviceInformation.make = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Model"
						value={draft.deviceInformation.model}
						on:change={(e) => {
							draft.deviceInformation.model = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Serial Number"
						value={draft.deviceInformation.serialNumber}
						on:change={(e) => {
							draft.deviceInformation.serialNumber = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Focal Length (mm)"
						value={draft.deviceInformation.focalLength}
						on:change={(e) => {
							draft.deviceInformation.focalLength = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Aperture"
						value={draft.deviceInformation.aperture}
						on:change={(e) => {
							draft.deviceInformation.aperture = e.detail.value;
							refresh();
						}}
					/>
					<h4 class="col-span-2 mt-4">Field of View (px)</h4>
					<TextField
						label="Field of View X"
						value={draft.deviceInformation.fieldOfViewX}
						on:change={(e) => {
							draft.deviceInformation.fieldOfViewX = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Field of View Y"
						value={draft.deviceInformation.fieldOfViewY}
						on:change={(e) => {
							draft.deviceInformation.fieldOfViewY = e.detail.value;
							refresh();
						}}
					/>
				</div>
			{:else if selectedEquipmentType === 'flowmeter'}
				<div class="p-4 grid grid-cols-2 gap-4">
					<h4 class="col-span-2 mt-1">Flowmeter Information</h4>
					<TextField
						label="Make"
						value={draft.make}
						on:change={(e) => {
							draft.make = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Model"
						value={draft.model}
						on:change={(e) => {
							draft.model = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Serial Number"
						value={draft.serialNumber}
						on:change={(e) => {
							draft.serialNumber = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Asset ID"
						value={draft.assetId}
						on:change={(e) => {
							draft.assetId = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Flowmeter Type"
						value={draft.flowmeterType}
						on:change={(e) => {
							draft.flowmeterType = e.detail.value;
							refresh();
						}}
					/>
					<h4 class="col-span-2 mt-4">Flow Range (L/min)</h4>
					<TextField
						label="Minimum Flow"
						type="number"
						value={draft.flowRange.minimum}
						on:change={(e) => {
							draft.flowRange.minimum = Number(e.detail.value);
							refresh();
						}}
					/>
					<TextField
						label="Maximum Flow"
						type="number"
						value={draft.flowRange.maximum}
						on:change={(e) => {
							draft.flowRange.maximum = Number(e.detail.value);
							refresh();
						}}
					/>
				</div>
			{:else if selectedEquipmentType === 'pyrometer'}
				<div class="p-4 grid grid-cols-2 gap-4">
					<h4 class="col-span-2 mt-1">Pyrometer Information</h4>
					<TextField
						label="Make"
						value={draft.make}
						on:change={(e) => {
							draft.make = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Model"
						value={draft.model}
						on:change={(e) => {
							draft.model = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Serial Number"
						value={draft.serialNumber}
						on:change={(e) => {
							draft.serialNumber = e.detail.value;
							refresh();
						}}
					/>
					<h4 class="col-span-2 mt-4">Spectral Range (μm)</h4>
					<TextField
						label="Minimum Wavelength"
						type="number"
						value={draft.spectralRange.minimum}
						on:change={(e) => {
							draft.spectralRange.minimum = Number(e.detail.value);
							refresh();
						}}
					/>
					<TextField
						label="Maximum Wavelength"
						type="number"
						value={draft.spectralRange.maximum}
						on:change={(e) => {
							draft.spectralRange.maximum = Number(e.detail.value);
							refresh();
						}}
					/>
					<h4 class="col-span-2 mt-4">Temperature Range (°C)</h4>
					<TextField
						label="Minimum Temperature"
						type="number"
						value={draft.temperatureRange.minimum}
						on:change={(e) => {
							draft.temperatureRange.minimum = Number(e.detail.value);
							refresh();
						}}
					/>
					<TextField
						label="Maximum Temperature"
						type="number"
						value={draft.temperatureRange.maximum}
						on:change={(e) => {
							draft.temperatureRange.maximum = Number(e.detail.value);
							refresh();
						}}
					/>
				</div>
			{:else if selectedEquipmentType === 'ir-camera'}
				<div class="p-4 grid grid-cols-2 gap-4">
					<h4 class="col-span-2 mt-1">IR Camera Information</h4>
					<TextField
						label="Make"
						value={draft.deviceInformation.make}
						on:change={(e) => {
							draft.deviceInformation.make = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Model"
						value={draft.deviceInformation.model}
						on:change={(e) => {
							draft.deviceInformation.model = e.detail.value;
							refresh();
						}}
					/>
					<TextField
						label="Serial Number"
						value={draft.deviceInformation.serialNumber}
						on:change={(e) => {
							draft.deviceInformation.serialNumber = e.detail.value;
							refresh();
						}}
					/>
					<h4 class="col-span-2 mt-4">Resolution (px)</h4>
					<TextField
						label="Resolution X"
						type="number"
						value={draft.deviceInformation.resolution.x}
						on:change={(e) => {
							draft.deviceInformation.resolution.x = Number(e.detail.value);
							refresh();
						}}
					/>
					<TextField
						label="Resolution Y"
						type="number"
						value={draft.deviceInformation.resolution.y}
						on:change={(e) => {
							draft.deviceInformation.resolution.y = Number(e.detail.value);
							refresh();
						}}
					/>
					<h4 class="col-span-2 mt-4">Spectral Range (μm)</h4>
					<TextField
						label="Minimum Wavelength"
						type="number"
						value={draft.deviceInformation.spectralRange.minimum}
						on:change={(e) => {
							draft.deviceInformation.spectralRange.minimum = Number(e.detail.value);
							refresh();
						}}
					/>
					<TextField
						label="Maximum Wavelength"
						type="number"
						value={draft.deviceInformation.spectralRange.maximum}
						on:change={(e) => {
							draft.deviceInformation.spectralRange.maximum = Number(e.detail.value);
							refresh();
						}}
					/>
					<h4 class="col-span-2 mt-4">Temperature Range (°C)</h4>
					<TextField
						label="Minimum Temperature"
						type="number"
						value={draft.deviceInformation.temperatureRange.minimum}
						on:change={(e) => {
							draft.deviceInformation.temperatureRange.minimum = Number(e.detail.value);
							refresh();
						}}
					/>
					<TextField
						label="Maximum Temperature"
						type="number"
						value={draft.deviceInformation.temperatureRange.maximum}
						on:change={(e) => {
							draft.deviceInformation.temperatureRange.maximum = Number(e.detail.value);
							refresh();
						}}
					/>
					<h4 class="col-span-2 mt-4">Device Settings</h4>
					<TextField
						label="Emissivity"
						type="number"
						step="0.01"
						value={draft.deviceSettings.emissivity}
						on:change={(e) => {
							draft.deviceSettings.emissivity = Number(e.detail.value);
							refresh();
						}}
					/>
					<TextField
						label="Framerate (Hz)"
						type="number"
						value={draft.deviceSettings.framerate}
						on:change={(e) => {
							draft.deviceSettings.framerate = Number(e.detail.value);
							refresh();
						}}
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
						on:click={() => {
							selectedMetadata = current;
							handleMetadataSubmit();
						}}
						variant="fill">Save</Button
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