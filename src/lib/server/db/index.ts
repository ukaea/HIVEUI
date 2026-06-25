import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

if (!env.DB_URL) {
    throw new Error('DB_URL is not set in environment variables');
}

export const db = drizzle(env.DB_URL, { schema });
