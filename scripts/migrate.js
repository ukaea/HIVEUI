// Applies Drizzle SQL migrations from the ./drizzle folder against DB_URL.
// Runtime-only deps (drizzle-orm, pg, dotenv) — no drizzle-kit needed, so this
// runs in the production image. Invoked on container startup before the app boots.
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const { DB_URL } = process.env;

if (!DB_URL) {
	console.error('[migrate] DB_URL is not set; cannot run migrations.');
	process.exit(1);
}

const pool = new pg.Pool({ connectionString: DB_URL });
const db = drizzle(pool);

try {
	console.log('[migrate] Applying migrations...');
	await migrate(db, { migrationsFolder: 'drizzle' });
	console.log('[migrate] Migrations applied successfully.');
} catch (err) {
	console.error('[migrate] Migration failed:', err);
	process.exitCode = 1;
} finally {
	await pool.end();
}
