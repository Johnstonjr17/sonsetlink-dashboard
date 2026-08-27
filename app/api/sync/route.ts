import { NextResponse } from 'next/server';
import { syncAll } from '@/lib/sync';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await syncAll();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
