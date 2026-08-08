// server/plugins/db-init.ts
import { useDatabase } from 'nitro/database';
import { definePlugin } from 'nitro'
import type { NitroApp } from 'nitro/types';

export default definePlugin(async (nitroApp: NitroApp) => {
    const db = useDatabase();

    console.log('⚡ Initialising database schema...');

    try {
        // Execute DDL statement to ensure your table exists
        // CREDENTIAL(shadow_id, hashed_password, hashed_username, role);
        await db.sql`
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lms_role') THEN
            CREATE TYPE LMS_Role as ENUM('student', 'instructor', 'faculty_admin', 'central_admin', 'system_admin');
            END IF;
        END $$;
        `;


        await db.sql`
            CREATE TABLE IF NOT EXISTS credentials (
            shadow_id CHAR(9) PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            user_role LMS_Role NOT NULL,
            mfa BOOLEAN NOT NULL
        );
        `;

        await db.sql`
        CREATE INDEX IF NOT EXISTS username_idx 
        ON credentials (username);
        `
        console.log('✅ Database schema ready.');
    } catch (error) {
        console.error('❌ Failed to initialise database schema:', error);
    }
});
