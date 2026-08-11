import { NextResponse } from 'next/server';
import { syncAll } from '@/lib/sync';

export async function POST() {
  try {
    const result = await syncAll();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
