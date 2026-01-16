import jq from "node-jq";

type Cache = Record<string, string>;

export type Direction = "forward" | "backward";

export interface DirrectionConfig {
    direction: Direction;
    endpoints: Record<string, string>;
}

export class JqCache {
  private readonly config: DirrectionConfig;
  private cache: Cache = {};
  private loaded = false;

  constructor(config:DirrectionConfig) {
    this.config = config
  }

  setjqCache(datasets: Cache) {
        Object.assign(this.cache, datasets);
        this.loaded = true;
  }

  get(): Cache {
    if (!this.loaded) {
      throw new Error(`jq data not loaded for ${this.config.direction} mapping`);
    }
    return this.cache;
  } 
  isLoaded() {
    return this.loaded;
  }

  async jqMap(metadata: any, requestType: string) {
    if (!this.isLoaded()) {
        throw new Error("Jq file need to be loaded before mapping")
    }
    const jqScript = this.cache[requestType];

    if (!jqScript) {
        throw new Error(`No jq Scripts for ${requestType}`)
    }
    const mapped = await jq.run(jqScript, metadata, { input: 'json', output: 'json' })
    return mapped;
  }

}