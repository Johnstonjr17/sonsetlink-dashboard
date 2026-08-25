import { NextRequest, NextResponse } from 'next/server';
import { getDb, initSchema } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await initSchema();
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get('siteId');
    const includeDismissed = searchParams.get('includeDismissed') === 'true';

    let sql = `
      SELECT
        n.id,
        n.site_id,
        s.name AS site_name,
        s.location,
        s.timezone,
        n.timestamp,
        n.notification_type_name,
        n.severity,
        n.unresolved,
        n.info,
        n.dismissed,
        n.dismissed_at
      FROM notifications n
      JOIN sites s ON s.id = n.site_id
      WHERE n.unresolved = 1
    `;

    const args: any[] = [];

    if (!includeDismissed) {
      sql += ` AND (n.dismissed = 0 OR n.dismissed IS NULL)`;
    }

    if (siteId) {
      sql += ` AND n.site_id = ?`;
      args.push(siteId);
    }

    sql += ` ORDER BY n.severity DESC, n.timestamp DESC`;

    const result = await db.execute({ sql, args });

    const notifications = result.rows.map((r) => {
      let parsedInfo = null;
      try {
        parsedInfo = typeof r.info === 'string' ? JSON.parse(r.info) : r.info;
      } catch {
        parsedInfo = r.info;
      }

      return {
        id: String(r.id),
        site_id: String(r.site_id),
        site_name: String(r.site_name || r.site_id),
        location: String(r.location || 'N/A'),
        timezone: r.timezone ? String(r.timezone) : null,
        timestamp: String(r.timestamp),
        notification_type_name: String(r.notification_type_name),
        severity: Number(r.severity ?? 0),
        unresolved: Boolean(r.unresolved),
        info: parsedInfo,
        dismissed: Boolean(r.dismissed),
        dismissed_at: r.dismissed_at ? String(r.dismissed_at) : null,
      };
    });

    return NextResponse.json({ notifications, count: notifications.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await initSchema();
    const db = getDb();
    const body = await req.json();
    const { id, dismissed } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing notification id' }, { status: 400 });
    }

    const isDismissed = dismissed !== false;
    const dismissedAt = isDismissed ? new Date().toISOString() : null;

    await db.execute({
      sql: `UPDATE notifications SET dismissed = ?, dismissed_at = ? WHERE id = ?`,
      args: [isDismissed ? 1 : 0, dismissedAt, id],
    });

    return NextResponse.json({ success: true, id, dismissed: isDismissed, dismissed_at: dismissedAt });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
