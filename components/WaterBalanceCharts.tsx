'use client';
import {
  ResponsiveContainer, ComposedChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Brush
} from 'recharts';

interface DailyAccountingPoint {
  date: string;
  prod_gal: number;
  prod_liters: number;
  dist_gal: number;
  dist_liters: number;
  balance_gal: number;
  balance_liters: number;
  pct_accounted: number;
  roll7_pct_accounted: number;
  cumul_balance_gal: number;
}

interface WaterBalanceChartProps {
  data: DailyAccountingPoint[];
  unit: 'gal' | 'liters';
}

const PROD_COLOR = '#0d9488';
const DIST_COLOR = '#6366f1';
const PCT_COLOR = '#f59e0b';
const BALANCE_COLOR = '#10b981';

function formatDate(d: string) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatVal(v: number) {
  if (v === 0) return '0';
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return Math.round(v).toString();
}

export function ProductionVsDistributionChart({ data, unit }: WaterBalanceChartProps) {
  const prodKey = unit === 'gal' ? 'prod_gal' : 'prod_liters';
  const distKey = unit === 'gal' ? 'dist_gal' : 'dist_liters';
  const unitLabel = unit === 'gal' ? 'Gal' : 'L';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis yAxisId="left" tickFormatter={formatVal} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={48} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={42} domain={[0, 'auto']} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          formatter={(v: any, name: any) => {
            const num = Number(v);
            if (name === '% Accounted' || name === '7-Day Rolling %') return [`${num}%`, name];
            return [`${num.toLocaleString()} ${unitLabel}`, name];
          }}
          labelFormatter={(d: any) => formatDate(String(d))}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
        <ReferenceLine yAxisId="right" y={100} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '100% Target', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
        <Bar yAxisId="left" dataKey={prodKey} name={`Production (${unitLabel})`} fill={PROD_COLOR} radius={[3, 3, 0, 0]} maxBarSize={24} />
        <Bar yAxisId="left" dataKey={distKey} name={`Distribution (${unitLabel})`} fill={DIST_COLOR} radius={[3, 3, 0, 0]} maxBarSize={24} />
        <Line yAxisId="right" type="monotone" dataKey="roll7_pct_accounted" name="7-Day Rolling %" stroke={PCT_COLOR} strokeWidth={2.5} dot={false} />
        <Brush dataKey="date" height={28} stroke="#0d9488" fill="#f0fdfa" tickFormatter={formatDate} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function CumulativeBalanceChart({ data, unit }: WaterBalanceChartProps) {
  const balanceKey = unit === 'gal' ? 'cumul_balance_gal' : 'cumul_balance_liters';
  const unitLabel = unit === 'gal' ? 'Gal' : 'L';

  const chartData = data.map((d) => ({
    ...d,
    cumul_balance_liters: Math.round(d.cumul_balance_gal * 3.78541),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={BALANCE_COLOR} stopOpacity={0.25} />
            <stop offset="95%" stopColor={BALANCE_COLOR} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={formatVal} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={48} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          formatter={(v: any) => [`${Number(v).toLocaleString()} ${unitLabel}`, 'Cumulative Balance']}
          labelFormatter={(d: any) => formatDate(String(d))}
        />
        <Area type="monotone" dataKey={balanceKey} stroke={BALANCE_COLOR} strokeWidth={2} fill="url(#balanceGrad)" dot={false} />
        <Brush dataKey="date" height={28} stroke="#10b981" fill="#f0fdf4" tickFormatter={formatDate} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
