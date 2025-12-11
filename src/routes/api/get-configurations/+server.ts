import { json, error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
    try {
        const db = getDb();

        // 1. Fetch all configurations
        const configs = db.prepare(`
            SELECT id, name, description 
            FROM configurations
        `).all() as any[];

        // 2. Map them to the JSON structure your Model expects
        const responseData = configs.map(config => {
            // Get related combination IDs for this specific config
            const combinationRows = db.prepare(`
                SELECT combination_id 
                FROM config_combinations 
                WHERE config_id = ?
            `).all(config.id) as { combination_id: number }[];

            // Extract just the IDs array
            const combinationIds = combinationRows.map(row => row.combination_id);

            return {
                configurationId: config.id,
                configurationName: config.name,
                configurationDescription: config.description,
                // The client model expects an array of numbers here to trigger its own .map()
                equipmentCombinations: combinationIds 
            };
        });

        return json(responseData);

    } catch (err: any) {
        console.error('Database Error:', err);
        throw error(500, 'Failed to retrieve configurations');
    }
};