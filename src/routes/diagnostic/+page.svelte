<script lang="ts">
	import { onMount } from 'svelte';
	import { writable, type Writable } from 'svelte/store';
	import { Button, ExpansionPanel, Field, Input } from 'svelte-ux';
	import { mdiPlus, mdiTrashCan } from '@mdi/js';
	import { v4 as uuidv4 } from 'uuid';
	import { PUBLIC_ROOT_FOLDER_LOCATION } from '$env/static/public';

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
		cameras: CameraDiagnostics[];

		constructor() {
			this.comment = '';
			this.cameras = [];
		}
	}

	class CameraDiagnostics {
		cameraInformation: CameraInformation;
		lensInformation: LensInformation;
		captureSettings: CaptureSettings;

		constructor() {
			this.cameraInformation = new CameraInformation();
			this.lensInformation = new LensInformation();
			this.captureSettings = new CaptureSettings();
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

	// Base class
	class DeviceMetadata {
		port: Port;
		deviceID: string;

		constructor() {
			this.port = new Port();
			this.deviceID = uuidv4();
		}
	}

	// Derived classes
	class ThermocoupleMetadata extends DeviceMetadata {
		diagnostic: Thermocouple;

		constructor() {
			super();
			this.diagnostic = new Thermocouple();
		}
	}

	class CameraMetadata extends DeviceMetadata {
		cameraInformation: CameraInformation;
		lensInformation: LensInformation;
		captureSettings: CaptureSettings;

		constructor() {
			super();
			this.cameraInformation = new CameraInformation();
			this.lensInformation = new LensInformation();
			this.captureSettings = new CaptureSettings();
		}
	}

	class DICMetadata extends DeviceMetadata {
		diagnostic: DICConfig;

		constructor() {
			super();
			this.diagnostic = new DICConfig();
		}
	}

	class SaveMetadata {
		targetPath: string;
		metadata: DeviceMetadata;

		constructor() {
			this.targetPath = '';
			this.metadata = new DeviceMetadata();
		}
	}

	const fullThermoMetadata = writable<ThermocoupleMetadata>(new ThermocoupleMetadata());
	const fullCameraMetadata = writable<CameraMetadata>(new CameraMetadata());
	const fullDICMetadata = writable<DICMetadata>(new DICMetadata());
	let baseThermoSaveLocation: string = PUBLIC_ROOT_FOLDER_LOCATION + '/diagnostics' + '/hive_diagnostic_thermocouple.json';
	let currentThermoSaveLocation: string = baseThermoSaveLocation;

	let baseCameraSaveLocation: string = PUBLIC_ROOT_FOLDER_LOCATION + '/diagnostics' + '/hive_diagnostic_camera.json';
	let currentCameraSaveLocation: string = baseCameraSaveLocation;

	let baseDICSaveLocation: string = PUBLIC_ROOT_FOLDER_LOCATION + '/diagnostics' + '/hive_diagnostic_dic.json';
	let currentDICSaveLocation: string = baseDICSaveLocation;

	let currentThermoMetadata: ThermocoupleMetadata;
	fullThermoMetadata.subscribe((value) => {
		currentThermoMetadata = value;
	});

	let currentCameraMetadata: CameraMetadata;
	fullCameraMetadata.subscribe((value) => {
		currentCameraMetadata = value;
	});

	let currentDICMetadata: DICMetadata;
	fullDICMetadata.subscribe((value) => {
		currentDICMetadata = value;
	});

	onMount(() => {});

	function resetThermocoupleForm() {
		fullThermoMetadata.set(new ThermocoupleMetadata());
		currentThermoSaveLocation = baseThermoSaveLocation;
	}

	function resetCameraForm() {
		fullCameraMetadata.set(new CameraMetadata());
		currentCameraSaveLocation = baseCameraSaveLocation;
	}

	function resetDICForm() {
		fullDICMetadata.set(new DICMetadata());
		currentDICSaveLocation = baseDICSaveLocation;
	}

	async function handleThermocoupleSubmit() {
		try {
			let saveMetadata: SaveMetadata = {
				targetPath: currentThermoSaveLocation,
				metadata: currentThermoMetadata
			};

			const response = await fetch('/api/save-json', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(saveMetadata)
			});

			if (response.ok) {
				alert('Thermocouple metadata saved successfully!');
			} else {
				const errorData = await response.json();
				alert(`Error saving thermocouple metadata: ${errorData.message}`);
			}
		} catch (error) {
			console.error('Error:', error);
			alert('An error occurred while saving the thermocouple metadata.');
		}
	}

	async function handleCameraSubmit() {
		try {
			let saveMetadata: SaveMetadata = {
				targetPath: currentCameraSaveLocation,
				metadata: currentCameraMetadata
			};

			const response = await fetch('/api/save-json', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(saveMetadata)
			});

			if (response.ok) {
				alert('Camera metadata saved successfully!');
			} else {
				const errorData = await response.json();
				alert(`Error saving camera metadata: ${errorData.message}`);
			}
		} catch (error) {
			console.error('Error:', error);
			alert('An error occurred while saving the camera metadata.');
		}
	}

	async function handleDICSubmit() {
		try {
			let saveMetadata: SaveMetadata = {
				targetPath: currentDICSaveLocation,
				metadata: currentDICMetadata
			};

			const response = await fetch('/api/save-json', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(saveMetadata)
			});

			if (response.ok) {
				alert('DIC metadata saved successfully!');
			} else {
				const errorData = await response.json();
				alert(`Error saving DIC metadata: ${errorData.message}`);
			}
		} catch (error) {
			console.error('Error:', error);
			alert('An error occurred while saving the DIC metadata.');
		}
	}

	function exportThermocoupleForm() {
		const blob = new Blob([JSON.stringify(currentThermoMetadata, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		const date = new Date();
		const filename = `hive_diagnostic_thermocouple_${date.toISOString().replace(/[:T]/g, '-').slice(0, -5)}.json`;
		a.download = filename;

		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);

		URL.revokeObjectURL(url);
	}

	function exportCameraForm() {
		const blob = new Blob([JSON.stringify(currentCameraMetadata, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		const date = new Date();
		const filename = `hive_diagnostic_camera_${date.toISOString().replace(/[:T]/g, '-').slice(0, -5)}.json`;
		a.download = filename;

		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);

		URL.revokeObjectURL(url);
	}

	function exportDICForm() {
		const blob = new Blob([JSON.stringify(currentDICMetadata, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);

		const a = document.createElement('a');
		a.href = url;
		const date = new Date();
		const filename = `hive_diagnostic_dic_${date.toISOString().replace(/[:T]/g, '-').slice(0, -5)}.json`;
		a.download = filename;

		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);

		URL.revokeObjectURL(url);
	}
</script>

<div class="flex flex-col items-center justify-start min-h-screen bg-neutral p-4 w-full">
	<div class="w-full max-w-screen-xl diagnosticforms">
		<div>
			<ExpansionPanel class="hivepanel">
				<div slot="trigger" class="flex-1 p-3">Thermocouple</div>
				<div class="p-4 grid grid-cols-2 gap-4">
					<Field label="Device ID">
						<Input placeholder="Device identifier" bind:value={currentThermoMetadata.deviceID} />
					</Field>
					<Field label="Port ID">
						<Input placeholder="Port identifier" bind:value={currentThermoMetadata.port.portID} />
					</Field>
					<Field label="Port Description">
						<Input placeholder="Port description" bind:value={currentThermoMetadata.port.portDescription} />
					</Field>
					<Field label="Port Size Standard">
						<Input placeholder="Port size standard" bind:value={currentThermoMetadata.port.portSizeStandard} />
					</Field>
					<Field label="Status">
						<Input placeholder="Active / Failed before test" bind:value={currentThermoMetadata.diagnostic.status} />
					</Field>
					<Field label="Attachment">
						<Input placeholder="e.g., spot weld with inert gas shield" bind:value={currentThermoMetadata.diagnostic.attachment} />
					</Field>
					<Field label="TC Type">
						<Input placeholder="e.g., K" bind:value={currentThermoMetadata.diagnostic.tcType} />
					</Field>
					<Field label="Location">
						<Input placeholder="X, Y, Z coordinates" bind:value={currentThermoMetadata.diagnostic.location} />
					</Field>
					<Field label="Area Type">
						<Input placeholder="e.g., Circular" bind:value={currentThermoMetadata.diagnostic.areaType} />
					</Field>
					<Field label="Circle Diameter">
						<Input placeholder="Diameter in mm" type="number" bind:value={currentThermoMetadata.diagnostic.circleDiameter} />
					</Field>
					<Field label="Noise Floor">
						<Input placeholder="Noise details" bind:value={currentThermoMetadata.diagnostic.noiseFloor} />
					</Field>
					<div>
						<Field label="Save Location">
							<Input placeholder="Save location" bind:value={currentThermoSaveLocation} />
						</Field>
					</div>					
				</div>		
			</ExpansionPanel>
	
			<div class="button-group w-full max-w-screen-xl">
				<div class="left-buttons">
					<button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" on:click={exportThermocoupleForm}>Download</button>
				</div>
				<div class="right-buttons">
					<button class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600" on:click={resetThermocoupleForm}>Reset</button>
					<button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" on:click={handleThermocoupleSubmit}>Submit</button>
				</div>
			</div>
		</div>

		<div>
			<ExpansionPanel class="hivepanel">
				<div slot="trigger" class="flex-1 p-3">Camera</div>
				<div class="p-4 grid grid-cols-2 gap-4">
					<Field label="Device ID">
						<Input placeholder="Device identifier" bind:value={currentCameraMetadata.deviceID} />
					</Field>					
					<Field label="Make">
						<Input placeholder="Camera make" bind:value={currentCameraMetadata.cameraInformation.make} />
					</Field>
					<Field label="Model">
						<Input placeholder="Camera model" bind:value={currentCameraMetadata.cameraInformation.model} />
					</Field>
					<Field label="Serial Number">
						<Input placeholder="Camera serial number" bind:value={currentCameraMetadata.cameraInformation.serialNumber} />
					</Field>
					<Field label="Resolution X">
						<Input placeholder="Resolution in pixels" bind:value={currentCameraMetadata.cameraInformation.resolutionX} />
					</Field>
					<Field label="Resolution Y">
						<Input placeholder="Resolution in pixels" bind:value={currentCameraMetadata.cameraInformation.resolutionY} />
					</Field>
					<Field label="Lens Make">
						<Input placeholder="Lens make" bind:value={currentCameraMetadata.lensInformation.make} />
					</Field>
					<Field label="Lens Model">
						<Input placeholder="Lens model" bind:value={currentCameraMetadata.lensInformation.model} />
					</Field>
					<Field label="Lens Serial Number">
						<Input placeholder="Lens serial number" bind:value={currentCameraMetadata.lensInformation.serialNumber} />
					</Field>
					<Field label="Focal Length">
						<Input placeholder="Focal length in mm" bind:value={currentCameraMetadata.lensInformation.focalLength} />
					</Field>
					<Field label="Aperture">
						<Input placeholder="Aperture" bind:value={currentCameraMetadata.lensInformation.aperture} />
					</Field>
					<Field label="Field of View X">
						<Input placeholder="Field of view in mm" bind:value={currentCameraMetadata.lensInformation.fieldOfViewX} />
					</Field>
					<Field label="Field of View Y">
						<Input placeholder="Field of view in mm" bind:value={currentCameraMetadata.lensInformation.fieldOfViewY} />
					</Field>
					<Field label="Image Acquisition Rate">
						<Input placeholder="Rate in Hz" bind:value={currentCameraMetadata.captureSettings.imageAcquisitionRate} />
					</Field>
					<Field label="Image Noise">
						<Input placeholder="Noise percentage" bind:value={currentCameraMetadata.captureSettings.imageNoise} />
					</Field>
					<Field label="Image Scale">
						<Input placeholder="Scale in mm/pixel" bind:value={currentCameraMetadata.captureSettings.imageScale} />
					</Field>
					<div>
						<Field label="Save Location">
							<Input placeholder="Save location" bind:value={currentCameraSaveLocation} />
						</Field>
					</div>
				</div>
			</ExpansionPanel>

			<div class="button-group w-full max-w-screen-xl">
				<div class="left-buttons">
					<button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" on:click={exportCameraForm}>Download</button>
				</div>
				<div class="right-buttons">
					<button class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600" on:click={resetCameraForm}>Reset</button>
					<button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" on:click={handleCameraSubmit}>Submit</button>
				</div>
			</div>
		</div>
		
		<div>
			<ExpansionPanel class="hivepanel">
				<div slot="trigger" class="flex-1 p-3">Digital Image Correlation</div>
				<div class="p-4 grid grid-cols-2 gap-4">
					<Field label="Device ID">
						<Input placeholder="Device identifier" bind:value={currentDICMetadata.deviceID} />
					</Field>					
					<Field label="Port ID">
						<Input placeholder="Port identifier" bind:value={currentDICMetadata.port.portID} />
					</Field>
					<Field label="Port Description">
						<Input placeholder="Port description" bind:value={currentDICMetadata.port.portDescription} />
					</Field>
					<Field label="Port Size Standard">
						<Input placeholder="Port size standard" bind:value={currentDICMetadata.port.portSizeStandard} />
					</Field>
					<Field label="Configuration">
						<Input placeholder="Configuration details" bind:value={currentDICMetadata.diagnostic.setupInformation.configuration} />
					</Field>
					<Field label="Stereo Angle">
						<Input placeholder="Angle in degrees" bind:value={currentDICMetadata.diagnostic.setupInformation.stereoAngle} />
					</Field>
					<Field label="Stand Off Distance">
						<Input placeholder="Distance in mm" bind:value={currentDICMetadata.diagnostic.setupInformation.standOffDistance} />
					</Field>
					<Field label="Imaged Surface on Specimen">
						<Input placeholder="Surface details" bind:value={currentDICMetadata.diagnostic.setupInformation.imagedSurfaceOnSpecimen} />
					</Field>
					<Field label="Software Name">
						<Input placeholder="Software name" bind:value={currentDICMetadata.diagnostic.softwareInformation.softwareName} />
					</Field>
					<Field label="Software Version">
						<Input placeholder="Software version" bind:value={currentDICMetadata.diagnostic.softwareInformation.softwareVersion} />
					</Field>
					<Field label="Pattern Technique">
						<Input placeholder="Pattern technique" bind:value={currentDICMetadata.diagnostic.additionalInformation.patternTechnique} />
					</Field>
					<Field label="Pattern Background">
						<Input placeholder="Pattern background" bind:value={currentDICMetadata.diagnostic.additionalInformation.patternBackground} />
					</Field>
					<Field label="Pattern Speckle">
						<Input placeholder="Pattern speckle" bind:value={currentDICMetadata.diagnostic.additionalInformation.patternSpeckle} />
					</Field>
					<Field label="Approx Feature Size">
						<Input placeholder="Feature size in mm" type="number" bind:value={currentDICMetadata.diagnostic.additionalInformation.approxFeatureSize} />
					</Field>
					<Field label="Cal Target Make">
						<Input placeholder="Calibration target make" bind:value={currentDICMetadata.diagnostic.additionalInformation.calTargetMake} />
					</Field>
					<Field label="Cal Target Dims">
						<Input placeholder="Calibration target dimensions" bind:value={currentDICMetadata.diagnostic.additionalInformation.calTargetDims} />
					</Field>
					<Field label="Cal Target Spacing">
						<Input placeholder="Calibration target spacing" bind:value={currentDICMetadata.diagnostic.additionalInformation.calTargetSpacing} />
					</Field>
					<Field label="Comment">
						<Input placeholder="Comment" bind:value={currentDICMetadata.diagnostic.cameraSetup.comment} />
					</Field>
					<div>
						<Field label="Save Location">
							<Input placeholder="Save location" bind:value={currentDICSaveLocation} />
						</Field>
					</div>
				</div>
			</ExpansionPanel>

			<div class="button-group w-full max-w-screen-xl">
				<div class="left-buttons">
					<button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" on:click={exportDICForm}>Download</button>
				</div>
				<div class="right-buttons">
					<button class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600" on:click={resetDICForm}>Reset</button>
					<button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" on:click={handleDICSubmit}>Submit</button>
				</div>
			</div>
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

	.diagnosticforms {
		display: flex;
		flex-direction: column;
		gap: 30px;
	}

</style>
