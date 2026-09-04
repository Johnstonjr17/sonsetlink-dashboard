const API_TOKEN = 'NhIZQ4PpIow6DWvj9w6Q9VBw9QLz8H6B7UOZ3gwyec1ee111';
const BASE_URL = 'https://app.sonsetlink.org/api/v1';

const defaultHeaders = {
  Authorization: `Bearer ${API_TOKEN}`,
  Accept: 'application/vnd.api+json',
};

export interface SiteAttributes {
  name: string;
  location: string;
  format_name: string;
  most_recent_tx: string;
  timezone: string | null;
}

export interface SiteRecord {
  id: string;
  attributes: SiteAttributes;
}

export interface MessageAttributes {
  timestamp: string;
  flow_volume: number | null;
  flow2_volume: number | null;
  dosing_pump: number | null;
  time_in_use: number | null;
  battery_voltage: number | null;
  slot: number | null;
  backfill: number | null;
}

export interface MessageRecord {
  id: string;
  attributes: MessageAttributes;
}

export interface UnitDetails {
  install_date: string | null;
  ship_date: string | null;
}

export interface NotificationAttributes {
  site_identifier: string;
  timestamp: string;
  notification_type_name: string;
  info: any;
  severity: number;
  unresolved: boolean;
}

export interface NotificationRecord {
  id: string;
  attributes: NotificationAttributes;
}

// Queue and timestamp to guarantee strictly sequential requests spaced by >= 1000ms
let lastRequestEndTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1000;
let requestQueue: Promise<any> = Promise.resolve();

async function rawFetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const res = await fetch(url, {
        headers: defaultHeaders,
        cache: 'no-store',
      });

      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        return res;
      }

      if (res.status === 429) {
        const delay = attempt * 2500;
        console.warn(`[SonSetAPI 429 RateLimit] Retrying attempt ${attempt}/${maxRetries} after ${delay}ms: ${url}`);
        await new Promise((r) => setTimeout(r, delay));
      } else if (res.status >= 500) {
        const delay = attempt * 1500;
        console.warn(`[SonSetAPI ${res.status} ServerError] Retrying attempt ${attempt}/${maxRetries} after ${delay}ms: ${url}`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        return res;
      }
    } catch (networkErr) {
      if (attempt >= maxRetries) throw networkErr;
      const delay = attempt * 1500;
      console.warn(`[SonSetAPI NetworkError] Retrying attempt ${attempt}/${maxRetries} after ${delay}ms: ${url}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return fetch(url, { headers: defaultHeaders, cache: 'no-store' });
}

// Strictly serializes all outgoing requests and ensures >= 1000ms delay between each
export function throttledFetch(url: string, maxRetries = 3): Promise<Response> {
  const execute = async (): Promise<Response> => {
    const now = Date.now();
    const timeSinceLast = now - lastRequestEndTime;
    if (timeSinceLast < MIN_REQUEST_INTERVAL_MS) {
      const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLast;
      await new Promise((r) => setTimeout(r, waitTime));
    }
    try {
      return await rawFetchWithRetry(url, maxRetries);
    } finally {
      lastRequestEndTime = Date.now();
    }
  };

  const nextPromise = requestQueue.then(execute, execute);
  requestQueue = nextPromise;
  return nextPromise;
}

export async function fetchAllSites(): Promise<SiteRecord[]> {
  const res = await throttledFetch(`${BASE_URL}/sites?page[size]=100`, 3);
  if (!res.ok) {
    // Fallback without page[size] if 500 persists
    const fallbackRes = await throttledFetch(`${BASE_URL}/sites`, 3);
    if (!fallbackRes.ok) throw new Error(`Failed to fetch sites: ${fallbackRes.status}`);
    const json = await fallbackRes.json();
    return json.data ?? [];
  }
  const json = await res.json();
  return json.data ?? [];
}

export async function fetchAllUnits(): Promise<Map<string, UnitDetails>> {
  const unitMap = new Map<string, UnitDetails>();
  try {
    const res = await throttledFetch(`${BASE_URL}/units?page[size]=100`, 3);
    if (res.ok) {
      const json = await res.json();
      const units: any[] = json.data ?? [];
      for (const u of units) {
        const siteId = u.attributes?.site_identifier || u.id;
        unitMap.set(siteId, {
          install_date: u.attributes?.install_date ?? null,
          ship_date: u.attributes?.ship_date ?? null,
        });
      }
    }
  } catch (e) {
    console.error('Error fetching units:', e);
  }
  return unitMap;
}

export async function fetchAllNotifications(): Promise<NotificationRecord[]> {
  try {
    const res = await throttledFetch(`${BASE_URL}/notifications?page[size]=100&sort=-timestamp`, 3);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

export async function fetchSiteMessages(
  siteId: string,
  sinceDate: string = '2025-01-01 00:00:00'
): Promise<MessageRecord[]> {
  const allRecords: MessageRecord[] = [];
  let page = 1;

  while (true) {
    const encodedDate = encodeURIComponent(sinceDate);
    const url = `${BASE_URL}/sites/${siteId}/usage3-messages?filter[timestamp-gte]=${encodedDate}&page[number]=${page}&page[size]=1000&sort=timestamp`;

    const res = await throttledFetch(url, 3);
    if (!res.ok) break;

    const json = await res.json();
    const records: MessageRecord[] = json.data ?? [];
    const meta = json.meta?.page ?? {};

    allRecords.push(...records);

    if (page >= (meta.lastPage ?? 1)) break;
    page++;
  }

  return allRecords;
}
