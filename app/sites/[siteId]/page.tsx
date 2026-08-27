'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  FlowAreaChart,
  FlowBarChart,
  FlowRateChart,
  BatteryChart,
  DailyFlowPoint,
} from '@/components/FlowCharts';
import { formatSiteTime } from '@/lib/formatDate';

interface Message {
  id: string;
  timestamp: string;
  flow_volume: number | null;
  flow2_volume: number | null;
  total_volume: number | null;
  dosing_pump: number | null;
  time_in_use: number | null;
  flow_rate_gpm: number | null;
  flow_rate_lpm: number | null;
  battery_voltage: number | null;
  slot: number | null;
  backfill: number | null;
}

interface SiteDetail {
  id: string;
  name: string;
  location: string;
  format_name: string;
  timezone: string | null;
  most_recent_tx: string | null;
  last_synced_at: string | null;
}

interface NotificationItem {
  id: string;
  site_id: string;
  timestamp: string;
  notification_type_name: string;
  severity: number;
  unresolved: boolean;
  info: any;
  dismissed: boolean;
  dismissed_at: string | null;
}

type MetricView = 'rate' | 'volume';
type ChartType = 'area' | 'bar';
type Unit = 'gal' | 'liters';

function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes === 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

function formatTypeName(raw: string): string {
  switch (raw) {
    case 'LOW_FLOW_RATE':
      return 'Low Flow Rate';
    case 'LOW_FLOW':
      return 'Low Daily Flow';
    case 'NO_FLOW_MULTIPLE_DAYS':
      return 'No Flow (Multiple Days)';
    case 'NO_USAGE_MSG':
      return 'Missing Usage Message';
    case 'NO_STATUS_MSG':
      return 'Missing Status Message';
    case 'NO_DIAG_MSG':
      return 'Missing Diagnostic Message';
    case 'SAT_BATTERY_LOW':
      return 'Satellite Battery Low';
    case 'UNEXPECTED_GPS_LOC':
      return 'Unexpected GPS Location';
    default:
      return raw.replace(/_/g, ' ');
  }
}

function renderDiagnosticInfo(info: any) {
  if (!info) return null;
  const items = Array.isArray(info) ? info : [info];
  if (items.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
      {items.map((item, idx) => {
        if (typeof item !== 'object' || item === null) {
          return <span key={idx} className="badge badge-default">{String(item)}</span>;
        }
        return Object.entries(item).map(([k, v]) => (
          <span
            key={k}
            style={{
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(0,0,0,0.06)',
              color: 'inherit',
            }}
          >
            <strong>{k.replace(/_/g, ' ')}:</strong> {String(v)}
          </span>
        ));
      })}
    </div>
  );
}

