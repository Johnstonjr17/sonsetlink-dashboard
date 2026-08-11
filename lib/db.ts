import { createClient, Client } from '@libsql/client';
import path from 'path';

const globalForDb = globalThis as unknown as {
  tursoClient: Client | undefined;
};

export function getDb(): Client {
  if (!globalForDb.tursoClient) {
    const rawUrl = process.env.TURSO_DATABASE_URL?.trim();
    const rawToken = process.env.TURSO_AUTH_TOKEN?.trim();

    if (rawUrl) {
      const cleanUrl = rawUrl.replace(/^["']|["']$/g, '');
      const cleanToken = rawToken ? rawToken.replace(/^["']|["']$/g, '') : undefined;

      globalForDb.tursoClient = createClient({
        url: cleanUrl,
        authToken: cleanToken,
      });
    } else if (process.env.VERCEL) {
      throw new Error(
        'TURSO_DATABASE_URL is missing in Vercel Environment Variables. Please add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel Settings -> Environment Variables and redeploy.'
      );
    } else {
      const dbPath = path.join(process.cwd(), 'sonsetlink.db').replace(/\\/g, '/');
      globalForDb.tursoClient = createClient({
        url: `file:${dbPath}`,
      });
    }
  }
  return globalForDb.tursoClient;
}

export async function initSchema(): Promise<void> {
  const db = getDb();
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT,
      location TEXT,
      format_name TEXT,
      most_recent_tx TEXT,
      last_synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      flow_volume REAL DEFAULT 0,
      flow2_volume REAL DEFAULT 0,
      dosing_pump REAL,
      time_in_use INTEGER DEFAULT 0,
      battery_voltage REAL,
      slot INTEGER,
      backfill INTEGER,
      FOREIGN KEY (site_id) REFERENCES sites(id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_site_id ON messages(site_id);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    CREATE INDEX IF NOT EXISTS idx_messages_site_ts ON messages(site_id, timestamp);
  `);
}
