import Zod from "zod";
import { RunMetadata } from "./RunMetadata";
import { PulseProcessedMetadata } from "./PulseProcessedMetadata";
import { PulseAnnotationMetadata } from "./PulseAnnotationMetadata";

export class PulseCombinedMetadata {
    // Pulse identity
    pulseNumber: number;
    sequenceNumber: number;

    //Run Metadata
    runData: RunMetadata;

    // Postprocess outputs
    processedData: PulseProcessedMetadata;

    // Annotation
    annotationData: PulseAnnotationMetadata;

    constructor() {
        this.pulseNumber = 0;
        this.sequenceNumber = 0;
        this.runData = new RunMetadata();
        this.processedData = new PulseProcessedMetadata();
        this.annotationData = new PulseAnnotationMetadata();
    }

    static fromJSON(json: any): PulseCombinedMetadata {
        const p = new PulseCombinedMetadata();
        p.pulseNumber = json.pulseNumber ?? 0;
        p.sequenceNumber = json.sequenceNumber ?? 0;
        p.runData = json.runData ? RunMetadata.fromJSON(json.runData) : new RunMetadata();
        p.processedData = json.processedData ? PulseProcessedMetadata.fromJSON(json.processedData) : new PulseProcessedMetadata();
        p.annotationData = json.annotationData ? PulseAnnotationMetadata.fromJSON(json.annotationData) : new PulseAnnotationMetadata();
        return p;
    }

    static toJSON(p: PulseCombinedMetadata): any {
        return {
            pulseNumber: p.pulseNumber,
            sequenceNumber: p.sequenceNumber,
            runData: RunMetadata.toJSON(p.runData),
            processedData: PulseProcessedMetadata.toJSON(p.processedData),
            annotationData: PulseAnnotationMetadata.toJSON(p.annotationData)
        };
    }
}
