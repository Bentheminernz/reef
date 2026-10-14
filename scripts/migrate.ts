import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

const client = createClient({ url, timeout: 5000 });
await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
console.log(`Migrations applied to ${url}`);
client.close();
