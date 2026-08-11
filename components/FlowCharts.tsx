'use client';
import {
  ResponsiveContainer, ComposedChart, AreaChart, Area,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Brush
} from 'recharts';

interface DailyFlowPoint {
  date: string;
  total_gal: number;
  total_liters: number;
  flow1_gal: number;
  flow2_gal: number;
  avg_battery: number | null;
  transmissions: number;
}

interface FlowChartProps {
  data: DailyFlowPoint[];
  unit: 'gal' | 'liters';
  showArea?: boolean;
}

const TEAL = '#14b8a6';
const INDIGO = '#6366f1';

function formatDate(d: string) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatVal(v: number, unit: 'gal' | 'liters') {
  if (v === 0) return '0';
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return Math.round(v).toString();
}

export function FlowAreaChart({ data, unit }: FlowChartProps) {
  const key = unit === 'gal' ? 'total_gal' : 'total_liters';
  const label = unit === 'gal' ? 'Gallons' : 'Liters';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="flowGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={TEAL} stopOpacity={0.25} />
            <stop offset="95%" stopColor={TEAL} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => formatVal(v, unit)} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={50} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.07)', fontSize: 12 }}
          formatter={(v: any) => [`${Number(v).toLocaleString()} ${label}`, 'Total Flow']}
          labelFormatter={(d: any) => formatDate(String(d))}
        />
        <Area type="monotone" dataKey={key} stroke={TEAL} strokeWidth={2} fill="url(#flowGradient)" dot={false} activeDot={{ r: 4, fill: TEAL }} />
        <Brush dataKey="date" height={28} stroke="#0d9488" fill="#f0fdfa" tickFormatter={formatDate} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function FlowBarChart({ data, unit }: FlowChartProps) {
  const key = unit === 'gal' ? 'total_gal' : 'total_liters';
  const label = unit === 'gal' ? 'Gallons' : 'Liters';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => formatVal(v, unit)} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={50} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          formatter={(v: any) => [`${Number(v).toLocaleString()} ${label}`, 'Total Flow']}
          labelFormatter={(d: any) => formatDate(String(d))}
        />
        <Bar dataKey={key} fill={TEAL} radius={[3, 3, 0, 0]} maxBarSize={32} />
        <Brush dataKey="date" height={28} stroke="#0d9488" fill="#f0fdfa" tickFormatter={formatDate} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BatteryChart({ data }: { data: { date: string; avg_battery: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="battGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={INDIGO} stopOpacity={0.15} />
            <stop offset="95%" stopColor={INDIGO} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis domain={['auto', 'auto']} tickFormatter={(v) => `${v}V`} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={42} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          formatter={(v: any) => [`${Number(v).toFixed(2)}V`, 'Avg Battery']}
          labelFormatter={(d: any) => formatDate(String(d))}
        />
        <Area type="monotone" dataKey="avg_battery" stroke={INDIGO} strokeWidth={2} fill="url(#battGradient)" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
