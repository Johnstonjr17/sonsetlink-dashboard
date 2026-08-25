'use client';
import { useEffect, useState } from 'react';
import SiteCard from '@/components/SiteCard';

interface Site {
  id: string;
  name: string;
  location: string;
  format_name: string;
  most_recent_tx: string | null;
  latest_battery: number | null;
  record_count: number;
  total_flow_gal: number | null;
  last_synced_at: string | null;
  active_alerts_count?: number;
  active_alert_types?: string | null;
}

export default function HomePage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<'all' | 'alerts_only'>('all');

  useEffect(() => {
    fetch('/api/sites')
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok || data.error) {
          throw new Error(data.error || `HTTP error ${r.status}`);
        }
        return data;
      })
      .then((d) => {
        setSites(Array.isArray(d.sites) ? d.sites : []);
        setError(null);
      })
      .catch((e) => {
        setError(String(e.message || e));
        setSites([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const safeSites = Array.isArray(sites) ? sites : [];

  const sitesWithAlerts = safeSites.filter((s) => (s?.active_alerts_count ?? 0) > 0);

  const filtered = safeSites.filter((s) => {
    if (!s) return false;
    if (alertFilter === 'alerts_only' && !(s.active_alerts_count && s.active_alerts_count > 0)) {
      return false;
    }
    const q = search.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.id && s.id.toLowerCase().includes(q)) ||
      (s.location && s.location.toLowerCase().includes(q))
    );
  });

  const lastSync = safeSites.find((s) => s?.last_synced_at)?.last_synced_at;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Water Flow Dashboard</h1>
        <p className="page-subtitle">
          {lastSync
            ? `Last synced ${new Date(lastSync).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${safeSites.length} monitored sites`
            : 'Click "Sync Now" in the top right to load data from SonSetLink API'}
        </p>
      </div>

      {error && (
        <div className="sync-bar" style={{ marginBottom: 20, background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error.includes('no such table') ? 'No data yet — click "Sync Now" to pull data from the API.' : error}
        </div>
      )}

      {!loading && !error && safeSites.length === 0 && (
        <div className="sync-bar" style={{ marginBottom: 20 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          No sites yet. Click <strong>"Sync Now"</strong> in the top bar to load your sites.
        </div>
      )}

      <div className="search-row" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="search-input-wrapper">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search by site name, ID, or location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="toggle-group" style={{ marginLeft: 'auto' }}>
          <button
            className={`toggle-btn ${alertFilter === 'all' ? 'active' : ''}`}
            onClick={() => setAlertFilter('all')}
          >
            All Sites ({safeSites.length})
          </button>
          <button
            className={`toggle-btn ${alertFilter === 'alerts_only' ? 'active' : ''}`}
            onClick={() => setAlertFilter('alerts_only')}
            style={sitesWithAlerts.length > 0 ? { color: alertFilter === 'alerts_only' ? undefined : '#b45309' } : undefined}
          >
            ⚠️ Active Alerts ({sitesWithAlerts.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-secondary)', padding: '40px 0' }}>
          <span className="loading-spinner" />
          Loading sites…
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 0' }}>
          <div className="empty-state-title">No matching sites</div>
          <div className="empty-state-desc">Try clearing filters or search query.</div>
        </div>
      ) : (
        <div className="sites-grid">
          {filtered.map((site) => (
            <SiteCard key={site.id} {...site} />
          ))}
        </div>
      )}
    </>
  );
}
