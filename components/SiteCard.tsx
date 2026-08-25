'use client';
import Link from 'next/link';

interface SiteCardProps {
  id: string;
  name: string;
  location: string;
  format_name: string;
  most_recent_tx: string | null;
  latest_battery: number | null;
  record_count: number;
  total_flow_gal: number | null;
  active_alerts_count?: number;
  active_alert_types?: string | null;
}

function getLocationBadgeClass(location: string | null) {
  if (!location) return 'badge-default';
  const l = location.toLowerCase();
  if (l.includes('mexico')) return 'badge-mexico';
  if (l.includes('haiti')) return 'badge-haiti';
  if (l.includes('honduras')) return 'badge-honduras';
  return 'badge-default';
}

function formatTx(tx: string | null) {
  if (!tx) return 'No data';
  const d = new Date(tx);
  const now = new Date();
  const diffH = Math.round((now.getTime() - d.getTime()) / 3600000);
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFlow(gal: number | null) {
  if (!gal || gal === 0) return '—';
  if (gal >= 1000000) return `${(gal / 1000000).toFixed(1)}M gal`;
  if (gal >= 1000) return `${(gal / 1000).toFixed(0)}K gal`;
  return `${Math.round(gal)} gal`;
}

function getBatteryStatus(v: number | null): { label: string; cls: string } {
  if (v === null || v === 0) return { label: '—', cls: '' };
  if (v >= 27) return { label: `${v.toFixed(1)}V`, cls: 'badge-green' };
  if (v >= 24) return { label: `${v.toFixed(1)}V`, cls: 'badge-amber' };
  return { label: `${v.toFixed(1)}V`, cls: 'badge-red' };
}

function formatAlertLabel(typesStr: string | null | undefined, count: number): string {
  if (!typesStr) return `${count} Alert${count > 1 ? 's' : ''}`;
  const types = typesStr.split(',');
  if (types.length === 1) {
    return types[0].replace(/_/g, ' ');
  }
  return `${types[0].replace(/_/g, ' ')} (+${types.length - 1} more)`;
}

export default function SiteCard({
  id,
  name,
  location,
  format_name,
  most_recent_tx,
  latest_battery,
  record_count,
  total_flow_gal,
  active_alerts_count,
  active_alert_types,
}: SiteCardProps) {
  const battery = getBatteryStatus(latest_battery);
  const hasAlerts = active_alerts_count !== undefined && active_alerts_count > 0;

  return (
    <Link href={`/sites/${id}`} style={{ textDecoration: 'none' }}>
      <article className="site-card" style={hasAlerts ? { borderLeft: '4px solid #f59e0b' } : undefined}>
        <div className="site-card-header">
          <div>
            <div className="site-card-name">{name}</div>
            <div className="site-card-id">{id}</div>
          </div>
          <span className={`badge ${getLocationBadgeClass(location)}`}>{location || 'N/A'}</span>
        </div>

        {hasAlerts && (
          <div
            style={{
              margin: '8px 0 12px',
              padding: '6px 10px',
              borderRadius: 6,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#b45309',
              fontSize: '0.75rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>⚠️</span>
            <span>{formatAlertLabel(active_alert_types, active_alerts_count)}</span>
          </div>
        )}

        <div className="site-card-stats">
          <div className="stat-item">
            <span className="stat-label">Last TX</span>
            <span className="stat-value">{formatTx(most_recent_tx)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Battery</span>
            <span className="stat-value">
              {battery.label !== '—'
                ? <span className={`badge ${battery.cls}`}>{battery.label}</span>
                : '—'
              }
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Flow</span>
            <span className="stat-value">{formatFlow(total_flow_gal)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Records</span>
            <span className="stat-value">{record_count.toLocaleString()}</span>
          </div>
        </div>

        <div className="site-card-footer">
          <span className="badge badge-default" style={{ fontSize: '0.68rem' }}>{format_name || 'N/A'}</span>
          <span className="view-link">
            View Details
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </span>
        </div>
      </article>
    </Link>
  );
}
