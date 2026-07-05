import React from 'react';

// SVG sparkline / line chart (no external chart library required)
export const LineChart = ({
  data = [],
  height = 160,
  color = '#486730',
  fillColor = 'rgba(72, 103, 48, 0.12)',
  showDots = true,
  showLabels = true,
  yLabel = '',
  xLabel = '',
  unit = ''
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-on-surface-variant italic">
        Chưa có dữ liệu
      </div>
    );
  }

  const width = 600;
  const padding = { top: 16, right: 16, bottom: 28, left: 36 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const values = data.map(d => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const stepX = innerW / Math.max(data.length - 1, 1);

  const points = data.map((d, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + innerH - ((d.value - min) / range) * innerH;
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerH} L ${points[0].x} ${padding.top + innerH} Z`;

  // Y-axis ticks
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = min + (range / ticks) * (ticks - i);
    return { v, y: padding.top + (innerH / ticks) * i };
  });

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {yTicks.map((t, i) => (
          <line
            key={i}
            x1={padding.left}
            x2={width - padding.right}
            y1={t.y}
            y2={t.y}
            stroke="#e5e7eb"
            strokeDasharray="3 3"
          />
        ))}

        {/* Y-axis labels */}
        {showLabels && yTicks.map((t, i) => (
          <text
            key={i}
            x={padding.left - 6}
            y={t.y + 3}
            fontSize="9"
            fill="#94a3b8"
            textAnchor="end"
            fontFamily="JetBrains Mono, monospace"
          >
            {Math.round(t.v)}{unit}
          </text>
        ))}

        {/* area */}
        <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />

        {/* line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* dots */}
        {showDots && points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke={color} strokeWidth="2" />
          </g>
        ))}

        {/* X-axis labels - show every nth to avoid clutter */}
        {showLabels && points.map((p, i) => {
          const step = Math.max(1, Math.floor(points.length / 6));
          if (i % step !== 0 && i !== points.length - 1) return null;
          return (
            <text
              key={i}
              x={p.x}
              y={height - 8}
              fontSize="9"
              fill="#94a3b8"
              textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
            >
              {p.label || ''}
            </text>
          );
        })}
      </svg>
      {(yLabel || xLabel) && (
        <div className="flex justify-between text-[10px] text-on-surface-variant mt-1 px-2">
          <span>{yLabel}</span>
          <span>{xLabel}</span>
        </div>
      )}
    </div>
  );
};

// Multi-series line chart
export const MultiLineChart = ({
  series = [], // [{ name, color, data: [{label, value}] }]
  height = 200,
  unit = ''
}) => {
  if (!series.length || series.every(s => !s.data?.length)) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-on-surface-variant italic">
        Chưa có dữ liệu
      </div>
    );
  }

  const width = 700;
  const padding = { top: 16, right: 16, bottom: 28, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const allValues = series.flatMap(s => s.data.map(d => d.value));
  const max = Math.max(...allValues, 1);
  const min = Math.min(0, ...allValues);
  const range = max - min || 1;
  const labels = series[0]?.data?.map(d => d.label) || [];
  const stepX = innerW / Math.max(labels.length - 1, 1);

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = min + (range / ticks) * (ticks - i);
    return { v, y: padding.top + (innerH / ticks) * i };
  });

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {yTicks.map((t, i) => (
          <line key={i} x1={padding.left} x2={width - padding.right} y1={t.y} y2={t.y}
            stroke="#e5e7eb" strokeDasharray="3 3" />
        ))}

        {yTicks.map((t, i) => (
          <text key={i} x={padding.left - 6} y={t.y + 3} fontSize="9" fill="#94a3b8"
            textAnchor="end" fontFamily="JetBrains Mono, monospace">
            {Math.round(t.v)}{unit}
          </text>
        ))}

        {series.map((s, idx) => {
          const points = s.data.map((d, i) => ({
            x: padding.left + i * stepX,
            y: padding.top + innerH - ((d.value - min) / range) * innerH
          }));
          const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
          return (
            <g key={idx}>
              <path d={linePath} fill="none" stroke={s.color} strokeWidth="2.5"
                strokeLinejoin="round" strokeLinecap="round" />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill="white" stroke={s.color} strokeWidth="2" />
              ))}
            </g>
          );
        })}

        {labels.map((lbl, i) => {
          const step = Math.max(1, Math.floor(labels.length / 7));
          if (i % step !== 0 && i !== labels.length - 1) return null;
          return (
            <text key={i} x={padding.left + i * stepX} y={height - 8} fontSize="9"
              fill="#94a3b8" textAnchor="middle" fontFamily="JetBrains Mono, monospace">
              {lbl}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-2 px-2">
        {series.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: s.color }}></span>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Horizontal bar chart
export const BarChart = ({ data = [], color = '#486730', height = 200, unit = '' }) => {
  if (!data.length) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-on-surface-variant italic">
        Chưa có dữ liệu
      </div>
    );
  }
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2" style={{ minHeight: height }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-32 text-xs font-semibold text-on-surface-variant truncate shrink-0" title={d.label}>
              {d.label}
            </div>
            <div className="flex-1 h-7 bg-surface-container-low rounded-lg overflow-hidden relative">
              <div
                className="h-full rounded-lg flex items-center justify-end px-2 transition-all"
                style={{ width: `${pct}%`, backgroundColor: d.color || color }}
              >
                <span className="text-[10px] font-bold text-white whitespace-nowrap">
                  {d.value}{unit}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Radial gauge / progress donut
export const Gauge = ({ value = 0, max = 100, label = '', color = '#486730', size = 110 }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e5e7eb" strokeWidth="8"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x="50%" y="50%" dy="0.35em" textAnchor="middle"
          fontSize="20" fontWeight="700" fill="#1a1c1c"
          fontFamily="Hanken Grotesk, sans-serif">
          {Math.round(pct)}%
        </text>
      </svg>
      {label && <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{label}</span>}
    </div>
  );
};

// Heatmap (farm grid status)
export const StatusHeatmap = ({ cells = [] }) => {
  return (
    <div className="grid grid-cols-6 md:grid-cols-10 lg:grid-cols-12 gap-1">
      {cells.map((c, i) => {
        const colorMap = {
          healthy: 'bg-emerald-500',
          warning: 'bg-amber-500',
          critical: 'bg-rose-500',
          inactive: 'bg-slate-300',
          active: 'bg-primary'
        };
        return (
          <div
            key={i}
            title={`${c.label || ''} - ${c.status}`}
            className={`aspect-square rounded-md ${colorMap[c.status] || 'bg-slate-200'} flex items-center justify-center text-[10px] font-bold text-white cursor-pointer hover:scale-110 transition-transform`}
          >
            {c.value || ''}
          </div>
        );
      })}
    </div>
  );
};