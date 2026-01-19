import { error } from '@sveltejs/kit';
import jq from 'node-jq';

const jqCache: Record<string, string> = {};

//Mapping for filenames
const fileMap: Record<string, string> = {
  equipment: "instrument.jq",
  experiment: "experiment.jq",
  pulse: "dataset.jq"
}

export async function jqMapping(metadata:any, requestType:string, jqDir:string) {
  if (!metadata) {
    throw error(400, 'metadata is required');
  }

  const fileName = fileMap[requestType];

  if (!fileName) return metadata;

  // Fetch if not in jqCache
  if (!jqCache[requestType]) {
    const res = await fetch(`${jqDir}/${fileName}`);
    jqCache[requestType] = await res.text();
  }

  return await jq.run(jqCache[requestType], metadata, { input: 'json', output: 'json' });
}