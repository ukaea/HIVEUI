<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, Table, Dialog, Form, TextField, DateField } from 'svelte-ux';
	import { tableOrderStore } from 'svelte-ux';
	import { page } from '$app/stores';
	import { PUBLIC_METACAT_URL, PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';

	class Port {
		portID: string;
		portDescription: string;
		portSizeStandard: string;

		constructor() {
			this.portID = '';
			this.portDescription = '';
			this.portSizeStandard = '';
		}
	}

	class Thermocouple {
		status: string;
		attachment: string;
		tcType: string;
		location: string;
		areaType: string;
		circleDiameter: string;
		noiseFloor: string;

		constructor() {
			this.status = '';
			this.attachment = '';
			this.tcType = '';
			this.location = '';
			this.areaType = '';
			this.circleDiameter = '';
			this.noiseFloor = '';
		}
	}

	class DICConfig {
		setupInformation: DICSetupInformation;
		softwareInformation: DICSoftwareInformation;
		additionalInformation: DICAdditionalInformation;
		cameraSetup: DICCameraSetup;

		constructor() {
			this.setupInformation = new DICSetupInformation();
			this.softwareInformation = new DICSoftwareInformation();
			this.additionalInformation = new DICAdditionalInformation();
			this.cameraSetup = new DICCameraSetup();
		}
	}

	class DICSetupInformation {
		configuration: string;
		stereoAngle: string;
		standOffDistance: string;
		imagedSurfaceOnSpecimen?: string;

		constructor() {
			this.configuration = '';
			this.stereoAngle = '';
			this.standOffDistance = '';
			this.imagedSurfaceOnSpecimen = '';
		}
	}

	class DICSoftwareInformation {
		softwareName: string;
		softwareVersion: string;

		constructor() {
			this.softwareName = '';
			this.softwareVersion = '';
		}
	}

	class DICAdditionalInformation {
		patternTechnique: string;
		patternBackground: string;
		patternSpeckle: string;
		approxFeatureSize?: string;
		calTargetMake?: string;
		calTargetDims?: string;
		calTargetSpacing?: string;

		constructor() {
			this.patternTechnique = '';
			this.patternBackground = '';
			this.patternSpeckle = '';
		}
	}

	class DICCameraSetup {
		comment: string;
		cameras: string[];

		constructor() {
			this.comment = '';
			this.cameras = [];
		}
	}

	class CameraInformation {
		make: string;
		model: string;
		serialNumber?: string;
		resolutionX: string;
		resolutionY: string;

		constructor() {
			this.make = '';
			this.model = '';
			this.serialNumber = '';
			this.resolutionX = '';
			this.resolutionY = '';
		}
	}

	class LensInformation {
		make: string;
		model: string;
		serialNumber?: string;
		focalLength: string;
		aperture: string;
		fieldOfViewX?: string;
		fieldOfViewY?: string;

		constructor() {
			this.make = '';
			this.model = '';
			this.serialNumber = '';
			this.focalLength = '';
			this.aperture = '';
			this.fieldOfViewX = '';
			this.fieldOfViewY = '';
		}
	}

	class CaptureSettings {
		imageAcquisitionRate: string;
		imageNoise: string;
		imageScale?: string;

		constructor() {
			this.imageAcquisitionRate = '';
			this.imageNoise = '';
			this.imageScale = '';
		}
	}

	class Camera {
		cameraInformation: CameraInformation;
		lensInformation: LensInformation;
		captureSettings: CaptureSettings;

		constructor() {
			this.cameraInformation = new CameraInformation();
			this.lensInformation = new LensInformation();
			this.captureSettings = new CaptureSettings();
		}
	}

	class DeviceMetadata {
		port: Port;
		deviceID: string;

		constructor() {
			this.port = new Port();
			this.deviceID = '';
		}
	}

	class ThermocoupleMetadata extends DeviceMetadata {
		diagnostic: Thermocouple;

		constructor() {
			super();
			this.diagnostic = new Thermocouple();
		}
	}

	class CameraMetadata extends DeviceMetadata {
		diagnostic: Camera;

		constructor() {
			super();
			this.diagnostic = new Camera();
		}
	}

	class DICMetadata extends DeviceMetadata {
		diagnostic: DICConfig;

		constructor() {
			super();
			this.diagnostic = new DICConfig();
		}
	}

	let sortedData: DeviceMetadata[] = [];
	const order = tableOrderStore({ initialBy: 'deviceID', initialDirection: 'asc' });
	let open = false;
	let selectedMetadata: DeviceMetadata | null = null;
	let isNewEntry = false;

	let openThermocouple = false;
	let isNewThermocouple = false;

	let openCamera = false;
	let isNewCamera = false;

	let openDIC = false;
	let isNewDIC = false;

	function mapScicatToDevice(apiResponse: any): DeviceMetadata {
		const metadata = new DeviceMetadata();
		metadata.deviceID = apiResponse.pid || '';
		metadata.port = new Port();
		return metadata;
	}

	function mapDeviceToSciCat(metadata: DeviceMetadata): any {
		return {
			pid: metadata.deviceID,
			name: metadata.deviceID,
			uniqueName: metadata.deviceID
		};
	}

	async function fetchInstruments() {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}
			const response = await fetch(`${PUBLIC_METACAT_URL}/api/v1/instruments?filter=%7B%7D`, {
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});
			if (!response.ok) throw new Error('Failed to fetch diagnostics');
			const data = await response.json();
			sortedData = data.map(mapScicatToDevice).sort($order.handler);
		} catch (error) {
			console.error('Error fetching diagnostics:', error);
			alert('Failed to load diagnostics. Please try again later.');
		}
	}

	async function handleMetadataSubmit(event: CustomEvent<DeviceMetadata>): Promise<void> {
		const rawMetadata = event.detail;
		console.log('Raw metadata:', rawMetadata);

		try {
			await handleFileSubmission(rawMetadata);
		} catch (error) {
			console.error('File submission failed:', error);
		}

		try {
			await handleAPISubmission(rawMetadata, isNewEntry);
			handleModalClose();
		} catch (error) {
			console.error('API submission failed:', error);
		}
	}

	async function handleFileSubmission(rawMetadata: DeviceMetadata): Promise<void> {
		try {
			const deviceID = rawMetadata.deviceID;
			const filePath = `${PUBLIC_ROOT_FOLDER_LOCATION}/diagnostics`;
			const fileName = `${deviceID}.json`;

			const saveMetadata = {
				targetPath: `${filePath}/${fileName}`,
				metadata: rawMetadata
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

			console.log('Metadata file saved successfully');
			alert('Metadata file saved successfully');
		} catch (error) {
			console.error('Error saving metadata file:', error);
			alert(`Failed to save metadata file: ${error.message}`);
			throw error;
		}
	}

	async function handleAPISubmission(rawMetadata: DeviceMetadata, isNewEntry: boolean): Promise<void> {
		try {
			const accessToken = $page.data.session?.sessionToken;
			if (!accessToken) {
				throw new Error('No access token available');
			}

			const mappedMetadata = mapDeviceToSciCat(rawMetadata);
			console.log('Mapped metadata:', mappedMetadata);

			const url = `${PUBLIC_METACAT_URL}/api/v1/instruments?schema=any`;
			const method = isNewEntry ? 'POST' : 'POST';
			const endpointResponse = await fetch(url, {
				method: method,
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`
				},
				body: JSON.stringify(mappedMetadata)
			});

			if (!endpointResponse.ok) throw new Error('Failed to save diagnostic to endpoint');

			console.log('Diagnostic submitted to API successfully');
			alert(isNewEntry ? 'New diagnostic submitted successfully!' : 'Diagnostic updated successfully!');

			await fetchInstruments(); // Refresh the data
		} catch (error) {
			console.error('Error submitting diagnostic to API:', error);
			alert(`Failed to submit diagnostic to API: ${error.message}`);
			throw error; // Re-throw the error if you want calling code to handle it
		}
	}

	function handleRowClick(row: DeviceMetadata): void {
		selectedMetadata = { ...row };
		isNewEntry = false;
		open = true;
	}

	function handleNewThermocouple(): void {
		selectedMetadata = { ...new ThermocoupleMetadata() };
		isNewThermocouple = true;
		openThermocouple = true;
	}

	function handleNewCamera(): void {
		let newCamera = { ...new CameraMetadata() };
		newCamera.diagnostic.cameraInformation = { ...new CameraInformation() };
		newCamera.diagnostic.lensInformation = { ...new LensInformation() };
		newCamera.diagnostic.captureSettings = { ...new CaptureSettings() };

		selectedMetadata = { ...newCamera };
		isNewCamera = true;
		openCamera = true;
	}

	function handleNewDIC(): void {
		selectedMetadata = { ...new DICMetadata() };
		isNewDIC = true;
		openDIC = true;
	}

	function handleThermocoupleClose(): void {
		openThermocouple = false;
		selectedMetadata = null;
		isNewThermocouple = false;
	}

	function handleCameraClose(): void {
		openCamera = false;
		selectedMetadata = null;
		isNewCamera = false;
	}

	function handleDICClose(): void {
		openDIC = false;
		selectedMetadata = null;
		isNewDIC = false;
	}

	function handleModalClose() {
		open = false;
		selectedMetadata = null;
		isNewEntry = false;

		handleThermocoupleClose();
		handleCameraClose();
		handleDICClose();
	}

	onMount(() => {
		fetchInstruments();
	});
</script>

<div class="flex flex-col min-h-screen bg-neutral p-4 w-full">
	<div class="mb-4 flex justify-between items-center">
		<h2 class="text-2xl font-bold">Diagnostic Metadata</h2>
		<div class="gap-10">
			<Button on:click={handleNewThermocouple} variant="fill">New Thermocouple</Button>
			<Button on:click={handleNewCamera} variant="fill">New Camera</Button>
			<Button on:click={handleNewDIC} variant="fill">New DIC</Button>
		</div>
	</div>
	<div class="table-container">
		<Table
			data={sortedData.map((item) => ({
				...item,
				displayPort: item.port?.portID || 'N/A'
			}))}
			columns={[
				{ name: 'deviceID', align: 'left', header: 'Device ID' },
				{ name: 'displayPort', align: 'left', header: 'Port' }
			]}
			{order}
			on:cellClick={(e) => handleRowClick(e.detail.rowData)}
			class="styled-table"
		/>
	</div>
</div>

<Dialog {open} on:close={handleModalClose}>
	<div slot="title">{isNewEntry ? 'Create New Diagnostic' : 'Edit Diagnostic Metadata'}</div>
	<div class="p-4">
		<Form initial={selectedMetadata} on:change={handleMetadataSubmit} let:commit let:draft let:refresh>
			<div class="p-4 grid grid-cols-2 gap-4">
				<TextField
					label="Device ID"
					value={draft.deviceID}
					on:change={(e) => {
						draft.deviceID = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Port ID"
					value={draft.port.portID}
					on:change={(e) => {
						draft.port.portID = e.detail.value;
						refresh();
					}}
				/>
			</div>

			<div class="flex justify-end gap-2 mt-4">
				<Button on:click={() => commit()} variant="fill">Save</Button>
				<Button on:click={handleModalClose}>Cancel</Button>
			</div>
		</Form>
	</div>
</Dialog>

<Dialog open={openThermocouple} on:close={handleThermocoupleClose}>
	<div slot="title">{isNewThermocouple ? 'Create New Thermocouple' : 'Edit Thermocouple Metadata'}</div>
	<div class="p-4">
		<Form initial={selectedMetadata} on:change={handleMetadataSubmit} let:commit let:draft let:refresh>
			<div class="p-4 grid grid-cols-2 gap-4">
				<h3 class="col-span-2 font-bold mt-4">Device Information</h3>
				<TextField
					label="Device ID"
					value={draft.deviceID}
					on:change={(e) => {
						draft.deviceID = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Port ID"
					value={draft.port.portID}
					on:change={(e) => {
						draft.port.portID = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Port Description"
					value={draft.port.portDescription}
					on:change={(e) => {
						draft.port.portDescription = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Port Size Standard"
					value={draft.port.portSizeStandard}
					on:change={(e) => {
						draft.port.portSizeStandard = e.detail.value;
						refresh();
					}}
				/>

				<h3 class="col-span-2 font-bold mt-4">Thermocouple</h3>
				<TextField
					label="Status"
					value={draft.diagnostic.status}
					on:change={(e) => {
						draft.diagnostic.status = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Attachment"
					value={draft.diagnostic.attachment}
					on:change={(e) => {
						draft.diagnostic.attachment = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="TC Type"
					value={draft.diagnostic.tcType}
					on:change={(e) => {
						draft.diagnostic.tcType = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Location"
					value={draft.diagnostic.location}
					on:change={(e) => {
						draft.diagnostic.location = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Area Type"
					value={draft.diagnostic.areaType}
					on:change={(e) => {
						draft.diagnostic.areaType = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Circle Diameter"
					value={draft.diagnostic.circleDiameter}
					on:change={(e) => {
						draft.diagnostic.circleDiameter = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Noise Floor"
					value={draft.diagnostic.noiseFloor}
					on:change={(e) => {
						draft.diagnostic.noiseFloor = e.detail.value;
						refresh();
					}}
				/>
			</div>

			<div class="flex justify-end gap-2 mt-4">
				<Button on:click={() => commit()} variant="fill">Save</Button>
				<Button on:click={handleThermocoupleClose}>Cancel</Button>
			</div>
		</Form>
	</div>
</Dialog>

<Dialog open={openCamera} on:close={handleCameraClose}>
	<div slot="title">{isNewEntry ? 'Create New Camera' : 'Edit Camera Metadata'}</div>
	<div class="p-4">
		<Form initial={selectedMetadata} on:change={handleMetadataSubmit} let:commit let:draft let:refresh>
			<div class="p-4 grid grid-cols-3 gap-4">
				<h3 class="col-span-3 font-bold mt-4">Device Information</h3>
				<TextField
					label="Device ID"
					value={draft.deviceID}
					on:change={(e) => {
						draft.deviceID = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Port ID"
					value={draft.port.portID}
					on:change={(e) => {
						draft.port.portID = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Port Description"
					value={draft.port.portDescription}
					on:change={(e) => {
						draft.port.portDescription = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Port Size Standard"
					value={draft.port.portSizeStandard}
					on:change={(e) => {
						draft.port.portSizeStandard = e.detail.value;
						refresh();
					}}
				/>

				<h3 class="col-span-3 font-bold mt-4">Camera Information</h3>
				<TextField
					label="Make"
					value={draft.diagnostic?.cameraInformation?.make ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.cameraInformation) draft.diagnostic.cameraInformation = {};
						draft.diagnostic.cameraInformation.make = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Model"
					value={draft.diagnostic?.cameraInformation?.model ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.cameraInformation) draft.diagnostic.cameraInformation = {};
						draft.diagnostic.cameraInformation.model = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Serial Number"
					value={draft.diagnostic?.cameraInformation?.serialNumber ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.cameraInformation) draft.diagnostic.cameraInformation = {};
						draft.diagnostic.cameraInformation.serialNumber = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Resolution X"
					value={draft.diagnostic?.cameraInformation?.resolutionX ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.cameraInformation) draft.diagnostic.cameraInformation = {};
						draft.diagnostic.cameraInformation.resolutionX = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Resolution Y"
					value={draft.diagnostic?.cameraInformation?.resolutionY ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.cameraInformation) draft.diagnostic.cameraInformation = {};
						draft.diagnostic.cameraInformation.resolutionY = e.detail.value;
						refresh();
					}}
				/>

				<h3 class="col-span-3 font-bold mt-4">Lens Information</h3>
				<TextField
					label="Make"
					value={draft.diagnostic?.lensInformation?.make ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.lensInformation) draft.diagnostic.lensInformation = {};
						draft.diagnostic.lensInformation.make = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Model"
					value={draft.diagnostic?.lensInformation?.model ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.lensInformation) draft.diagnostic.lensInformation = {};
						draft.diagnostic.lensInformation.model = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Serial Number"
					value={draft.diagnostic?.lensInformation?.serialNumber ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.lensInformation) draft.diagnostic.lensInformation = {};
						draft.diagnostic.lensInformation.serialNumber = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Focal Length"
					value={draft.diagnostic?.lensInformation?.focalLength ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.lensInformation) draft.diagnostic.lensInformation = {};
						draft.diagnostic.lensInformation.focalLength = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Aperture"
					value={draft.diagnostic?.lensInformation?.aperture ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.lensInformation) draft.diagnostic.lensInformation = {};
						draft.diagnostic.lensInformation.aperture = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Field of View X"
					value={draft.diagnostic?.lensInformation?.fieldOfViewX ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.lensInformation) draft.diagnostic.lensInformation = {};
						draft.diagnostic.lensInformation.fieldOfViewX = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Field of View Y"
					value={draft.diagnostic?.lensInformation?.fieldOfViewY ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.lensInformation) draft.diagnostic.lensInformation = {};
						draft.diagnostic.lensInformation.fieldOfViewY = e.detail.value;
						refresh();
					}}
				/>

				<h3 class="col-span-3 font-bold mt-4">Capture Settings</h3>
				<TextField
					label="Image Acquisition Rate"
					value={draft.diagnostic?.captureSettings?.imageAcquisitionRate ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.captureSettings) draft.diagnostic.captureSettings = {};
						draft.diagnostic.captureSettings.imageAcquisitionRate = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Image Noise"
					value={draft.diagnostic?.captureSettings?.imageNoise ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.captureSettings) draft.diagnostic.captureSettings = {};
						draft.diagnostic.captureSettings.imageNoise = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Image Scale"
					value={draft.diagnostic?.captureSettings?.imageScale ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.captureSettings) draft.diagnostic.captureSettings = {};
						draft.diagnostic.captureSettings.imageScale = e.detail.value;
						refresh();
					}}
				/>
			</div>

			<div class="flex justify-end gap-2 mt-4">
				<Button on:click={() => commit()} variant="fill">Save</Button>
				<Button on:click={handleCameraClose}>Cancel</Button>
			</div>
		</Form>
	</div>
</Dialog>

<Dialog open={openDIC} on:close={handleDICClose}>
	<div slot="title">{isNewEntry ? 'Create New DIC' : 'Edit DIC Metadata'}</div>
	<div class="p-4">
		<Form initial={selectedMetadata} on:change={handleMetadataSubmit} let:commit let:draft let:refresh>
			<div class="p-4 grid grid-cols-3 gap-4">
				<h3 class="col-span-3 font-bold mt-4">Device Information</h3>
				<TextField
					label="Device ID"
					value={draft.deviceID}
					on:change={(e) => {
						draft.deviceID = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Port ID"
					value={draft.port.portID}
					on:change={(e) => {
						draft.port.portID = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Port Description"
					value={draft.port.portDescription}
					on:change={(e) => {
						draft.port.portDescription = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Port Size Standard"
					value={draft.port.portSizeStandard}
					on:change={(e) => {
						draft.port.portSizeStandard = e.detail.value;
						refresh();
					}}
				/>

				<h3 class="col-span-3 font-bold mt-4">Setup Information</h3>
				<TextField
					label="Configuration"
					value={draft.diagnostic?.setupInformation?.configuration ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.setupInformation) draft.diagnostic.setupInformation = {};
						draft.diagnostic.setupInformation.configuration = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Stereo Angle"
					value={draft.diagnostic?.setupInformation?.stereoAngle ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.setupInformation) draft.diagnostic.setupInformation = {};
						draft.diagnostic.setupInformation.stereoAngle = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Stand Off Distance"
					value={draft.diagnostic?.setupInformation?.standOffDistance ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.setupInformation) draft.diagnostic.setupInformation = {};
						draft.diagnostic.setupInformation.standOffDistance = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Imaged Surface On Specimen"
					value={draft.diagnostic?.setupInformation?.imagedSurfaceOnSpecimen ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.setupInformation) draft.diagnostic.setupInformation = {};
						draft.diagnostic.setupInformation.imagedSurfaceOnSpecimen = e.detail.value;
						refresh();
					}}
				/>

				<h3 class="col-span-3 font-bold mt-4">Software Information</h3>
				<TextField
					label="Software Name"
					value={draft.diagnostic?.softwareInformation?.softwareName ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.softwareInformation) draft.diagnostic.softwareInformation = {};
						draft.diagnostic.softwareInformation.softwareName = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Software Version"
					value={draft.diagnostic?.softwareInformation?.softwareVersion ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.softwareInformation) draft.diagnostic.softwareInformation = {};
						draft.diagnostic.softwareInformation.softwareVersion = e.detail.value;
						refresh();
					}}
				/>

				<h3 class="col-span-3 font-bold mt-4">Additional Information</h3>
				<TextField
					label="Pattern Technique"
					value={draft.diagnostic?.additionalInformation?.patternTechnique ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.additionalInformation) draft.diagnostic.additionalInformation = {};
						draft.diagnostic.additionalInformation.patternTechnique = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Pattern Background"
					value={draft.diagnostic?.additionalInformation?.patternBackground ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.additionalInformation) draft.diagnostic.additionalInformation = {};
						draft.diagnostic.additionalInformation.patternBackground = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Pattern Speckle"
					value={draft.diagnostic?.additionalInformation?.patternSpeckle ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.additionalInformation) draft.diagnostic.additionalInformation = {};
						draft.diagnostic.additionalInformation.patternSpeckle = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Approx Feature Size"
					value={draft.diagnostic?.additionalInformation?.approxFeatureSize ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.additionalInformation) draft.diagnostic.additionalInformation = {};
						draft.diagnostic.additionalInformation.approxFeatureSize = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Cal Target Make"
					value={draft.diagnostic?.additionalInformation?.calTargetMake ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.additionalInformation) draft.diagnostic.additionalInformation = {};
						draft.diagnostic.additionalInformation.calTargetMake = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Cal Target Dims"
					value={draft.diagnostic?.additionalInformation?.calTargetDims ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.additionalInformation) draft.diagnostic.additionalInformation = {};
						draft.diagnostic.additionalInformation.calTargetDims = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Cal Target Spacing"
					value={draft.diagnostic?.additionalInformation?.calTargetSpacing ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.additionalInformation) draft.diagnostic.additionalInformation = {};
						draft.diagnostic.additionalInformation.calTargetSpacing = e.detail.value;
						refresh();
					}}
				/>

				<h3 class="col-span-3 font-bold mt-4">Camera Setup</h3>
				<TextField
					label="Comment"
					value={draft.diagnostic?.cameraSetup?.comment ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.cameraSetup) draft.diagnostic.cameraSetup = {};
						draft.diagnostic.cameraSetup.comment = e.detail.value;
						refresh();
					}}
				/>
				<TextField
					label="Camera IDs (comma-separated)"
					value={draft.diagnostic?.cameraSetup?.cameras?.join(', ') ?? ''}
					on:change={(e) => {
						if (!draft.diagnostic) draft.diagnostic = {};
						if (!draft.diagnostic.cameraSetup) draft.diagnostic.cameraSetup = {};
						draft.diagnostic.cameraSetup.cameras = e.detail.value.split(',').map((id) => id.trim());
						refresh();
					}}
				/>
			</div>

			<div class="flex justify-end gap-2 mt-4">
				<Button on:click={() => commit()} variant="fill">Save</Button>
				<Button on:click={handleDICClose}>Cancel</Button>
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
