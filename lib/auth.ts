export const COOKIE_NAME = 'hwi_session';
export const DEFAULT_PASSCODE = 'HWI_2026';

export async function getExpectedToken(): Promise<string> {
  const passcode = process.env.ORG_PASSCODE?.trim() || DEFAULT_PASSCODE;
  const secret = process.env.SESSION_SECRET || 'hwi-telemetry-2026-auth-salt';
  const encoder = new TextEncoder();
  const data = encoder.encode(`${passcode}:${secret}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPasscode(input: string): Promise<boolean> {
  const expected = process.env.ORG_PASSCODE?.trim() || DEFAULT_PASSCODE;
  return input.trim() === expected;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const expectedToken = await getExpectedToken();
  return token === expectedToken;
}
