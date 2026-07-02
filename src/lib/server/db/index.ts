import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

function createDb() {
    if (!env.DB_URL) {
        throw new Error('DB_URL is not set in environment variables');
    }
    return drizzle(env.DB_URL, { schema });
}

type Db = ReturnType<typeof createDb>;

let instance: Db | null = null;

function getDb(): Db {
    if (!instance) {
        instance = createDb();
    }
    return instance;
}

// Lazily connect on first use. Importing this module (e.g. during the SvelteKit
// build/analyse step) must not require DB_URL — only an actual query does.
export const db = new Proxy({} as Db, {
    get(_target, prop) {
        const real: any = getDb();
        const value = real[prop];
        return typeof value === 'function' ? value.bind(real) : value;
    }
});
