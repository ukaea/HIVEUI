import Zod from "zod";

export class PulseAnnotationMetadata {
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

    static fromJSON(json: any): PulseAnnotationMetadata {
        const a = new PulseAnnotationMetadata();
        a.pulseQuality = json.pulseQuality || '';
        a.comment = json.comment || '';
        return a;
    }

    static toJSON(a: PulseAnnotationMetadata): any {
        return {
            pulseQuality: a.pulseQuality,
            comment: a.comment
        };
    }
}
