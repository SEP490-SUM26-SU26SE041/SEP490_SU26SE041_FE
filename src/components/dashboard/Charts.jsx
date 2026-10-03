import React, { useState, useMemo } from 'react';

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
  const [hoverIdx, setHoverIdx] = useState(null);

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
    return { x, y, ...d, idx: i };
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

  // Số điểm quá nhiều → chỉ show dots ở min/max + cuối
  const isDense = points.length > 20;
  const dotIndices = useMemo(() => {
    if (!showDots) return new Set();
    if (!isDense) return new Set(points.map((_, i) => i));
    // Dense: lọc dots cách nhau ít nhất 8% width để tránh chồng chéo
    const minPxGap = width * 0.08; // ~48px trên viewBox 600
    const selected = new Set([0, points.length - 1]);
    // Thêm min/max nếu chưa có và không quá gần
    const minIdx = values.indexOf(Math.min(...values));
    const maxIdx = values.indexOf(Math.max(...values));
    const candidateIdxs = [minIdx, maxIdx].filter(i => i > 0 && i < points.length - 1);
    // Sắp theo thứ tự
    candidateIdxs.sort((a, b) => a - b);
    for (const idx of candidateIdxs) {
      // Kiểm tra khoảng cách với dot đã chọn gần nhất
      const sortedSelected = [...selected].sort((a, b) => a - b);
      const tooClose = sortedSelected.some(s => Math.abs(s - idx) * stepX < minPxGap);
      if (!tooClose) selected.add(idx);
    }
    return selected;
  }, [points.length, showDots, isDense, values.join(','), stepX, width]);

  // Tính toán hover overlay (crosshair + tooltip)
  const hoverPoint = hoverIdx !== null ? points[hoverIdx] : null;

  // Xử lý mouse move trên SVG
  const handleMouseMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    // Convert pixel X → viewBox X
    const ratio = width / rect.width;
    const vbX = (e.clientX - rect.left) * ratio;
    if (vbX < padding.left || vbX > width - padding.right) {
      setHoverIdx(null);
      return;
    }
    // Tìm index gần nhất
    const idx = Math.round((vbX - padding.left) / stepX);
    const clamped = Math.max(0, Math.min(points.length - 1, idx));
    setHoverIdx(clamped);
  };

  return (
    <div className="w-full overflow-visible relative" style={{ zIndex: hoverIdx !== null ? 20 : 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full cursor-crosshair"
        style={{ height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
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

        {/* dots - chỉ hiện khi không dày */}
        {showDots && points.map((p) => {
          if (!dotIndices.has(p.idx)) return null;
          const isHovered = hoverIdx === p.idx;
          return (
            <g key={p.idx}>
              <circle
                cx={p.x} cy={p.y}
                r={isHovered ? 5 : 3.5}
                fill="white"
                stroke={color}
                strokeWidth={isHovered ? 2.5 : 2}
              />
              {isHovered && (
                <circle cx={p.x} cy={p.y} r="2.5" fill={color} />
              )}
            </g>
          );
        })}

        {/* hover crosshair line */}
        {hoverPoint && (
          <line
            x1={hoverPoint.x} x2={hoverPoint.x}
            y1={padding.top} y2={padding.top + innerH}
            stroke={color}
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.5"
          />
        )}

        {/* X-axis labels - smart spacing, tối đa 6 labels, dùng pixel distance */}
        {showLabels && points.length > 0 && points.map((p, i) => {
          // Cứng: tối đa 6 labels (giảm mật độ), mỗi label cách nhau >= 48px
          const MIN_DIST_PX = 48;
          const MAX_LABELS = 6;
          const isHHMMSS = (p.label || '').length >= 7;
          const labelWidth = isHHMMSS ? 42 : 30;
          const minDistPx = Math.max(MIN_DIST_PX, labelWidth + 8);
          // Step dựa trên MAX_LABELS cố định (6) - không phụ thuộc width
          const step = Math.max(1, Math.floor(points.length / MAX_LABELS));
          const isFirst = i === 0;
          const isLast = i === points.length - 1;
          const isStep = i % step === 0;
          if (!isFirst && !isLast && !isStep) return null;
          // Tính pixel distance tới label trước đã hiển thị gần nhất
          for (let j = i - 1; j >= 0; j--) {
            const jFirst = j === 0;
            const jLast = j === points.length - 1;
            const jStep = j % step === 0;
            if (jFirst || jLast || jStep) {
              const distPx = Math.abs(p.x - points[j].x);
              if (distPx < minDistPx && !isLast) return null;
              break;
            }
          }
          return (
            <text
              key={i}
              x={p.x}
              y={height - 8}
              fontSize="9"
              fill="#94a3b8"
              textAnchor={isFirst ? 'start' : (isLast ? 'end' : 'middle')}
              fontFamily="JetBrains Mono, monospace"
            >
              {p.label || ''}
            </text>
          );
        })}
      </svg>

      {/* Tooltip HTML overlay */}
      {hoverPoint && (() => {
        // Tính % Y của hover point → nếu > 70% (gần đáy) thì tooltip nằm phía trên
        const yPct = (hoverPoint.y / height) * 100;
        const isLow = yPct > 65;
        return (
          <div
            className="absolute pointer-events-none bg-slate-900/95 text-white rounded-lg px-2.5 py-1.5 text-[10px] font-bold shadow-xl border border-white/20"
            style={{
              left: `${(hoverPoint.x / width) * 100}%`,
              top: `${yPct}%`,
              transform: `translate(-50%, ${isLow ? '-130%' : '20%'})`,
              whiteSpace: 'nowrap',
              zIndex: 10
            }}
          >
            <div className="font-mono text-[10px] opacity-70">{hoverPoint.label}</div>
            <div className="text-sm font-black">
              {hoverPoint.value}{unit}
            </div>
          </div>
        );
      })()}

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
          // Tối đa 6 labels cố định, min distance 48px
          const MIN_DIST_PX = 48;
          const MAX_LABELS = 6;
          const isHHMMSS = (lbl || '').length >= 7;
          const labelWidth = isHHMMSS ? 42 : 30;
          const minDistPx = Math.max(MIN_DIST_PX, labelWidth + 8);
          const step = Math.max(1, Math.floor(labels.length / MAX_LABELS));
          const isFirst = i === 0;
          const isLast = i === labels.length - 1;
          const isStep = i % step === 0;
          if (!isFirst && !isLast && !isStep) return null;
          // Distance check với label trước đã hiển thị
          for (let j = i - 1; j >= 0; j--) {
            const jFirst = j === 0;
            const jLast = j === labels.length - 1;
            const jStep = j % step === 0;
            if (jFirst || jLast || jStep) {
              const distPx = Math.abs(i - j) * stepX;
              if (distPx < minDistPx && !isLast) return null;
              break;
            }
          }
          return (
            <text key={i} x={padding.left + i * stepX} y={height - 8} fontSize="9"
              fill="#94a3b8"
              textAnchor={isFirst ? 'start' : (isLast ? 'end' : 'middle')}
              fontFamily="JetBrains Mono, monospace">
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

// Heatmap (device status grid - 1 cell = 1 thiết bị)
export const StatusHeatmap = ({ cells = [] }) => {
  const colorMap = {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-rose-500',
    inactive: 'bg-slate-300',
    active: 'bg-primary'
  };
  const labelMap = {
    healthy: 'Online',
    warning: 'Mất kết nối',
    critical: 'Lỗi',
    inactive: 'Ngưng',
    active: 'Hoạt động'
  };
  if (!cells.length) {
    return (
      <div className="py-8 text-center text-xs text-on-surface-variant italic">
        Chưa có thiết bị nào
      </div>
    );
  }
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
      {cells.map((c, i) => (
        <div
          key={i}
          title={`${c.label} - ${labelMap[c.status] || c.status}`}
          className={`aspect-square rounded-lg ${colorMap[c.status] || 'bg-slate-200'} flex flex-col items-center justify-center text-white cursor-pointer hover:scale-110 transition-transform shadow-sm`}
        >
          <span className="text-base">📡</span>
          <span className="text-[9px] font-bold leading-none mt-0.5 px-1 truncate w-full text-center">
            {c.label?.slice(-4) || `#${i + 1}`}
          </span>
        </div>
      ))}
    </div>
  );
};