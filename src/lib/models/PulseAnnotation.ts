import Zod from "zod";

export class PulseAnnotation {
    pulseQuality: string;
    comment: string;

    static schema = Zod.object({
        pulseQuality: Zod.enum(["Success", "Fail"]),
        comment: Zod.string().optional(),
    });

    constructor() {
        this.pulseQuality = '';
        this.comment = '';
    }

    static fromJSON(json: any): PulseAnnotation {
        const annotation = new PulseAnnotation();
        annotation.pulseQuality = json.pulseQuality || '';
        annotation.comment = json.comment || '';
        return annotation;
    }

    static toJSON(metadata: PulseAnnotation): any {
        return {
            pulseQuality: metadata.pulseQuality,
            comment: metadata.comment
        };
    }
}
