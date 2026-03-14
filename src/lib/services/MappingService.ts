import { env } from '$env/dynamic/private';

// Mapping of target names to their jq script filenames
const BACKWARD_JQ_FILES: Record<string, string> = {
    pulse: 'dataset.jq',
    experiments: 'experiment.jq',
    camera: 'instrument/camera.jq',
    flowmeter: 'instrument/flowmeter.jq',
    pyrometer: 'instrument/pyrometer.jq',
    thermocouple: 'instrument/thermocouple.jq',
};

const FORWARD_JQ_FILES: Record<string, string> = {
    instruments: 'instrument.jq',
    experiments: 'experiment.jq',
    pulse: 'dataset.jq',
};

// In-memory cache for loaded scripts
const scriptCache: Record<string, string> = {};

/**
 * Gets a jq script, fetching from remote only if not already in memory
 */
async function getJqScript(
    direction: 'forward' | 'backward',
    target: string
): Promise<string> {
    const cacheKey = `${direction}:${target}`;

    // Return from memory cache if available
    if (scriptCache[cacheKey]) {
        return scriptCache[cacheKey];
    }

    const fileMap = direction === 'forward' ? FORWARD_JQ_FILES : BACKWARD_JQ_FILES;
    const baseUrl = direction === 'forward' ? env.FORWARD_JQ_DIR : env.BACKWARD_JQ_DIR;

    const filename = fileMap[target];
    if (!filename) {
        throw new Error(`No jq script mapping found for target: ${target}`);
    }

    if (!baseUrl) {
        throw new Error(`${direction.toUpperCase()}_JQ_DIR is not set in environment variables`);
    }

    const remoteUrl = `${baseUrl.replace(/\/$/, '')}/${filename}`;
    console.log(`Fetching jq script from remote: ${remoteUrl}`);

    try {
        const response = await fetch(remoteUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch jq script: ${response.status} ${response.statusText}`);
        }

        const script = await response.text();

        // Store in memory cache
        scriptCache[cacheKey] = script;
        console.log(`Cached jq script in memory for: ${cacheKey}`);

        return script;
    } catch (err) {
        console.error(`Error fetching jq script for ${target}:`, err);
        throw new Error(`Failed to load jq script for ${target}`);
    }
}

/**
 * Get a backward mapping jq script (remote -> local format)
 */
export async function getBackwardJqScript(target: string): Promise<string> {
    return getJqScript('backward', target);
}

/**
 * Get a forward mapping jq script (local -> remote format)
 */
export async function getForwardJqScript(target: string): Promise<string> {
    return getJqScript('forward', target);
}

/**
 * Check if a target has a jq script mapping
 */
export function hasJqMapping(direction: 'forward' | 'backward', target: string): boolean {
    const fileMap = direction === 'forward' ? FORWARD_JQ_FILES : BACKWARD_JQ_FILES;
    return target in fileMap;
}
