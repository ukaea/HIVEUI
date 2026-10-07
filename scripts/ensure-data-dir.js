import 'dotenv/config';
import { mkdirSync } from 'node:fs';

const dir = process.env.ROOT_FOLDER_LOCATION || './example_data';
mkdirSync(dir, { recursive: true });
console.log(`[ensure-data-dir] Using data folder ${dir}`);
