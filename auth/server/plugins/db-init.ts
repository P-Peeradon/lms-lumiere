// server/plugins/db-init.ts
import { useDatabase } from 'nitro/database';
import { definePlugin } from 'nitro'
import type { NitroApp } from 'nitro/types';

export default definePlugin(async (nitroApp: NitroApp) => {
  const db = useDatabase();

  console.log('⚡ Initialising database schema...');

  try {
    // Execute DDL statement to ensure your table exists
    await db.sql`
        CREATE TABLE IF NOT EXISTS credentials (
        shadow_id CHAR(9) PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );
    `;
    console.log('✅ Database schema ready.');
  } catch (error) {
    console.error('❌ Failed to initialise database schema:', error);
  }
});
