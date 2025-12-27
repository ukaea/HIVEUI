import Database from 'better-sqlite3';

// Initialize DB file
const db = new Database('exampleData/db/local.db', { verbose: console.log });

export function initDb() {
    // Enable Write-Ahead Logging for concurrency and performance
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');

    const createTables = `
        CREATE TABLE IF NOT EXISTS configurations (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT
        );

        CREATE TABLE IF NOT EXISTS combinations (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        );

        -- Link between Configs and Combinations
        CREATE TABLE IF NOT EXISTS config_combinations (
            config_id INTEGER,
            combination_id INTEGER,
            FOREIGN KEY(config_id) REFERENCES configurations(id),
            FOREIGN KEY(combination_id) REFERENCES combinations(id),
            PRIMARY KEY (config_id, combination_id)
        );

        -- Stores the equipment strings (e.g., "CAM_02")
        CREATE TABLE IF NOT EXISTS combination_equipment (
            combination_id INTEGER,
            equipment_name TEXT,
            FOREIGN KEY(combination_id) REFERENCES combinations(id)
        );
    `;

    db.exec(createTables);

    // Check if DB is empty
    const stmt = db.prepare('SELECT count(*) as count FROM configurations');
    const result = stmt.get() as { count: number };
    
    if (result.count === 0) {
        console.log("Seeding database with initial data...");
        seedData();
    }
}

function seedData() {
    // Use a transaction to ensure all data is inserted atomically
    const insertTransaction = db.transaction(() => {
        // --- 1. Create Combinations ---
        const insertCombi = db.prepare('INSERT INTO combinations (id, name) VALUES (?, ?)');
        insertCombi.run(1, 'Combi 1');
        insertCombi.run(2, 'Combi 2');

        // --- 2. Add Equipment to Combinations ---
        const insertEq = db.prepare('INSERT INTO combination_equipment (combination_id, equipment_name) VALUES (?, ?)');
        
        // Combi 1: CAM_02, LENS_01
        insertEq.run(1, 'CAM_02');
        insertEq.run(1, 'LENS_01');

        // Combi 2: CAM_02, LENS_03
        insertEq.run(2, 'CAM_02');
        insertEq.run(2, 'LENS_03');

        // --- 3. Create Configurations ---
        const insertConfig = db.prepare('INSERT INTO configurations (id, name, description) VALUES (?, ?, ?)');
        
        // Config 1
        insertConfig.run(1, 'Config 1', 'Cameras');
        
        // Config 2
        insertConfig.run(2, 'Config 2', 'test');

        // --- 4. Link Configs to Combinations ---
        const link = db.prepare('INSERT INTO config_combinations (config_id, combination_id) VALUES (?, ?)');
        
        // Config 1 has [1]
        link.run(1, 1);

        // Config 2 has [1, 2]
        link.run(2, 1);
        link.run(2, 2);
    });

    insertTransaction();
    console.log("Seeding complete.");
}

export function getDb() {
    return db;
}

// Run init immediately
initDb();