import { env } from '$env/dynamic/private';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { mkdir, writeFile } from 'fs/promises';
import { join, normalize, resolve } from 'path';

function generateProcessedMetadata(pulseNumber: number, sequenceNumber: number) {
    const baseTimestamp = new Date('2025-06-15T10:30:00');
    const offsetMs = (pulseNumber - 1) * 60000 + (sequenceNumber - 1) * 5000;
    const start = new Date(baseTimestamp.getTime() + offsetMs);
    const end = new Date(start.getTime() + 45000);
    const captureStart = new Date(start.getTime() - 5000);

    return {
        powerSupplyReportedPower: `${4000 + pulseNumber * 200 + sequenceNumber * 50}W`,
        pulseStartTimestamp: start.toISOString(),
        pulseEndTimestamp: end.toISOString(),
        dataCaptureStartTimestamp: captureStart.toISOString(),
        heatingInformation: {
            measuredPower: 4000 + pulseNumber * 100 + sequenceNumber * 25,
            outputFrequency: 150 + sequenceNumber * 10,
            outputVoltage: 370 + pulseNumber * 5,
            outputCurrent: 10 + pulseNumber + sequenceNumber
        },
        coolantInformation: {
            coolantFlow: 5.0 + sequenceNumber * 0.2,
            coolantFlowVariance: 0.1,
            coolantPressureIn: 2.5,
            coolantPressureOut: 2.0,
            deltaPressure: 0.5,
            coolantTemperatureIn: 20 + sequenceNumber,
            coolantTemperatureInVariance: 0.5,
            coolantTemperatureOut: 35 + sequenceNumber,
            coolantTemperatureOutVariance: 0.8,
            deltaTemperature: 15,
            thermocoupleInformation: {
                thermocoupleID: `TC-${pulseNumber}-${sequenceNumber}`,
                maxValue: 800 + pulseNumber * 50 + sequenceNumber * 10
            }
        }
    };
}

export const POST: RequestHandler = async ({ request, locals }) => {
    if (env.AUTHN_ENABLE === 'true') {
        if (!locals.user) {
            throw error(401, 'Unauthorized: No active session');
        }

        if (env.AUTHZ_ENABLE === 'true') {
            const requiredGroup = env.AUTHZ_REQUIRED_GROUP;
            if (requiredGroup && !(locals.user as any).groups?.includes(requiredGroup)) {
                throw error(403, 'Forbidden: Insufficient permissions');
            }
        }
    }

    try {
        const body = await request.json();
        const { experimentNumber, sampleNumber, runNumber, pulseCount, sequenceCount } = body;

        if (!experimentNumber || !sampleNumber || !runNumber) {
            throw error(400, 'experimentNumber, sampleNumber, and runNumber are required');
        }

        const numPulses = pulseCount || 3;
        const numSequences = sequenceCount || 2;

        const rootFolder = env.ROOT_FOLDER_LOCATION;
        if (!rootFolder) {
            throw new Error('ROOT_FOLDER_LOCATION is not set in environment variables');
        }

        const relativePath = `E-${experimentNumber}/S-${sampleNumber}/R-${runNumber}`;
        const sanitizedPath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
        const runPath = resolve(rootFolder, sanitizedPath);

        if (!runPath.startsWith(resolve(rootFolder))) {
            throw error(403, 'Access denied: Invalid file path');
        }

        const pulses: Array<{ pulseNumber: number; sequenceNumber: number }> = [];
        for (let p = 1; p <= numPulses; p++) {
            for (let s = 1; s <= numSequences; s++) {
                const seqDir = join(runPath, `P-${p}`, `Seq-${s}`);
                await mkdir(seqDir, { recursive: true });
                const metadata = generateProcessedMetadata(p, s);
                await writeFile(
                    join(seqDir, 'processed_metadata.json'),
                    JSON.stringify(metadata, null, 2)
                );
                pulses.push({ pulseNumber: p, sequenceNumber: s });
            }
        }

        return json({
            success: true,
            message: `Created ${numPulses} pulses with ${numSequences} sequences each`,
            pulseCount: numPulses,
            sequenceCount: numSequences,
            pulses
        });

    } catch (err: any) {
        console.error('Error seeding test data:', err);
        if (err.status) throw err;
        throw error(500, err.message || 'Internal server error seeding test data');
    }
};
