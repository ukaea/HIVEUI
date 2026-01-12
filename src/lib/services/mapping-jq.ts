import { error } from '@sveltejs/kit';
import jq from 'node-jq';

let equimentJqFile: any | null = null;
let experimentJqFile: any | null = null;
let datasetJqFile: any | null = null;
let mappedData: any;

export async function reverseMapping(metadata:any, requestType:string, jqFileDir:string) {
  if (!(requestType && metadata)) {
    throw error(400, 'request type and metadata required');
  }
  switch (requestType) {
    case "equipment":
      if (equimentJqFile !== null){
        const jqFileRequest = await fetch(`${jqFileDir}/instrument.jq`)
        equimentJqFile = await jqFileRequest.text();
      }
      mappedData = await jq.run(equimentJqFile, metadata, { input: 'json', output: 'json' });
      return mappedData;
    case "experiment":
      if (experimentJqFile !== null) {
        const jqFileRequest = await fetch(`${jqFileDir}/experiment.jq`);
        experimentJqFile = await jqFileRequest.text();
      }
      mappedData = await jq.run(experimentJqFile, metadata, { input: 'json', output: 'json' });
      return mappedData;
    case "pulse":
      if (datasetJqFile !== null) {
        const jqFileRequest = await fetch(`${jqFileDir}/dataset.jq`);
        datasetJqFile = await jqFileRequest.text(); 
      }
      mappedData = await jq.run(datasetJqFile, metadata, { input: 'json', output: 'json' });
      return mappedData;
    default: 
    mappedData = metadata;
  } 
}