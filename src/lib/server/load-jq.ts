import { env } from "better-auth";
import { JqCache } from "./jq-cache";

//Mapping for filenames
const forwardFileMap: Record<string, string> = {
  equipment: `${env.FORWARD_JQ_DIR}instrument.jq`,
  experiments: `${env.FORWARD_JQ_DIR}experiment.jq`,
  pulse: `${env.FORWARD_JQ_DIR}dataset.jq`
}

const backwardFileMap: Record<string, string> = {
    pulse: `${env.BACKWARD_JQ_DIR}dataset.jq`,
    experiments: `${env.BACKWARD_JQ_DIR}experiment.jq`,
    camera: `${env.BACKWARD_JQ_DIR}instrument/camera.jq`,
    flowmeter: `${env.BACKWARD_JQ_DIR}instrument/flowmeter.jq`,
    pyrometer: `${env.BACKWARD_JQ_DIR}instrument/pyrometer.jq`,
    thermocouple: `${env.BACKWARD_JQ_DIR}instrument/thermocouple.jq`,
}

// creating forwardJq instance type
export const forwardJq = new JqCache ({
    direction: "forward",
    endpoints: forwardFileMap
});

// creating backwardJq instance type
export const backwardJq = new JqCache ({
    direction: "forward",
    endpoints: backwardFileMap,
})


// fetching jq file and mapping into record 
const forwardJqJson: Record<string, string> = Object.fromEntries(
    await Promise.all(
        Object.entries(forwardFileMap).map(async ([key, url]) => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${key} from ${url}`);
            }
            const result = await response.text();
            return [key, result] as const;
        })
    )
)

// fetching jq file and mapping into record
const backwardJqJson: Record<string, string> = Object.fromEntries(
    await Promise.all(
        Object.entries(backwardFileMap).map(async ([key, url]) => {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${key} from ${url}`);
            }
            const result = await response.text();
            return [key, result] as const;
        })
    )
)

// loading and fetched jq files into cache
export async function loadJqCaches() {
    if (forwardJq.isLoaded() && backwardJq.isLoaded()) return;

    console.log("Fetching JQ files into cache")

    forwardJq.setjqCache(forwardJqJson)

    backwardJq.setjqCache(backwardJqJson)

    console.log("JQ cache loaded");
}