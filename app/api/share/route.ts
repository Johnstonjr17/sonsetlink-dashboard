import { NextResponse } from 'next/server';
import { getDb, initSchema } from '@/lib/db';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/share — list all tokens with site info (for admin page)
export async function GET() {
  try {
    await initSchema();
    const db = getDb();

    const result = await db.execute(`
      SELECT
        t.token,
        t.site_id,
        t.label,
        t.created_at,
        t.revoked,
        s.name AS site_name,
        s.location AS site_location
      FROM share_tokens t
      LEFT JOIN sites s ON s.id = t.site_id
      ORDER BY t.created_at DESC
    `);

    return NextResponse.json({ tokens: result.rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST /api/share — create a new token
// body: { site_id: string, label?: string }
export async function POST(req: Request) {
  try {
    await initSchema();
    const db = getDb();
    const body = await req.json();

    const siteId = body.site_id as string;
    const label = (body.label as string | undefined) ?? null;

    if (!siteId) {
      return NextResponse.json({ error: 'site_id is required' }, { status: 400 });
    }

    // Verify site exists
    const siteCheck = await db.execute({ sql: `SELECT id FROM sites WHERE id = ?`, args: [siteId] });
    if (siteCheck.rows.length === 0) {
      return NextResponse.json({ error: `Site ${siteId} not found` }, { status: 404 });
    }

    // Generate a random token: e.g. "sl025-a7f3b9c2e1d4"
    const prefix = siteId.toLowerCase().replace('-', '');
    const random = randomBytes(8).toString('hex');
    const token = `${prefix}-${random}`;

    await db.execute({
      sql: `INSERT INTO share_tokens (token, site_id, label, created_at, revoked) VALUES (?, ?, ?, ?, 0)`,
      args: [token, siteId, label, new Date().toISOString()],
    });

    return NextResponse.json({ success: true, token });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
