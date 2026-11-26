import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { type TrendPoint } from '../api/client';
import { format, parseISO } from 'date-fns';

interface Props {
  trends: TrendPoint[];
}

type SeriesFilter = 'applied' | 'interviews' | 'offers';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--surface-primary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-control)',
        padding: 'var(--space-2) var(--space-3)',
        boxShadow: 'var(--shadow-card)',
        fontSize: 12,
      }}
    >
      <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
        {label}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="status-dot" style={{ backgroundColor: p.stroke }} />
          <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{p.name}:</span>
          <span className="font-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function Charts({ trends }: Props) {
  const [activeSeries, setActiveSeries] = useState<SeriesFilter>('applied');

  const data = trends.map((t) => ({
    ...t,
    date: (() => {
      try {
        return format(parseISO(t.date), 'MMM d');
      } catch {
        return t.date;
      }
    })(),
  }));

  const seriesMeta: Record<SeriesFilter, { label: string; color: string }> = {
    applied: { label: 'Applications', color: '#276568' },
    interviews: { label: 'Interviews', color: '#327595' },
    offers: { label: 'Offers', color: '#2E8059' },
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 8 }}>
        <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>
          Trend analysis
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['applied', 'interviews', 'offers'] as SeriesFilter[]).map((key) => (
            <button
              key={key}
              className={`btn btn-sm ${activeSeries === key ? 'btn-secondary' : 'btn-ghost'}`}
              style={{
                fontSize: 12,
                padding: '2px 8px',
                borderColor: activeSeries === key ? 'var(--border-strong)' : 'transparent',
                fontWeight: activeSeries === key ? 600 : 400,
              }}
              onClick={() => setActiveSeries(key)}
            >
              {seriesMeta[key].label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={seriesMeta[activeSeries].color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={seriesMeta[activeSeries].color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              axisLine={{ stroke: 'var(--border-default)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={activeSeries}
              name={seriesMeta[activeSeries].label}
              stroke={seriesMeta[activeSeries].color}
              strokeWidth={2}
              fill="url(#chartGradient)"
              dot={false}
              activeDot={{ r: 4, fill: seriesMeta[activeSeries].color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
