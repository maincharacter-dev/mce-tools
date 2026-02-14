#!/usr/bin/env node
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env') });

async function main() {
  const { getProjectDb } = await import('./server/project-db-provisioner.ts');
  const db = await getProjectDb('proj_1_1769044099720');
  
  console.log('Checking if facts table exists...');
  const tables = await db.execute("SHOW TABLES LIKE 'facts'");
  console.log('Tables result:', tables);
  
  if (tables && tables[0] && tables[0].length > 0) {
    console.log('Renaming facts to extracted_facts...');
    await db.execute("RENAME TABLE facts TO extracted_facts");
    console.log('Done!');
  } else {
    console.log('facts table not found, checking for extracted_facts...');
    const extracted = await db.execute("SHOW TABLES LIKE 'extracted_facts'");
    console.log('extracted_facts result:', extracted);
  }
}

main().catch(console.error);
