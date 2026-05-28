import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { env } from '$env/dynamic/private';
let db: Database.Database | null = null;
const initializedTables = new Set<string>();

/**
 * Parse DB_URL and determine database type
 */
function parseDbUrl(dbUrl: string): { type: 'sqlite' | 'postgres'; path: string } {
    if (dbUrl.startsWith('jdbc:postgresql://') || dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
        return { type: 'postgres', path: dbUrl };
    }

    if (dbUrl.startsWith('sqlite:')) {
        return { type: 'sqlite', path: dbUrl.replace(/^sqlite:/, '') };
    }

    // Assume it's a file path for SQLite
    return { type: 'sqlite', path: dbUrl };
}

/**
 * Initialize the database connection using DB_URL from environment
 */
export function initDb(dbUrl?: string): Database.Database {
    if (db) return db;

    const url = dbUrl || env.DB_URL;

    if (!url) {
        throw new Error('DB_URL is not set in environment variables');
    }

    const { type, path: dbPath } = parseDbUrl(url);

    if (type === 'postgres') {
        throw new Error('PostgreSQL is not supported. Please use a SQLite database URL (e.g., sqlite:./data/local.db or just a file path)');
    }

    // Ensure the directory exists for SQLite
    const dir = dirname(dbPath);
    if (dir && dir !== '.' && !existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    // Create/open SQLite database
    db = new Database(dbPath);

    // Enable WAL mode and set busy timeout to handle concurrent access
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');

    return db;
}

/**
 * Get the database instance, initializing if necessary
 */
export function getDb(): Database.Database {
    if (!db) {
        return initDb();
    }
    return db;
}

/**
 * Ensures a table exists with the simplified schema: id (TEXT PRIMARY KEY) + data (JSON)
 */
export function ensureTable(tableName: string): void {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        throw new Error('Invalid table name format');
    }

    if (initializedTables.has(tableName)) return;

    const database = getDb();
    database.exec(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
            id TEXT PRIMARY KEY,
            data JSON NOT NULL
        )
    `);
    initializedTables.add(tableName);
}

/**
 * Get all records from a table, returning the parsed JSON data with id included
 */
export function getAllRecords(tableName: string): any[] {
    ensureTable(tableName);
    const database = getDb();
    const rows = database.prepare(`SELECT id, data FROM "${tableName}"`).all() as { id: string; data: string }[];
    return rows.map(row => {
        const parsed = JSON.parse(row.data);
        return { ...parsed, _dbId: row.id };
    });
}

/**
 * Get a single record by id
 */
export function getRecordById(tableName: string, id: string): any | null {
    ensureTable(tableName);
    const database = getDb();
    const row = database.prepare(`SELECT id, data FROM "${tableName}" WHERE id = ?`).get(id) as { id: string; data: string } | undefined;
    if (!row) return null;
    const parsed = JSON.parse(row.data);
    return { ...parsed, _dbId: row.id };
}

/**
 * Insert or update a record (upsert)
 */
export function upsertRecord(tableName: string, id: string, data: any): void {
    ensureTable(tableName);
    const database = getDb();
    const jsonData = JSON.stringify(data);
    const sql = `INSERT OR REPLACE INTO "${tableName}" (id, data) VALUES (?, ?)`;
    database.prepare(sql).run(id, jsonData);
}

/**
 * Delete a record by id
 */
export function deleteRecord(tableName: string, id: string): void {
    ensureTable(tableName);
    const database = getDb();
    database.prepare(`DELETE FROM "${tableName}" WHERE id = ?`).run(id);
}