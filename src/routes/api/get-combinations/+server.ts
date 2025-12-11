import { json, error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
    try {
        const db = getDb();
        
        // Optional: Allow filtering by ID if passing ?id=123
        const idParam = url.searchParams.get('id');

        let combinations: any[] = [];

        if (idParam) {
            combinations = db.prepare('SELECT * FROM combinations WHERE id = ?').all(idParam);
        } else {
            combinations = db.prepare('SELECT * FROM combinations').all();
        }

        const responseData = combinations.map(combi => {
            // Fetch equipment list (strings) for this combination
            const eqRows = db.prepare(`
                SELECT equipment_name 
                FROM combination_equipment 
                WHERE combination_id = ?
            `).all(combi.id) as { equipment_name: string }[];

            return {
                combinationId: combi.id,
                combinationName: combi.name,
                // The client model expects an array of strings (names)
                equipment: eqRows.map(r => r.equipment_name)
            };
        });

        // If specific ID requested and not found
        if (idParam && responseData.length === 0) {
            throw error(404, 'Combination not found');
        }

        // If specific ID requested, return just that object (standard API behavior), 
        // otherwise return array.
        if (idParam) {
            return json(responseData[0]);
        }

        return json(responseData);

    } catch (err: any) {
        console.error('Database Error:', err);
        if (err.status) throw err; // Rethrow SvelteKit errors
        throw error(500, 'Failed to retrieve combinations');
    }
};