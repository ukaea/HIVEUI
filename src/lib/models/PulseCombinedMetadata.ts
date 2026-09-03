import Zod from "zod";
import { RunMetadata } from "./RunMetadata";
import { PulseProcessedMetadata } from "./PulseProcessedMetadata";
import { PulseAnnotationMetadata } from "./PulseAnnotationMetadata";

export class PulseCombinedMetadata {
    // Pulse identity
    pulseId: number;
    seqId: number;

    // Postprocess outputs
    processedData: PulseProcessedMetadata;

    // Annotation
    annotationData: PulseAnnotationMetadata;

    constructor() {
        this.pulseId = 0;
        this.seqId = 0;
        this.processedData = new PulseProcessedMetadata();
        this.annotationData = new PulseAnnotationMetadata();
    }

    static fromJSON(json: any): PulseCombinedMetadata {
        const p = new PulseCombinedMetadata();
        p.pulseId = json.pulseId ?? 0;
        p.seqId = json.seqId ?? 0;
        p.processedData = json.processedData ? PulseProcessedMetadata.fromJSON(json.processedData) : new PulseProcessedMetadata();
        p.annotationData = json.annotationData ? PulseAnnotationMetadata.fromJSON(json.annotationData) : new PulseAnnotationMetadata();
        return p;
    }

    static toJSON(p: PulseCombinedMetadata): any {
        return {
            pulseId: p.pulseId,
            seqId: p.seqId,
            processedData: PulseProcessedMetadata.toJSON(p.processedData),
            annotationData: PulseAnnotationMetadata.toJSON(p.annotationData)
        };
    }
}
