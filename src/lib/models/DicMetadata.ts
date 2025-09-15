export class DICSetupInformation {
    configuration: string;
    stereoAngle: string;
    standOffDistance: string;
    imagedSurfaceOnSpecimen: string;

    constructor() {
        this.configuration = '';
        this.stereoAngle = '';
        this.standOffDistance = '';
        this.imagedSurfaceOnSpecimen = '';
    }

    static fromJSON(json: any): DICSetupInformation {
        const setup = new DICSetupInformation();
        setup.configuration = json.configuration || '';
        setup.stereoAngle = json.stereoAngle || '';
        setup.standOffDistance = json.standOffDistance || '';
        setup.imagedSurfaceOnSpecimen = json.imagedSurfaceOnSpecimen || '';
        return setup;
    }

    static toJSON(setup: DICSetupInformation): any {
        return {
            configuration: setup.configuration,
            stereoAngle: setup.stereoAngle,
            standOffDistance: setup.standOffDistance,
            imagedSurfaceOnSpecimen: setup.imagedSurfaceOnSpecimen
        };
    }
}

export class DICSoftwareInformation {
    softwareName: string;
    softwareVersion: string;

    constructor() {
        this.softwareName = '';
        this.softwareVersion = '';
    }

    static fromJSON(json: any): DICSoftwareInformation {
        const software = new DICSoftwareInformation();
        software.softwareName = json.softwareName || '';
        software.softwareVersion = json.softwareVersion || '';
        return software;
    }

    static toJSON(software: DICSoftwareInformation): any {
        return {
            softwareName: software.softwareName,
            softwareVersion: software.softwareVersion
        };
    }
}

export class DICAdditionalInformation {
    patternTechnique: string;
    patternBackground: string;
    patternSpeckle: string;
    approxFeatureSize: string;
    calTargetMake: string;
    calTargetDims: string;
    calTargetSpacing: string;

    constructor() {
        this.patternTechnique = '';
        this.patternBackground = '';
        this.patternSpeckle = '';
        this.approxFeatureSize = '';
        this.calTargetMake = '';
        this.calTargetDims = '';
        this.calTargetSpacing = '';
    }

    static fromJSON(json: any): DICAdditionalInformation {
        const additional = new DICAdditionalInformation();
        additional.patternTechnique = json.patternTechnique || '';
        additional.patternBackground = json.patternBackground || '';
        additional.patternSpeckle = json.patternSpeckle || '';
        additional.approxFeatureSize = json.approxFeatureSize || '';
        additional.calTargetMake = json.calTargetMake || '';
        additional.calTargetDims = json.calTargetDims || '';
        additional.calTargetSpacing = json.calTargetSpacing || '';
        return additional;
    }

    static toJSON(additional: DICAdditionalInformation): any {
        return {
            patternTechnique: additional.patternTechnique,
            patternBackground: additional.patternBackground,
            patternSpeckle: additional.patternSpeckle,
            approxFeatureSize: additional.approxFeatureSize,
            calTargetMake: additional.calTargetMake,
            calTargetDims: additional.calTargetDims,
            calTargetSpacing: additional.calTargetSpacing
        };
    }
}

export class DICCameraSetup {
    comment: string;
    cameras: string[];

    constructor() {
        this.comment = '';
        this.cameras = [];
    }

    static fromJSON(json: any): DICCameraSetup {
        const cameraSetup = new DICCameraSetup();
        cameraSetup.comment = json.comment || '';
        cameraSetup.cameras = json.cameras || [];
        return cameraSetup;
    }

    static toJSON(cameraSetup: DICCameraSetup): any {
        return {
            comment: cameraSetup.comment,
            cameras: cameraSetup.cameras
        };
    }
}

export class DicMetadata {
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

    static fromJSON(json: any): DicMetadata {
        const metadata = new DicMetadata();
        metadata.setupInformation = json.setupInformation ? 
            DICSetupInformation.fromJSON(json.setupInformation) : new DICSetupInformation();
        metadata.softwareInformation = json.softwareInformation ? 
            DICSoftwareInformation.fromJSON(json.softwareInformation) : new DICSoftwareInformation();
        metadata.additionalInformation = json.additionalInformation ? 
            DICAdditionalInformation.fromJSON(json.additionalInformation) : new DICAdditionalInformation();
        metadata.cameraSetup = json.cameraSetup ? 
            DICCameraSetup.fromJSON(json.cameraSetup) : new DICCameraSetup();
        return metadata;
    }

    static toJSON(metadata: DicMetadata): any {
        return {
            setupInformation: DICSetupInformation.toJSON(metadata.setupInformation),
            softwareInformation: DICSoftwareInformation.toJSON(metadata.softwareInformation),
            additionalInformation: DICAdditionalInformation.toJSON(metadata.additionalInformation),
            cameraSetup: DICCameraSetup.toJSON(metadata.cameraSetup)
        };
    }
}