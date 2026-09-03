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
      last_synced_at TEXT,
      install_date TEXT,
      ship_date TEXT,
      timezone TEXT
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

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_sites (
      group_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      role TEXT NOT NULL,
      PRIMARY KEY (group_id, site_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      notification_type_name TEXT NOT NULL,
      severity INTEGER DEFAULT 0,
      unresolved INTEGER DEFAULT 1,
      info TEXT,
      dismissed INTEGER DEFAULT 0,
      dismissed_at TEXT,
      FOREIGN KEY (site_id) REFERENCES sites(id)
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_site_id ON notifications(site_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_unresolved ON notifications(unresolved);
    CREATE INDEX IF NOT EXISTS idx_notifications_dismissed ON notifications(dismissed);

    CREATE TABLE IF NOT EXISTS share_tokens (
      token      TEXT PRIMARY KEY,
      site_id    TEXT NOT NULL,
      label      TEXT,
      created_at TEXT NOT NULL,
      revoked    INTEGER DEFAULT 0,
      FOREIGN KEY (site_id) REFERENCES sites(id)
    );

    CREATE INDEX IF NOT EXISTS idx_share_tokens_site_id ON share_tokens(site_id);
  `);

  try {
    await db.execute(`ALTER TABLE sites ADD COLUMN install_date TEXT`).catch(() => {});
    await db.execute(`ALTER TABLE sites ADD COLUMN ship_date TEXT`).catch(() => {});
    await db.execute(`ALTER TABLE sites ADD COLUMN timezone TEXT`).catch(() => {});
  } catch {}

  try {
    const existing = await db.execute(`SELECT COUNT(*) as cnt FROM groups`);
    if (Number(existing.rows[0]?.cnt ?? 0) === 0) {
      const groupId = 'rosalbali-system';
      await db.execute({
        sql: `INSERT OR IGNORE INTO groups (id, name, description, created_at) VALUES (?, ?, ?, ?)`,
        args: [
          groupId,
          'Rosalbali Network',
          'Production (SL-025 Rosalbali) vs Distribution (SL-014 Allianza & SL-018 Rosarito)',
          new Date().toISOString(),
        ],
      });
      await db.execute({
        sql: `INSERT OR IGNORE INTO group_sites (group_id, site_id, role) VALUES (?, ?, ?)`,
        args: [groupId, 'SL-025', 'production'],
      });
      await db.execute({
        sql: `INSERT OR IGNORE INTO group_sites (group_id, site_id, role) VALUES (?, ?, ?)`,
        args: [groupId, 'SL-014', 'distribution'],
      });
      await db.execute({
        sql: `INSERT OR IGNORE INTO group_sites (group_id, site_id, role) VALUES (?, ?, ?)`,
        args: [groupId, 'SL-018', 'distribution'],
      });
    }
  } catch {}
}
