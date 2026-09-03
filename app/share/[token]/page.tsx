'use client';
import { useEffect, useState, use } from 'react';
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
  time_in_use: number | null;
  flow_rate_gpm: number | null;
  flow_rate_lpm: number | null;
  battery_voltage: number | null;
  slot: number | null;
}

interface SiteDetail {
  id: string;
  name: string;
  location: string;
  format_name: string;
  timezone: string | null;
  most_recent_tx: string | null;
}

type MetricView = 'rate' | 'volume';
type ChartType = 'area' | 'bar';
type Unit = 'gal' | 'liters';

function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes === 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [site, setSite] = useState<SiteDetail | null>(null);
  const [dailyFlow, setDailyFlow] = useState<DailyFlowPoint[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [batteryTrend, setBatteryTrend] = useState<{ date: string; avg_battery: number | null }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [metricView, setMetricView] = useState<MetricView>('rate');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [unit, setUnit] = useState<Unit>('gal');
  const [windowDays, setWindowDays] = useState<'all' | '90' | '30' | '14' | '7'>('90');

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError(data.error ?? 'This link is not available.');
          return;
        }
        setSite(data.site);
        setDailyFlow(data.dailyFlow ?? []);
        setMessages(data.recentMessages ?? []);
        setBatteryTrend(data.batteryTrend ?? []);
      })
      .catch(() => setError('Failed to load data. Please try again.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#64748b', padding: '80px 0' }}>
        <div style={{
          width: 20, height: 20, border: '3px solid #e2e8f0',
          borderTopColor: '#14b8a6', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        Loading site data…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div style={{
        textAlign: 'center', padding: '80px 0',
        color: '#64748b'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔗</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
          {error === 'This share link has been revoked'
            ? 'This link has been deactivated'
            : 'Link not found'}
        </div>
        <div style={{ fontSize: '0.9rem' }}>
          {error ?? 'This share link is invalid or no longer active.'}
        </div>
      </div>
    );
  }

  const visibleFlowData = windowDays === 'all' ? dailyFlow : dailyFlow.slice(-Number(windowDays));

  const totalGal = visibleFlowData.reduce((s, r) => s + (r.total_gal ?? 0), 0);
  const totalLiters = totalGal * 3.78541;

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

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    fontSize: '0.8rem',
    fontWeight: active ? 600 : 400,
    border: `1px solid ${active ? '#14b8a6' : '#e2e8f0'}`,
    background: active ? '#14b8a6' : '#ffffff',
    color: active ? '#ffffff' : '#64748b',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  const card: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    marginBottom: 24,
  };

  const cardHeader: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #f1f5f9',
    flexWrap: 'wrap',
    gap: 10,
  };

  const cardBody: React.CSSProperties = {
    padding: '16px 20px',
  };

  return (
    <>
      {/* Site Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>
            {site.name}
          </h1>
          <span style={{
            padding: '3px 10px', borderRadius: 6,
            background: '#f0fdfa', border: '1px solid #99f6e4',
            color: '#0d9488', fontSize: '0.8rem', fontWeight: 600
          }}>
            {site.id}
          </span>
          {site.location && (
            <span style={{
              padding: '3px 10px', borderRadius: 6,
              background: '#f8fafc', border: '1px solid #e2e8f0',
              color: '#64748b', fontSize: '0.8rem'
            }}>
              {site.location}
            </span>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
          {site.format_name} · Times in {site.timezone || 'UTC'}
        </p>
      </div>

      {/* Metric Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 14,
        marginBottom: 24,
      }}>
        {[
          {
            label: `Avg Flow Rate (${windowLabel})`,
            value: unit === 'gal'
              ? (windowAvgGpm !== null ? `${windowAvgGpm.toFixed(1)}` : '—')
              : (windowAvgLpm !== null ? `${windowAvgLpm.toFixed(1)}` : '—'),
            unit: `${currentRateUnit} active pumping`,
            accent: '#6366f1',
          },
          {
            label: `Total Flow (${windowLabel})`,
            value: unit === 'gal'
              ? (totalGal >= 1000 ? `${(totalGal / 1000).toFixed(1)}K` : Math.round(totalGal).toLocaleString())
              : (totalLiters >= 1000 ? `${(totalLiters / 1000).toFixed(1)}K` : Math.round(totalLiters).toLocaleString()),
            unit: unit === 'gal' ? 'Gallons' : 'Liters',
            accent: '#14b8a6',
          },
          {
            label: 'Active Days',
            value: String(activeDaysWithFlow.length),
            unit: 'Days with flow in window',
            accent: '#14b8a6',
          },
          {
            label: 'Avg Battery',
            value: avgBattery ? `${avgBattery.toFixed(1)}V` : '—',
            unit: 'Voltage (30-day avg)',
            accent: '#14b8a6',
          },
        ].map((m) => (
          <div key={m.label} style={{
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            borderLeft: `4px solid ${m.accent}`,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              {m.label}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: m.accent, lineHeight: 1.1 }}>
              {m.value}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 3 }}>
              {m.unit}
            </div>
          </div>
        ))}
      </div>

      {/* Main Chart Card */}
      <div style={card}>
        <div style={cardHeader}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b', marginBottom: 2 }}>
              {metricView === 'rate' ? 'Daily Operating Flow Rate vs Period Constant Average' : 'Daily Total Water Volume'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {metricView === 'rate'
                ? `Dashed line = ${windowLabel} constant avg (${currentPeriodAverage?.toFixed(1) ?? '—'} ${currentRateUnit})`
                : `Hover to view daily flow rate & run time`}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {/* Metric View */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={toggleStyle(metricView === 'rate')} onClick={() => setMetricView('rate')}>⚡ Flow Rate</button>
              <button style={toggleStyle(metricView === 'volume')} onClick={() => setMetricView('volume')}>💧 Volume</button>
            </div>

            {/* Time Window */}
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', '90', '30', '14', '7'] as const).map((w) => (
                <button key={w} style={toggleStyle(windowDays === w)} onClick={() => setWindowDays(w)}>
                  {w === 'all' ? 'All' : `${w}D`}
                </button>
              ))}
            </div>

            {/* Units */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={toggleStyle(unit === 'gal')} onClick={() => setUnit('gal')}>Gal</button>
              <button style={toggleStyle(unit === 'liters')} onClick={() => setUnit('liters')}>L</button>
            </div>

            {/* Chart Type */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={toggleStyle(chartType === 'area')} onClick={() => setChartType('area')}>Area</button>
              <button style={toggleStyle(chartType === 'bar')} onClick={() => setChartType('bar')}>Bar</button>
            </div>
          </div>
        </div>

        <div style={{ ...cardBody, height: 360 }}>
          {metricView === 'rate' ? (
            <FlowRateChart data={visibleFlowData} unit={unit} periodAverage={currentPeriodAverage} chartType={chartType} />
          ) : chartType === 'area' ? (
            <FlowAreaChart data={visibleFlowData} unit={unit} />
          ) : (
            <FlowBarChart data={visibleFlowData} unit={unit} />
          )}
        </div>
      </div>

      {/* Battery Chart */}
      {batteryTrend.length > 0 && (
        <div style={card}>
          <div style={cardHeader}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>Battery Voltage (Last 30 Days)</div>
          </div>
          <div style={{ ...cardBody, height: 220 }}>
            <BatteryChart data={batteryTrend} />
          </div>
        </div>
      )}

      {/* Recent Transmissions Table */}
      <div style={card}>
        <div style={cardHeader}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
            Recent Transmissions
            <span style={{
              marginLeft: 8, padding: '2px 8px', borderRadius: 4,
              background: '#f1f5f9', color: '#64748b', fontSize: '0.75rem', fontWeight: 400
            }}>
              Latest 200 Slots
            </span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={toggleStyle(unit === 'gal')} onClick={() => setUnit('gal')}>Gallons</button>
            <button style={toggleStyle(unit === 'liters')} onClick={() => setUnit('liters')}>Liters</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {[
                  `Time (${site.timezone || 'UTC'})`, 'Slot',
                  `Flow 1 (${unit === 'gal' ? 'Gal' : 'L'})`,
                  `Flow 2 (${unit === 'gal' ? 'Gal' : 'L'})`,
                  `Total (${unit === 'gal' ? 'Gal' : 'L'})`,
                  'Run Time',
                  `Flow Rate (${unit === 'gal' ? 'GPM' : 'LPM'})`,
                  'Battery (V)',
                ].map((h) => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {messages.map((m, i) => {
                const f1 = unit === 'gal' ? m.flow_volume : (m.flow_volume ? Math.round(m.flow_volume * 3.78541) : null);
                const f2 = unit === 'gal' ? m.flow2_volume : (m.flow2_volume ? Math.round(m.flow2_volume * 3.78541) : null);
                const tot = unit === 'gal' ? m.total_volume : (m.total_volume ? Math.round(m.total_volume * 3.78541) : null);
                const rate = unit === 'gal' ? m.flow_rate_gpm : m.flow_rate_lpm;
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {formatSiteTime(m.timestamp, site.timezone)}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, background: '#f0fdfa', color: '#0d9488', fontSize: '0.76rem', fontWeight: 600 }}>
                        Slot {m.slot ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>{f1 !== null ? f1.toLocaleString() : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>{f2 !== null ? f2.toLocaleString() : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600 }}>{tot !== null ? tot.toLocaleString() : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>{formatMinutes(m.time_in_use)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: (rate && rate > 0) ? '#4338ca' : '#94a3b8' }}>
                      {rate && rate > 0 ? `${rate.toFixed(1)} ${unit === 'gal' ? 'GPM' : 'LPM'}` : '—'}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>{m.battery_voltage?.toFixed(2) ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      <div style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '0.75rem', marginTop: 16 }}>
        Water system telemetry data · {new Date().getFullYear()}
      </div>
    </>
  );
}
