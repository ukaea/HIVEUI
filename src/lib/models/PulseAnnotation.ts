import Zod from "zod";

export class PulseAnnotation {
    pulseNumber: number;
    runNumber: number;
    pulseQuality: string;
    comment: string;

    static schema = Zod.object({
        pulseNumber: Zod.number().min(1, 'Pulse Number is required'),
        runNumber: Zod.number().min(1, 'Run Number is required'),
        pulseQuality: Zod.enum(["Success", "Fail"]),
        comment: Zod.string().optional(),
    });

    constructor() {
        this.pulseNumber = 0;
        this.runNumber = 0;
        this.pulseQuality = '';
        this.comment = '';
    }

    static fromJSON(json: any): PulseAnnotation {
        const annotation = new PulseAnnotation();
        annotation.pulseNumber = json.pulseNumber || 0;
        annotation.runNumber = json.runNumber || 0;
        annotation.pulseQuality = json.pulseQuality || '';
        annotation.comment = json.comment || '';
        return annotation;
    }

    static toJSON(metadata: PulseAnnotation): any {
        return {
            pulseNumber: metadata.pulseNumber,
            runNumber: metadata.runNumber,
            pulseQuality: metadata.pulseQuality,
            comment: metadata.comment
        };
    }
}
