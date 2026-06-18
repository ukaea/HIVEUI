export class ThermocoupleInformation {
    thermocoupleId: string;
    maxValue: number;

    constructor() {
        this.thermocoupleId = '';
        this.maxValue = 0;
    }

    static fromJSON(json: any): ThermocoupleInformation {
        const t = new ThermocoupleInformation();
        t.thermocoupleId = json.thermocoupleId || '';
        t.maxValue = json.maxValue || 0;
        return t;
    }

    static toJSON(t: ThermocoupleInformation): any {
        return { thermocoupleId: t.thermocoupleId, maxValue: t.maxValue };
    }
}

export class ProcessedHeatingInformation {
    measuredPower: number | null;
    outputFrequency: number | null;
    outputVoltage: number | null;
    outputCurrent: number | null;

    constructor() {
        this.measuredPower = null;
        this.outputFrequency = null;
        this.outputVoltage = null;
        this.outputCurrent = null;
    }

    static fromJSON(json: any): ProcessedHeatingInformation {
        const h = new ProcessedHeatingInformation();
        h.measuredPower = json.measuredPower ?? null;
        h.outputFrequency = json.outputFrequency ?? null;
        h.outputVoltage = json.outputVoltage ?? null;
        h.outputCurrent = json.outputCurrent ?? null;
        return h;
    }

    static toJSON(h: ProcessedHeatingInformation): any {
        return {
            measuredPower: h.measuredPower,
            outputFrequency: h.outputFrequency,
            outputVoltage: h.outputVoltage,
            outputCurrent: h.outputCurrent
        };
    }
}

export class ProcessedCoolantInformation {
    coolantFlow: number | null;
    coolantFlowVariance: number | null;
    coolantPressureIn: number | null;
    coolantPressureOut: number | null;
    deltaPressure: number | null;
    coolantTemperatureIn: number | null;
    coolantTemperatureInVariance: number | null;
    coolantTemperatureOut: number | null;
    coolantTemperatureOutVariance: number | null;
    deltaTemperature: number | null;

    constructor() {
        this.coolantFlow = null;
        this.coolantFlowVariance = null;
        this.coolantPressureIn = null;
        this.coolantPressureOut = null;
        this.deltaPressure = null;
        this.coolantTemperatureIn = null;
        this.coolantTemperatureInVariance = null;
        this.coolantTemperatureOut = null;
        this.coolantTemperatureOutVariance = null;
        this.deltaTemperature = null;
    }

    static fromJSON(json: any): ProcessedCoolantInformation {
        const c = new ProcessedCoolantInformation();
        c.coolantFlow = json.coolantFlow ?? null;
        c.coolantFlowVariance = json.coolantFlowVariance ?? null;
        c.coolantPressureIn = json.coolantPressureIn ?? null;
        c.coolantPressureOut = json.coolantPressureOut ?? null;
        c.deltaPressure = json.deltaPressure ?? null;
        c.coolantTemperatureIn = json.coolantTemperatureIn ?? null;
        c.coolantTemperatureInVariance = json.coolantTemperatureInVariance ?? null;
        c.coolantTemperatureOut = json.coolantTemperatureOut ?? null;
        c.coolantTemperatureOutVariance = json.coolantTemperatureOutVariance ?? null;
        c.deltaTemperature = json.deltaTemperature ?? null;
        return c;
    }

    static toJSON(c: ProcessedCoolantInformation): any {
        return {
            coolantFlow: c.coolantFlow,
            coolantFlowVariance: c.coolantFlowVariance,
            coolantPressureIn: c.coolantPressureIn,
            coolantPressureOut: c.coolantPressureOut,
            deltaPressure: c.deltaPressure,
            coolantTemperatureIn: c.coolantTemperatureIn,
            coolantTemperatureInVariance: c.coolantTemperatureInVariance,
            coolantTemperatureOut: c.coolantTemperatureOut,
            coolantTemperatureOutVariance: c.coolantTemperatureOutVariance,
            deltaTemperature: c.deltaTemperature
        };
    }
}

export class PulseProcessedMetadata {
    powerSupplyReportedPower: number | null;
    heatingInformation: ProcessedHeatingInformation;
    coolantInformation: ProcessedCoolantInformation;
    thermocoupleInformation: ThermocoupleInformation[];
    pulseDuration: number;
    pulseStartTimestamp: string;
    pulseEndTimestamp: string;
    dataCaptureStartTimestamp: string;

    constructor() {
        this.powerSupplyReportedPower = null;
        this.heatingInformation = new ProcessedHeatingInformation();
        this.coolantInformation = new ProcessedCoolantInformation();
        this.thermocoupleInformation = [];
        this.pulseDuration = 0;
        this.pulseStartTimestamp = '';
        this.pulseEndTimestamp = '';
        this.dataCaptureStartTimestamp = '';
    }

    static fromJSON(json: any): PulseProcessedMetadata {
        const p = new PulseProcessedMetadata();
        p.powerSupplyReportedPower = json.powerSupplyReportedPower ?? null;
        p.heatingInformation = json.heatingInformation
            ? ProcessedHeatingInformation.fromJSON(json.heatingInformation)
            : new ProcessedHeatingInformation();
        p.coolantInformation = json.coolantInformation
            ? ProcessedCoolantInformation.fromJSON(json.coolantInformation)
            : new ProcessedCoolantInformation();
        p.thermocoupleInformation = Array.isArray(json.thermocoupleInformation)
            ? json.thermocoupleInformation.map(ThermocoupleInformation.fromJSON)
            : [];
        p.pulseDuration = json.pulseDuration || 0;
        p.pulseStartTimestamp = json.pulseStartTimestamp || '';
        p.pulseEndTimestamp = json.pulseEndTimestamp || '';
        p.dataCaptureStartTimestamp = json.dataCaptureStartTimestamp || '';
        return p;
    }

    static toJSON(p: PulseProcessedMetadata): any {
        return {
            powerSupplyReportedPower: p.powerSupplyReportedPower,
            heatingInformation: ProcessedHeatingInformation.toJSON(p.heatingInformation),
            coolantInformation: ProcessedCoolantInformation.toJSON(p.coolantInformation),
            thermocoupleInformation: p.thermocoupleInformation.map(ThermocoupleInformation.toJSON),
            pulseDuration: p.pulseDuration,
            pulseStartTimestamp: p.pulseStartTimestamp,
            pulseEndTimestamp: p.pulseEndTimestamp,
            dataCaptureStartTimestamp: p.dataCaptureStartTimestamp
        };
    }
}
