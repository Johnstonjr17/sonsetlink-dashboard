'use client';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, Cell, AreaChart, Area
} from 'recharts';

const QUARTER_COLORS = ['#0d9488', '#14b8a6', '#2dd4bf', '#99f6e4'];

interface QuarterlySiteData {
  name: string;
  location: string;
  [key: string]: unknown;
}

interface QuarterlyBarChartProps {
  data: QuarterlySiteData[];
  quarters: string[];
  unit: 'gal' | 'liters';
}

function getSuffix(unit: 'gal' | 'liters') {
  return unit === 'gal' ? '_gal' : '_liters';
}

function formatLabel(unit: 'gal' | 'liters') {
  return unit === 'gal' ? 'Gallons' : 'Liters';
}

function shortName(name: string | null | undefined) {
  if (!name) return 'Unnamed Site';
  const str = String(name);
  return str.length > 14 ? str.slice(0, 12) + '…' : str;
}

export function QuarterlyGroupedBar({ data, quarters, unit }: QuarterlyBarChartProps) {
  const suffix = getSuffix(unit);
  const label = formatLabel(unit);

  // Recharts needs data shaped per-site with each quarter as a key
  const chartData = data.map((s) => {
    const row: Record<string, unknown> = { name: shortName(s.name) };
    for (const q of quarters) {
      row[q] = s[`${q}${suffix}`] ?? 0;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} angle={-35} textAnchor="end" interval={0} />
        <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={52} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          formatter={(v: any, name: any) => [`${Number(v).toLocaleString()} ${label}`, name]}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
        {quarters.map((q, i) => (
          <Bar key={q} dataKey={q} fill={QUARTER_COLORS[i]} radius={[3, 3, 0, 0]} maxBarSize={20} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function QuarterlyAreaChart({ data, quarters, unit }: QuarterlyBarChartProps) {
  const suffix = getSuffix(unit);
  const label = formatLabel(unit);

  // For area chart: x = quarters, one line per site
  const chartData = quarters.map((q) => {
    const row: Record<string, unknown> = { quarter: q };
    for (const s of data) {
      row[shortName(s.name)] = s[`${q}${suffix}`] ?? 0;
    }
    return row;
  });

  const COLORS = [
    '#0d9488','#6366f1','#f59e0b','#ef4444','#10b981',
    '#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316',
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          {data.slice(0, 10).map((s, i) => (
            <linearGradient key={s.name} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="quarter" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={52} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }}
          formatter={(v: any, name: any) => [`${Number(v).toLocaleString()} ${label}`, name]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {data.slice(0, 10).map((s, i) => (
          <Area
            key={s.name}
            type="monotone"
            dataKey={shortName(s.name)}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            fill={`url(#grad${i})`}
            dot={{ r: 4, fill: COLORS[i % COLORS.length] }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
