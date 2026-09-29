import { NextRequest, NextResponse } from 'next/server';
import { syncAll } from '@/lib/sync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const siteId = req.nextUrl.searchParams.get('site') ?? undefined;
    const forceFullSync = req.nextUrl.searchParams.get('full') === 'true';
    const result = await syncAll({ siteId, forceFullSync });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.get('debug') === 'true') {
      const { getDb } = await import('@/lib/db');
      const db = getDb();
      let alterError = null;
      try {
        await db.execute(`ALTER TABLE messages ADD COLUMN original_timestamp TEXT`);
      } catch (e) {
        alterError = String(e);
      }
      const cols = await db.execute(`PRAGMA table_info(messages)`);
      return NextResponse.json({
        build: 'debug-check-columns',
        alterError,
        columns: cols.rows.map((r: any) => r.name),
      });
    }

    const siteId = req.nextUrl.searchParams.get('site') ?? undefined;
    const forceFullSync = req.nextUrl.searchParams.get('full') === 'true';
    const result = await syncAll({ siteId, forceFullSync });
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
