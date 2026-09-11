import { NextResponse } from 'next/server';
import { COOKIE_NAME, getExpectedToken, verifyPasscode } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const passcode = body?.passcode as string | undefined;

    if (!passcode) {
      return NextResponse.json({ error: 'Passcode is required' }, { status: 400 });
    }

    const isValid = await verifyPasscode(passcode);
    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect passcode' }, { status: 401 });
    }

    const token = await getExpectedToken();
    const res = NextResponse.json({ success: true });

    // 30-day session cookie
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
