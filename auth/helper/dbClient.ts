import mysql from 'mysql2/promise';
import { useRuntimeConfig } from 'nitro/runtime-config';
import { PGlite } from '@electric-sql/pglite';

let _pgLiteDb: any = null;

export async function queryMySql<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const config = useRuntimeConfig();
    const host = (config.mysqlHost as string | undefined) ?? '127.0.0.1';
    const port = Number(config.mysqlPort ?? 3306);
    const user = config.mysqlUser as string | undefined;
    const password = config.mysqlPassword as string | undefined;
    const database = (config.mysqlDatabase as string | undefined) ?? 'iam_database';

    const conn = await mysql.createConnection({ host, port, user, password, database });
    try {
        const [rows] = await conn.execute(sql, params);
        return rows as T[];
    } finally {
        await conn.end();
    }
}

export async function getPgLiteDb() {
    if (_pgLiteDb) return _pgLiteDb;
    const { dataDir } = useRuntimeConfig();

    _pgLiteDb = PGlite.create(dataDir);
    return _pgLiteDb;
}

export async function queryPgLite<T = any>(sql: string, params: any[] = []): Promise<T[] | T | null> {
    const db = await getPgLiteDb();
    // simple heuristic: SELECT returns rows
    if (/^\s*select/i.test(sql)) {
        const res = await db.prepare(sql).all(...params);
        return res as T[];
    } else {
        const res = await db.prepare(sql).run(...params);
        return res as any;
    }
}

export async function closePgLite() {
    if (!_pgLiteDb) return;
    try {
        await _pgLiteDb.dispose?.();
    } finally {
        _pgLiteDb = null;
    }
}

export default { queryMySql, getPgLiteDb, queryPgLite, closePgLite };