export default function SitePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = use(params);

  const [site, setSite] = useState<SiteDetail | null>(null);
  const [dailyFlow, setDailyFlow] = useState<DailyFlowPoint[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [batteryTrend, setBatteryTrend] = useState<{ date: string; avg_battery: number | null }[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showDismissed, setShowDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [metricView, setMetricView] = useState<MetricView>('rate');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [unit, setUnit] = useState<Unit>('gal');
  const [windowDays, setWindowDays] = useState<'all' | '90' | '30' | '14' | '7'>('90');

  useEffect(() => {
    fetch(`/api/sites/${siteId}`)
      .then((r) => r.json())
      .then((d) => {
        setSite(d.site);
        setDailyFlow(d.dailyFlow ?? []);
        setMessages(d.recentMessages ?? []);
        setBatteryTrend(d.batteryTrend ?? []);
        setNotifications(d.notifications ?? []);
      })
      .finally(() => setLoading(false));
  }, [siteId]);

  async function toggleDismiss(notifId: string, currentDismissed: boolean) {
    const nextState = !currentDismissed;
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, dismissed: nextState } : n))
    );

    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notifId, dismissed: nextState }),
      });
    } catch (err) {
      console.error('Failed to update notification dismissal state:', err);
    }
  }

  const activeAlerts = notifications.filter((n) => n.unresolved && !n.dismissed);
  const visibleAlerts = showDismissed ? notifications : activeAlerts;

  const visibleFlowData = windowDays === 'all'
    ? dailyFlow
    : dailyFlow.slice(-Number(windowDays));

  // Cumulative volume for the selected window
  const totalGal = visibleFlowData.reduce((s, r) => s + (r.total_gal ?? 0), 0);
  const totalLiters = totalGal * 3.78541;

  // Average Operating Flow Rate calculation (EXCLUDING zero flow rates)
  const activeDaysWithFlow = visibleFlowData.filter(
    (r) => (r.total_mins ?? 0) > 0 && (r.total_gal ?? 0) > 0
  );
  const totalActiveGal = activeDaysWithFlow.reduce((s, r) => s + (r.total_gal ?? 0), 0);
  const totalActiveMins = activeDaysWithFlow.reduce((s, r) => s + (r.total_mins ?? 0), 0);

  const windowAvgGpm = totalActiveMins > 0 ? totalActiveGal / totalActiveMins : null;
  const windowAvgLpm = windowAvgGpm !== null ? windowAvgGpm * 3.78541 : null;

  const currentPeriodAverage = unit === 'gal' ? windowAvgGpm : windowAvgLpm;
  const currentRateUnit = unit === 'gal' ? 'GPM' : 'LPM';

  const windowLabel = windowDays === 'all' ? 'All-Time' : `${windowDays}-Day`;

  const avgBattery = batteryTrend.length
    ? batteryTrend.reduce((s, r) => s + (r.avg_battery ?? 0), 0) / batteryTrend.filter((r) => r.avg_battery).length
    : null;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-secondary)', padding: '64px 0' }}>
        <span className="loading-spinner" />
        Loading site data…
      </div>
    );
  }

  if (!site) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-title">Site not found</div>
        <div className="empty-state-desc">Try syncing first or go back to the dashboard.</div>
        <Link href="/" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>← Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <>
      <Link href="/" className="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Dashboard
      </Link>

      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>{site.name}</h1>
          <span className="badge badge-teal" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>{site.id}</span>
          {site.location && <span className="badge badge-default">{site.location}</span>}
          {site.timezone && <span className="badge badge-teal" style={{ fontSize: '0.78rem' }}>🌐 {site.timezone}</span>}
        </div>
        <p className="page-subtitle">{site.format_name} · All times formatted in Site Local Time ({site.timezone || 'UTC'})</p>
      </div>

      {/* Active Alerts / Warnings Card */}
      {notifications.length > 0 && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            borderColor: activeAlerts.length > 0 ? '#fde68a' : undefined,
            background: activeAlerts.length > 0 ? '#fffdf7' : undefined,
          }}
        >
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.2rem' }}>{activeAlerts.length > 0 ? '⚠️' : '✅'}</span>
              <span className="card-title" style={{ color: activeAlerts.length > 0 ? '#92400e' : 'inherit' }}>
                {activeAlerts.length > 0
                  ? `Active Warnings (${activeAlerts.length})`
                  : 'Site Notifications'}
              </span>
              {activeAlerts.length === 0 && (
                <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>No active alerts</span>
              )}
            </div>

            <div style={{ marginLeft: 'auto' }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                onClick={() => setShowDismissed(!showDismissed)}
              >
                {showDismissed ? 'Hide Dismissed' : `View All / History (${notifications.length})`}
              </button>
            </div>
          </div>

          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visibleAlerts.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: '8px 0' }}>
                All site warnings have been acknowledged or resolved.
              </div>
            ) : (
              visibleAlerts.map((n) => {
                const isDismissed = n.dismissed;
                const isUnresolved = n.unresolved;

                return (
                  <div
                    key={n.id}
                    style={{
                      padding: 14,
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: isDismissed ? '#e5e7eb' : isUnresolved ? '#fed7aa' : '#bbf7d0',
                      background: isDismissed ? '#f9fafb' : isUnresolved ? '#fff7ed' : '#f0fdf4',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 16,
                      flexWrap: 'wrap',
                      opacity: isDismissed ? 0.75 : 1,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '0.92rem', color: isDismissed ? '#4b5563' : isUnresolved ? '#9a3412' : '#166534' }}>
                          {formatTypeName(n.notification_type_name)}
                        </strong>
                        <span className="badge badge-default" style={{ fontSize: '0.7rem' }}>
                          {formatSiteTime(n.timestamp, site.timezone)}
                        </span>
                        {isDismissed ? (
                          <span className="badge badge-default" style={{ fontSize: '0.68rem' }}>Acknowledged</span>
                        ) : isUnresolved ? (
                          <span className="badge badge-amber" style={{ fontSize: '0.68rem' }}>Active</span>
                        ) : (
                          <span className="badge badge-green" style={{ fontSize: '0.68rem' }}>Resolved</span>
                        )}
                      </div>

                      {renderDiagnosticInfo(n.info)}
                    </div>

                    <button
                      className="btn btn-secondary"
                      style={{
                        fontSize: '0.75rem',
                        padding: '5px 12px',
                        background: isDismissed ? '#ffffff' : '#fff',
                        borderColor: isDismissed ? '#d1d5db' : '#f59e0b',
                        color: isDismissed ? 'var(--text-secondary)' : '#92400e',
                      }}
                      onClick={() => toggleDismiss(n.id, isDismissed)}
                    >
                      {isDismissed ? '↩ Un-dismiss' : '✓ Acknowledge / Dismiss'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Metric Strip */}
      <div className="metric-strip" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        {/* Dynamic Period Average Flow Rate Card */}
        <div className="metric-card" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="metric-label">Avg Flow Rate ({windowLabel})</div>
          <div className="metric-value" style={{ color: '#4338ca' }}>
            {unit === 'gal'
              ? (windowAvgGpm !== null ? `${windowAvgGpm.toFixed(1)}` : '—')
              : (windowAvgLpm !== null ? `${windowAvgLpm.toFixed(1)}` : '—')}
          </div>
          <div className="metric-unit">
            {unit === 'gal' ? 'GPM' : 'LPM'} (active pumping)
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Flow ({windowLabel})</div>
          <div className="metric-value">
            {unit === 'gal'
              ? (totalGal >= 1000 ? `${(totalGal / 1000).toFixed(1)}K` : Math.round(totalGal).toLocaleString())
              : (totalLiters >= 1000 ? `${(totalLiters / 1000).toFixed(1)}K` : Math.round(totalLiters).toLocaleString())}
          </div>
          <div className="metric-unit">{unit === 'gal' ? 'Gallons' : 'Liters'}</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Active Days</div>
          <div className="metric-value">{activeDaysWithFlow.length}</div>
          <div className="metric-unit">Days with flow in window</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Avg Battery</div>
          <div className="metric-value">{avgBattery ? `${avgBattery.toFixed(1)}V` : '—'}</div>
          <div className="metric-unit">Voltage (30-day avg)</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Records</div>
          <div className="metric-value">{messages.length.toLocaleString()}+</div>
          <div className="metric-unit">Transmissions synced</div>
        </div>
      </div>

      {/* Main Flow Chart Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="card-title">
                {metricView === 'rate'
                  ? `Daily Operating Flow Rate vs Period Constant Average`
                  : `Daily Total Water Volume`}
              </span>
              {metricView === 'rate' && currentPeriodAverage !== null && (
                <span
                  className="badge"
                  style={{
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    color: '#b45309',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  Constant Avg: {currentPeriodAverage.toFixed(1)} {currentRateUnit}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {metricView === 'rate'
                ? `(Dashed orange line shows the ${windowLabel} constant average of ${currentPeriodAverage ? currentPeriodAverage.toFixed(1) : '—'} ${currentRateUnit})`
                : `(Hover over any bar to view Daily Flow Rate & Run Time)`}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
            {/* View Mode Toggle: Flow Rate vs Volume */}
            <div className="toggle-group">
              <button
                className={`toggle-btn ${metricView === 'rate' ? 'active' : ''}`}
                onClick={() => setMetricView('rate')}
                style={metricView === 'rate' ? { background: '#6366f1', color: '#fff' } : undefined}
              >
                ⚡ Flow Rate ({unit === 'gal' ? 'GPM' : 'LPM'})
              </button>
              <button
                className={`toggle-btn ${metricView === 'volume' ? 'active' : ''}`}
                onClick={() => setMetricView('volume')}
              >
                💧 Total Volume
              </button>
            </div>

            {/* Time Window Presets */}
            <div className="toggle-group">
              <button className={`toggle-btn ${windowDays === 'all' ? 'active' : ''}`} onClick={() => setWindowDays('all')}>All Time</button>
              <button className={`toggle-btn ${windowDays === '90' ? 'active' : ''}`} onClick={() => setWindowDays('90')}>90D</button>
              <button className={`toggle-btn ${windowDays === '30' ? 'active' : ''}`} onClick={() => setWindowDays('30')}>30D</button>
              <button className={`toggle-btn ${windowDays === '14' ? 'active' : ''}`} onClick={() => setWindowDays('14')}>14D</button>
              <button className={`toggle-btn ${windowDays === '7' ? 'active' : ''}`} onClick={() => setWindowDays('7')}>7D</button>
            </div>

            {/* Units Toggle */}
            <div className="toggle-group">
              <button className={`toggle-btn ${unit === 'gal' ? 'active' : ''}`} onClick={() => setUnit('gal')}>Gallons</button>
              <button className={`toggle-btn ${unit === 'liters' ? 'active' : ''}`} onClick={() => setUnit('liters')}>Liters</button>
            </div>

            {/* Chart Style (Area/Bar) - now available for BOTH Flow Rate and Volume! */}
            <div className="toggle-group">
              <button className={`toggle-btn ${chartType === 'area' ? 'active' : ''}`} onClick={() => setChartType('area')}>Area</button>
              <button className={`toggle-btn ${chartType === 'bar' ? 'active' : ''}`} onClick={() => setChartType('bar')}>Bar</button>
            </div>
          </div>
        </div>

        <div className="card-body">
          {dailyFlow.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="empty-state-title">No flow data yet</div>
              <div className="empty-state-desc">Sync the site to pull telemetry data.</div>
            </div>
          ) : (
            <div className="chart-container-tall">
              {metricView === 'rate' ? (
                <FlowRateChart
                  data={visibleFlowData}
                  unit={unit}
                  periodAverage={currentPeriodAverage}
                  chartType={chartType}
                />
              ) : chartType === 'area' ? (
                <FlowAreaChart data={visibleFlowData} unit={unit} />
              ) : (
                <FlowBarChart data={visibleFlowData} unit={unit} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Battery Chart */}
      {batteryTrend.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">Battery Voltage (Last 30 Days)</span>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <BatteryChart data={batteryTrend} />
            </div>
          </div>
        </div>
      )}

      {/* Recent Transmissions Table */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span className="card-title">Recent Transmissions ({site.timezone || 'UTC'} Time)</span>
            <span className="badge badge-default" style={{ marginLeft: 8 }}>Latest 200 Slots</span>
          </div>
          <div className="toggle-group">
            <button className={`toggle-btn ${unit === 'gal' ? 'active' : ''}`} onClick={() => setUnit('gal')}>Gallons (GPM)</button>
            <button className={`toggle-btn ${unit === 'liters' ? 'active' : ''}`} onClick={() => setUnit('liters')}>Liters (LPM)</button>
          </div>
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Site Local Time ({site.timezone || 'UTC'})</th>
                <th>Slot</th>
                <th style={{ textAlign: 'right' }}>Flow 1 ({unit === 'gal' ? 'Gal' : 'L'})</th>
                <th style={{ textAlign: 'right' }}>Flow 2 ({unit === 'gal' ? 'Gal' : 'L'})</th>
                <th style={{ textAlign: 'right' }}>Total Volume ({unit === 'gal' ? 'Gal' : 'L'})</th>
                <th style={{ textAlign: 'center' }}>Active Run Time</th>
                <th style={{ textAlign: 'right', color: '#4338ca' }}>Flow Rate ({unit === 'gal' ? 'GPM' : 'LPM'})</th>
                <th style={{ textAlign: 'right' }}>Battery (V)</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => {
                const f1 = unit === 'gal' ? m.flow_volume : (m.flow_volume ? Math.round(m.flow_volume * 3.78541) : null);
                const f2 = unit === 'gal' ? m.flow2_volume : (m.flow2_volume ? Math.round(m.flow2_volume * 3.78541) : null);
                const tot = unit === 'gal' ? m.total_volume : (m.total_volume ? Math.round(m.total_volume * 3.78541) : null);
                const rate = unit === 'gal' ? m.flow_rate_gpm : m.flow_rate_lpm;

                return (
                  <tr key={m.id}>
                    <td title={`UTC raw: ${m.timestamp}`} style={{ fontWeight: 500 }}>
                      {formatSiteTime(m.timestamp, site.timezone)}
                    </td>
                    <td><span className="badge badge-teal">Slot {m.slot ?? '—'}</span></td>
                    <td style={{ textAlign: 'right' }}>{f1 !== null ? f1.toLocaleString() : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{f2 !== null ? f2.toLocaleString() : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{tot !== null ? tot.toLocaleString() : '—'}</td>
                    <td style={{ textAlign: 'center' }}>{formatMinutes(m.time_in_use)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: (rate && rate > 0) ? '#4338ca' : 'inherit' }}>
                      {rate && rate > 0 ? `${rate.toFixed(1)} ${unit === 'gal' ? 'GPM' : 'LPM'}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>{m.battery_voltage?.toFixed(2) ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
