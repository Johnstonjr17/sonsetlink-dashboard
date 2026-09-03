import { NextRequest, NextResponse } from 'next/server';
import { getDb, initSchema } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/share/[token]/revoke — revoke a share token
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await initSchema();
    const { token } = await params;
    const db = getDb();

    const result = await db.execute({
      sql: `UPDATE share_tokens SET revoked = 1 WHERE token = ?`,
      args: [token],
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
