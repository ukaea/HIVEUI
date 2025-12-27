import { EquipmentMetadata, ExperimentMetadata } from '$lib/models';
import { json } from '@sveltejs/kit';
import jq from 'node-jq';

export async function experimentMapping(requestType:string, id: string | null = null) {
    try { 
        if (!requestType) {
        return json({ 
            success: false, 
            message: 'No request type specified' 
            }, { status: 400 });
        }
        const filename = "experiment.jq"
        
        const experimentQuery = await fetch(`/api/get-json-data?filePath=${encodeURIComponent(filename)}`)
        const backTickedQuery = `\`${experimentQuery}\``;

        let requestURL;
        if (id === null) {
            requestURL = requestType
        } else {
            const fileId = id.endsWith('json') ? id : `${id}.json`;
            requestURL = `${requestType}/${fileId}`
        }

        const data = await fetch(`/api/get-metacat-data?path=${encodeURIComponent(requestURL)}`);
        const result = await jq.run(backTickedQuery, data);
        const equipmentInstance = ExperimentMetadata.fromJSON(result)
        return equipmentInstance
    } catch (error) {
        console.error('error mapping experiment data', error)
    }
    
}


export async function instrumentMapping(requestType:string, id: string | null = null) {
    try {
        if (!requestType) {
        return json({ 
            success: false, 
            message: 'No request type specified' 
            }, { status: 400 });
        }

        let requestURL;
        if (id === null) {
            requestURL = requestType
        } else {
            const fileId = id.endsWith('json') ? id : `${id}.json`;
            requestURL = `${requestType}/${fileId}`
        }
        const data = await fetch(`/api/get-metacat-data?path=${encodeURIComponent(requestURL)}`);

        const filePath = `instrument/${requestType}.jq`
        const instrumentQuery = await fetch(`/api/get-json-data?filePath=${encodeURIComponent(filePath)}`)
        const backTickedQuery = `\`${instrumentQuery}\``;

        const result = await jq.run(backTickedQuery, data);
        const equipmentInstance = EquipmentMetadata.fromJSON(result)
        return equipmentInstance

    } catch (error) {
        console.error('error mapping instrument data', error)
    }

}
