import React, { useEffect, useMemo, useState } from 'react';
import { experimentsApi } from '../../../api/experimentApi';
import { useToast } from '../../../context/ToastContext';
import { LineChart, BarChart, Gauge } from '../../../components/dashboard/Charts';

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-600',
  Active: 'bg-emerald-100 text-emerald-700',
  Paused: 'bg-amber-100 text-amber-700',
  Approved: 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-200 text-emerald-800',
  Cancelled: 'bg-rose-100 text-rose-700'
};

const CHART_COLORS = {
  Draft: '#94a3b8',
  Approved: '#3b82f6',
  Active: '#10b981',
  Paused: '#f59e0b',
  Completed: '#059669',
  Cancelled: '#f43f5e'
};

const STATUS_LABELS = {
  Draft: 'Soạn Thảo',
  Approved: 'Đã Duyệt',
  Active: 'Đang Triển Khai',
  Paused: 'Tạm Dừng',
  Completed: 'Hoàn Thành',
  Cancelled: 'Đã Hủy'
};

const ResearcherOverview = () => {
  const { showToast } = useToast();
  const [experiments, setExperiments] = useState([]);
  const [recentExp, setRecentExp] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await experimentsApi.getAll();
        const list = Array.isArray(data) ? data : [];
        setExperiments(list);
        setRecentExp(list.slice(0, 5));
      } catch (err) {
        showToast(err.message || 'Không thể tải dữ liệu', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ---- Aggregate stats ----
  const stats = useMemo(() => ({
    total: experiments.length,
    draft: experiments.filter(e => e.status === 'Draft').length,
    active: experiments.filter(e => e.status === 'Active').length,
    paused: experiments.filter(e => e.status === 'Paused').length,
    approved: experiments.filter(e => e.status === 'Approved').length,
    completed: experiments.filter(e => e.status === 'Completed').length,
    cancelled: experiments.filter(e => e.status === 'Cancelled').length
  }), [experiments]);

  // ---- Status distribution (donut) ----
  const statusDistribution = useMemo(() => {
    const order = ['Active', 'Approved', 'Draft', 'Completed', 'Paused', 'Cancelled'];
    return order
      .map(s => ({
        label: STATUS_LABELS[s] || s,
        value: stats[s.toLowerCase()],
        color: CHART_COLORS[s]
      }))
      .filter(d => d.value > 0);
  }, [stats]);

  // ---- Monthly trend (last 6 months) ----
  const monthlyTrend = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: `T${d.getMonth() + 1}`,
        year: d.getFullYear(),
        month: d.getMonth(),
        created: 0,
        completed: 0
      });
    }
    experiments.forEach(exp => {
      if (!exp.createdAt) return;
      const created = new Date(exp.createdAt);
      const createdKey = `${created.getFullYear()}-${created.getMonth()}`;
      const month = months.find(m => m.key === createdKey);
      if (month) month.created += 1;
      if (exp.status === 'Completed' && exp.endDate) {
        const end = new Date(exp.endDate);
        const endKey = `${end.getFullYear()}-${end.getMonth()}`;
        const endMonth = months.find(m => m.key === endKey);
        if (endMonth) endMonth.completed += 1;
      }
    });
    return months.map(m => [
      { label: m.label, value: m.created },
      { label: m.label, value: m.completed }
    ]);
  }, [experiments]);

  const monthlySeries = useMemo(() => {
    const months = monthlyTrend.map(([c]) => c);
    const createdSeries = monthlyTrend.map(([c, _], i) => ({ label: c.label, value: monthlyTrend[i][0].value }));
    const completedSeries = monthlyTrend.map(([_, c]) => ({ label: c.label, value: monthlyTrend.map(p => p[1].value)[monthlyTrend.findIndex(([_, cc]) => cc.label === c.label)] }));
    void months;
    return [
      { name: 'Tạo Mới', color: '#3b82f6', data: monthlyTrend.map(([c]) => ({ label: c.label, value: c.value })) },
      { name: 'Hoàn Thành', color: '#059669', data: monthlyTrend.map(([, c]) => ({ label: c.label, value: c.value })) }
    ];
  }, [monthlyTrend]);

  // ---- Farm distribution (top farms) ----
  const farmDistribution = useMemo(() => {
    const map = new Map();
    experiments.forEach(exp => {
      const farmName = exp.farmName || 'Khác';
      map.set(farmName, (map.get(farmName) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [experiments]);

  // ---- Crop distribution (top crops) ----
  const cropDistribution = useMemo(() => {
    const map = new Map();
    experiments.forEach(exp => {
      const crop = exp.cropVarietyName || 'Chưa xác định';
      map.set(crop, (map.get(crop) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [experiments]);

  // ---- Completion rate (gauge) ----
  const completionRate = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  }, [stats]);

  // ---- Active rate (gauge) ----
  const activeRate = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.active / stats.total) * 100);
  }, [stats]);

  // ---- Custom donut chart (SVG) ----
  const DonutChart = ({ data, size = 180 }) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) {
      return (
        <div className="h-44 flex items-center justify-center text-xs text-on-surface-variant italic">
          Chưa có dữ liệu
        </div>
      );
    }
    const radius = (size - 16) / 2;
    const cx = size / 2;
    const cy = size / 2;
    let cumulative = 0;
    const slices = data.map((d, i) => {
      const fraction = d.value / total;
      const startAngle = cumulative * 360;
      cumulative += fraction;
      const endAngle = cumulative * 360;
      const startRad = (startAngle - 90) * Math.PI / 180;
      const endRad = (endAngle - 90) * Math.PI / 180;
      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);
      const largeArc = fraction > 0.5 ? 1 : 0;
      return (
        <path
          key={i}
          d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
          fill={d.color}
          className="hover:opacity-80 transition-opacity cursor-pointer"
        >
          <title>{d.label}: {d.value} ({Math.round(fraction * 100)}%)</title>
        </path>
      );
    });
    return (
      <div className="flex items-center gap-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices}
          <circle cx={cx} cy={cy} r={radius * 0.6} fill="white" />
          <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="700"
            fill="#1a1c1c" fontFamily="Hanken Grotesk, sans-serif">
            {total}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fontWeight="700"
            fill="#64748b" fontFamily="Inter, sans-serif" letterSpacing="1">
            T�NG TN
          </text>
        </svg>
        <div className="flex-1 space-y-1.5">
          {data.map((d, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: d.color }}></span>
                <span className="truncate font-semibold text-on-surface">{d.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-on-surface">{d.value}</span>
                <span className="text-on-surface-variant text-[10px]">
                  ({Math.round((d.value / total) * 100)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { label: 'Tổng Thí Nghiệm', value: stats.total, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Đang Soạn Thảo', value: stats.draft, color: 'text-slate-500', bg: 'bg-slate-100' },
          { label: 'Đang Triển Khai', value: stats.active, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Tạm Dừng', value: stats.paused, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Hoàn Thành', value: stats.completed, color: 'text-emerald-700', bg: 'bg-emerald-100' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-outline-variant rounded-2xl p-5 flex flex-col gap-1`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{s.label}</span>
            <span className={`font-hanken text-3xl lg:text-4xl font-bold ${s.color}`}>{loading ? '…' : s.value}</span>
          </div>
        ))}
      </div>

      {/* Charts Row 1: Donut + Gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Distribution Donut */}
        <div className="bg-white border border-outline-variant rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📊</span>
            <h3 className="font-hanken font-bold text-on-surface">Phân Bố Trạng Thái</h3>
          </div>
          {loading ? (
            <div className="h-44 flex items-center justify-center text-sm text-on-surface-variant">Đang tải...</div>
          ) : (
            <DonutChart data={statusDistribution} />
          )}
        </div>

        {/* Completion Rate Gauge */}
        <div className="bg-white border border-outline-variant rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">✅</span>
            <h3 className="font-hanken font-bold text-on-surface">Tỷ Lệ Hoàn Thành</h3>
          </div>
          {loading ? (
            <div className="h-32 flex items-center justify-center text-sm text-on-surface-variant">Đang tải...</div>
          ) : (
            <div className="flex justify-center py-2">
              <Gauge value={completionRate} max={100} color="#059669" size={140} label="Hoàn thành / Tổng số" />
            </div>
          )}
          <p className="text-center text-xs text-on-surface-variant mt-3">
            {stats.completed} / {stats.total} thí nghiệm
          </p>
        </div>

        {/* Active Rate Gauge */}
        <div className="bg-white border border-outline-variant rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🚀</span>
            <h3 className="font-hanken font-bold text-on-surface">Tỷ Lệ Đang Triển Khai</h3>
          </div>
          {loading ? (
            <div className="h-32 flex items-center justify-center text-sm text-on-surface-variant">Đang tải...</div>
          ) : (
            <div className="flex justify-center py-2">
              <Gauge value={activeRate} max={100} color="#3b82f6" size={140} label="Triển khai / Tổng số" />
            </div>
          )}
          <p className="text-center text-xs text-on-surface-variant mt-3">
            {stats.active} / {stats.total} thí nghiệm
          </p>
        </div>
      </div>

      {/* Charts Row 2: Monthly Trend */}
      <div className="bg-white border border-outline-variant rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">📈</span>
          <h3 className="font-hanken font-bold text-on-surface">Xu Hướng 6 Tháng Gần Nhất</h3>
        </div>
        {loading ? (
          <div className="h-48 flex items-center justify-center text-sm text-on-surface-variant">Đang tải...</div>
        ) : (
          <LineChart
            data={monthlySeries[0].data.map((d, i) => ({ label: d.label, value: d.value + monthlySeries[1].data[i].value }))}
            color="#486730"
            height={180}
          />
        )}
        <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-outline-variant">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#3b82f6' }}></span>
            <span className="text-[11px] font-bold text-on-surface-variant">🆕 Thí Nghiệm Tạo Mới</span>
            <span className="text-[11px] font-bold text-blue-600">
              {monthlySeries[0].data.reduce((s, d) => s + d.value, 0)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#059669' }}></span>
            <span className="text-[11px] font-bold text-on-surface-variant">✅ Hoàn Thành</span>
            <span className="text-[11px] font-bold text-emerald-600">
              {monthlySeries[1].data.reduce((s, d) => s + d.value, 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Charts Row 3: Farm & Crop Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Farm Distribution */}
        <div className="bg-white border border-outline-variant rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🏡</span>
            <h3 className="font-hanken font-bold text-on-surface">Top Nông Trại</h3>
          </div>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-sm text-on-surface-variant">Đang tải...</div>
          ) : farmDistribution.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-on-surface-variant italic">
              Chưa có dữ liệu
            </div>
          ) : (
            <BarChart
              data={farmDistribution}
              color="#486730"
              height={180}
              unit=""
            />
          )}
        </div>

        {/* Crop Distribution */}
        <div className="bg-white border border-outline-variant rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🌱</span>
            <h3 className="font-hanken font-bold text-on-surface">Phân Bố Giống Cây</h3>
          </div>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-sm text-on-surface-variant">Đang tải...</div>
          ) : cropDistribution.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-on-surface-variant italic">
              Chưa có dữ liệu
            </div>
          ) : (
            <div className="space-y-2.5">
              {cropDistribution.map((d, i) => {
                const max = Math.max(...cropDistribution.map(x => x.value));
                const pct = (d.value / max) * 100;
                const palette = ['#486730', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-32 text-xs font-semibold text-on-surface-variant truncate shrink-0" title={d.label}>
                      {d.label}
                    </div>
                    <div className="flex-1 h-8 bg-surface-container-low rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg flex items-center justify-end px-3 transition-all"
                        style={{ width: `${pct}%`, backgroundColor: palette[i % palette.length] }}
                      >
                        <span className="text-[11px] font-bold text-white whitespace-nowrap">
                          {d.value} TN
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent experiments */}
      <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-outline-variant flex items-center gap-2">
          <span className="text-lg">�</span>
          <h3 className="font-hanken font-bold text-on-surface">Thí Nghiệm Gần Đây</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">Đang tải...</div>
        ) : recentExp.length === 0 ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">Chưa có thí nghiệm nào.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-outline-variant">
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Mã</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tiêu Đề</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Trạng Thái</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Nông Trại</th>
                <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Ngày Tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {recentExp.map(exp => (
                <tr key={exp.id} className="hover:bg-surface-container/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-[12px] text-primary font-bold">{exp.experimentCode || '—'}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-on-surface line-clamp-1">{exp.title || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[exp.status] || 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABELS[exp.status] || exp.status || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-on-surface-variant">{exp.farmName || '—'}</td>
                  <td className="px-6 py-4 text-xs text-on-surface-variant font-mono">
                    {exp.createdAt ? new Date(exp.createdAt).toLocaleDateString('vi-VN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ResearcherOverview;
