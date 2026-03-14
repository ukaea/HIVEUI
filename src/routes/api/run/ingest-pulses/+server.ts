import { env } from '$env/dynamic/private';
import { getForwardJqScript, hasJqMapping } from '$lib/services/MappingService';
import { error, json } from '@sveltejs/kit';
import jq from 'node-jq';
import type { RequestHandler } from './$types';

const MAPPING_TARGET = 'datasets';

export const POST: RequestHandler = async ({ request, fetch, locals }) => {
    // --- AUTHENTICATION & AUTHORIZATION ---
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

    const token = locals.user?.accessToken;

    try {
        const body = await request.json();
        const { pulses } = body;

        if (!Array.isArray(pulses) || pulses.length === 0) {
            throw error(400, 'pulses array is required and must not be empty');
        }

        const metacatBaseUrl = env.METACAT_URL;
        if (!metacatBaseUrl) throw new Error('METACAT_URL not set');

        const headers: HeadersInit = {
            'Content-Type': 'application/json'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const datasetsUrl = `${metacatBaseUrl.replace(/\/$/, '')}/datasets`;

        const results = [];
        for (const pulse of pulses) {
            let dataToSend = pulse;

            // Apply jq mapping if available for datasets
            if (hasJqMapping('forward', MAPPING_TARGET)) {
                const jqScript = await getForwardJqScript(MAPPING_TARGET);
                dataToSend = await jq.run(jqScript, pulse, { input: 'json', output: 'json' });
            }

            const response = await fetch(datasetsUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(dataToSend)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw error(response.status, `Data catalogue ingestion failed for pulse: ${errorText}`);
            }

            results.push(await response.json());
        }

        return json({ success: true, results });

    } catch (err: any) {
        console.error('Error ingesting pulses to data catalogue:', err);
        if (err.status) throw err;
        throw error(500, err.message || 'Internal server error during pulse ingestion');
    }
};
