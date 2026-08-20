'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { FlowAreaChart, FlowBarChart, BatteryChart } from '@/components/FlowCharts';
import { formatSiteTime } from '@/lib/formatDate';

interface DailyFlowPoint {
  date: string;
  total_gal: number;
  total_liters: number;
  flow1_gal: number;
  flow2_gal: number;
  avg_battery: number | null;
  transmissions: number;
}

interface Message {
  id: string;
  timestamp: string;
  flow_volume: number | null;
  flow2_volume: number | null;
  dosing_pump: number | null;
  time_in_use: number | null;
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

type ChartType = 'area' | 'bar';
type Unit = 'gal' | 'liters';

function formatHMS(seconds: number | null) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function SitePage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = use(params);

  const [site, setSite] = useState<SiteDetail | null>(null);
  const [dailyFlow, setDailyFlow] = useState<DailyFlowPoint[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [batteryTrend, setBatteryTrend] = useState<{ date: string; avg_battery: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<ChartType>('area');
  const [unit, setUnit] = useState<Unit>('gal');
  const [windowDays, setWindowDays] = useState<'all' | '90' | '30' | '14' | '7'>('all');

  useEffect(() => {
    fetch(`/api/sites/${siteId}`)
      .then((r) => r.json())
      .then((d) => {
        setSite(d.site);
        setDailyFlow(d.dailyFlow ?? []);
        setMessages(d.recentMessages ?? []);
        setBatteryTrend(d.batteryTrend ?? []);
      })
      .finally(() => setLoading(false));
  }, [siteId]);

  const visibleFlowData = windowDays === 'all'
    ? dailyFlow
    : dailyFlow.slice(-Number(windowDays));

  const totalGal = dailyFlow.reduce((s, r) => s + (r.total_gal ?? 0), 0);
  const totalLiters = totalGal * 3.78541;
  const avgBattery = batteryTrend.length
    ? batteryTrend.reduce((s, r) => s + (r.avg_battery ?? 0), 0) / batteryTrend.filter((r) => r.avg_battery).length
    : null;
  const activeDays = dailyFlow.filter((r) => r.total_gal > 0).length;

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

      {/* Metric Strip */}
      <div className="metric-strip">
        <div className="metric-card">
          <div className="metric-label">Total Flow (Gal)</div>
          <div className="metric-value">{totalGal >= 1000 ? `${(totalGal / 1000).toFixed(1)}K` : Math.round(totalGal).toLocaleString()}</div>
          <div className="metric-unit">Gallons (Total)</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Flow (Liters)</div>
          <div className="metric-value">{totalLiters >= 1000 ? `${(totalLiters / 1000).toFixed(1)}K` : Math.round(totalLiters).toLocaleString()}</div>
          <div className="metric-unit">Liters (Total)</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Active Days</div>
          <div className="metric-value">{activeDays}</div>
          <div className="metric-unit">Days with flow data</div>
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

      {/* Flow Chart Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span className="card-title">Daily Water Flow</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 8 }}>
              (Use slider below chart to zoom & scroll)
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="toggle-group">
              <button className={`toggle-btn ${windowDays === 'all' ? 'active' : ''}`} onClick={() => setWindowDays('all')}>All Time</button>
              <button className={`toggle-btn ${windowDays === '90' ? 'active' : ''}`} onClick={() => setWindowDays('90')}>90D</button>
              <button className={`toggle-btn ${windowDays === '30' ? 'active' : ''}`} onClick={() => setWindowDays('30')}>30D</button>
              <button className={`toggle-btn ${windowDays === '14' ? 'active' : ''}`} onClick={() => setWindowDays('14')}>14D</button>
              <button className={`toggle-btn ${windowDays === '7' ? 'active' : ''}`} onClick={() => setWindowDays('7')}>7D</button>
            </div>
            <div className="toggle-group">
              <button className={`toggle-btn ${unit === 'gal' ? 'active' : ''}`} onClick={() => setUnit('gal')}>Gallons</button>
              <button className={`toggle-btn ${unit === 'liters' ? 'active' : ''}`} onClick={() => setUnit('liters')}>Liters</button>
            </div>
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
              {chartType === 'area'
                ? <FlowAreaChart data={visibleFlowData} unit={unit} />
                : <FlowBarChart data={visibleFlowData} unit={unit} />
              }
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
        <div className="card-header">
          <span className="card-title">Recent Transmissions ({site.timezone || 'UTC'} Time)</span>
          <span className="badge badge-default">Latest 200</span>
        </div>
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Site Local Time ({site.timezone || 'UTC'})</th>
                <th>Flow 1 (Gal)</th>
                <th>Flow 2 (Gal)</th>
                <th>Dosing Pump (Gal)</th>
                <th>Time in Use</th>
                <th>Battery (V)</th>
                <th>Slot</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td title={`UTC raw: ${m.timestamp}`} style={{ fontWeight: 500 }}>
                    {formatSiteTime(m.timestamp, site.timezone)}
                  </td>
                  <td>{m.flow_volume?.toLocaleString() ?? '—'}</td>
                  <td>{m.flow2_volume?.toLocaleString() ?? '—'}</td>
                  <td>{m.dosing_pump?.toLocaleString() ?? '—'}</td>
                  <td>{formatHMS(m.time_in_use)}</td>
                  <td>{m.battery_voltage?.toFixed(2) ?? '—'}</td>
                  <td>{m.slot ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
