import React, { useEffect, useMemo, useState } from 'react';
import { experimentsApi, tasksApi } from '../../../api/experimentApi';
import { farmsApi } from '../../../api/managerResourcesApi';
import { useToast } from '../../../context/ToastContext';
import { LineChart, Gauge } from '../../../components/dashboard/Charts';

const PERIOD_RANGES = [
  { id: '7d', label: '7 ngày', days: 7 },
  { id: '30d', label: '30 ngày', days: 30 },
  { id: '90d', label: '90 ngày', days: 90 },
  { id: 'all', label: 'Tất cả', days: 0 }
];

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-600',
  Active: 'bg-emerald-100 text-emerald-700',
  Approved: 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-200 text-emerald-800',
  Pending: 'bg-amber-100 text-amber-700',
  Rejected: 'bg-rose-100 text-rose-700',
  Cancelled: 'bg-rose-100 text-rose-700'
};

const dayKey = (d) => {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const withinDays = (date, days) => {
  if (!days) return true;
  const now = new Date();
  const diff = (now - new Date(date)) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
};

const buildDailySeries = (dates, days) => {
  const now = new Date();
  const length = days || 30;
  const series = [];
  for (let i = length - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = dayKey(d);
    const count = dates.filter(dt => dayKey(dt) === key).length;
    series.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, value: count });
  }
  return series;
};

const computeProductivity = (tasks) => {
  if (!Array.isArray(tasks) || tasks.length === 0) return 0;
  return Math.round((tasks.filter(t => t.status === 'Completed').length / tasks.length) * 100);
};

const computeOnTimeRate = (tasks) => {
  const withDue = tasks.filter(t => t.status === 'Completed' && t.dueDate && t.completedAt);
  if (!withDue.length) return 0;
  const onTime = withDue.filter(t => new Date(t.completedAt) <= new Date(t.dueDate)).length;
  return Math.round((onTime / withDue.length) * 100);
};

// ── Component ────────────────────────────────────────────────────────────────

const ManagerKPIs = () => {
  const { showToast } = useToast();
  const [experiments, setExperiments] = useState([]);
  const [farms, setFarms] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [expRes, farmRes, taskRes] = await Promise.allSettled([
          experimentsApi.getAll(),
          farmsApi.getMyFarms(),
          tasksApi.getMy()
        ]);
        setExperiments(expRes.status === 'fulfilled' ? (Array.isArray(expRes.value) ? expRes.value : []) : []);
        setFarms(farmRes.status === 'fulfilled' ? (Array.isArray(farmRes.value) ? farmRes.value : []) : []);
        setTasks(taskRes.status === 'fulfilled' ? (Array.isArray(taskRes.value) ? taskRes.value : []) : []);
      } catch (err) {
        showToast(err.message || 'Không thể tải dữ liệu KPI', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [showToast]);

  const days = PERIOD_RANGES.find(p => p.id === period)?.days || 0;

  // Experiment trends
  const expCreatedDates = useMemo(
    () => experiments.map(e => e.createdAt).filter(Boolean),
    [experiments]
  );
  const experimentTrend = useMemo(() => buildDailySeries(expCreatedDates, days), [expCreatedDates, days]);

  // Task completion trends
  const taskCompletedDates = useMemo(
    () => tasks.filter(t => t.status === 'Completed' && t.completedAt).map(t => t.completedAt),
    [tasks]
  );
  const taskTrend = useMemo(() => buildDailySeries(taskCompletedDates, days), [taskCompletedDates, days]);

  // KPIs
  const totalExp = experiments.length;
  const activeExp = experiments.filter(e => e.status === 'Active').length;
  const completedExp = experiments.filter(e => e.status === 'Completed').length;
  const pendingExp = experiments.filter(e => e.status === 'Pending' || e.status === 'Draft').length;
  const onTrackPct = totalExp ? Math.round(((activeExp + completedExp) / totalExp) * 100) : 0;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed').length;
  const productivity = computeProductivity(tasks);
  const onTimeRate = computeOnTimeRate(tasks);

  // Experiment status distribution
  const statusCounts = useMemo(() => {
    const map = {};
    experiments.forEach(e => { map[e.status] = (map[e.status] || 0) + 1; });
    return map;
  }, [experiments]);

  // Bar chart data: experiment status
  const statusBarData = Object.entries(STATUS_COLORS).map(([status]) => ({
    label: status,
    value: statusCounts[status] || 0
  })).filter(d => d.value > 0);

  return (
    <div className="px-6 lg:px-12 py-6 lg:py-8 space-y-6 animate-fade-in w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="font-hanken text-xl font-bold text-on-surface">T25 · KPIs & Hiệu Suất Quản Lý</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Theo dõi hiệu suất vận hành nông trại, tiến độ thí nghiệm và năng suất nhân sự.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PERIOD_RANGES.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                period === p.id
                  ? 'bg-primary text-white shadow-lg'
                  : 'bg-white border border-outline-variant text-on-surface-variant hover:bg-surface-container/40'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tổng Thí Nghiệm</span>
          <div className="font-hanken text-3xl font-bold text-primary mt-2">{loading ? '…' : totalExp}</div>
          <p className="text-[10px] text-on-surface-variant mt-1">
            {activeExp} đang chạy · {completedExp} hoàn thành
          </p>
        </div>
        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Năng Suất Tác Vụ</span>
          <div className="flex items-end gap-2 mt-2">
            <span className="font-hanken text-3xl font-bold text-emerald-600">{loading ? '…' : productivity}%</span>
            <span className="text-[10px] text-on-surface-variant mb-1">hoàn thành</span>
          </div>
          <div className="mt-3 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${productivity}%` }} />
          </div>
        </div>
        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Đúng Hạn</span>
          <div className="flex items-end gap-2 mt-2">
            <span className="font-hanken text-3xl font-bold text-blue-600">{loading ? '…' : onTimeRate}%</span>
            <span className="text-[10px] text-on-surface-variant mb-1">công việc</span>
          </div>
          <div className="mt-3 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${onTimeRate}%` }} />
          </div>
        </div>
        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Quá Hạn</span>
          <div className="font-hanken text-3xl font-bold text-rose-600 mt-2">{loading ? '…' : overdueTasks}</div>
          <p className="text-[10px] text-on-surface-variant mt-1">tác vụ cần xử lý gấp</p>
        </div>
      </div>

      {/* Experiment throughput + Scientific route compliance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
          <h3 className="font-hanken text-base font-bold text-on-surface mb-1">Tuân Thủ Lộ Trình Khoa Học</h3>
          <p className="text-xs text-on-surface-variant mb-4">Tỷ lệ thí nghiệm đang đi đúng hướng</p>
          <div className="flex items-center justify-center py-2">
            <Gauge value={onTrackPct} max={100} label="On-Track" color="#486730" size={140} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 pt-4 border-t border-outline-variant">
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-wider font-bold text-on-surface-variant">Hoàn thành</p>
              <p className="font-hanken text-xl font-bold text-emerald-700">{loading ? '…' : completedExp}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-wider font-bold text-on-surface-variant">Đang chạy</p>
              <p className="font-hanken text-xl font-bold text-emerald-600">{loading ? '…' : activeExp}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] uppercase tracking-wider font-bold text-on-surface-variant">Chờ xử lý</p>
              <p className="font-hanken text-xl font-bold text-slate-500">{loading ? '…' : pendingExp}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-hanken text-base font-bold text-on-surface">Tăng Trưởng Thí Nghiệm</h3>
              <p className="text-xs text-on-surface-variant">Số thí nghiệm được tạo theo ngày</p>
            </div>
            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold uppercase">
              {experimentTrend.reduce((s, p) => s + p.value, 0)} mới
            </span>
          </div>
          <LineChart data={experimentTrend} color="#4f46e5" fillColor="rgba(79,70,229,0.12)" height={200} unit="" />
        </div>
      </div>

      {/* Task completion trend */}
      <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-hanken text-base font-bold text-on-surface">Tiến Độ Hoàn Thành Công Việc</h3>
            <p className="text-xs text-on-surface-variant">Số tác vụ hoàn thành mỗi ngày</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
              TB {taskTrend.length ? (taskTrend.reduce((s, p) => s + p.value, 0) / taskTrend.length).toFixed(1) : 0}/ngày
            </span>
          </div>
        </div>
        <LineChart data={taskTrend} color="#10b981" fillColor="rgba(16,185,129,0.12)" height={200} unit="" />
      </div>

      {/* Experiment status distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
          <h3 className="font-hanken text-base font-bold text-on-surface mb-4">Trạng Thái Thí Nghiệm</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {['Draft', 'Approved', 'Active', 'Completed', 'Pending', 'Cancelled'].map(st => {
              const count = experiments.filter(e => e.status === st).length;
              const pct = totalExp ? Math.round((count / totalExp) * 100) : 0;
              return (
                <div key={st} className="border border-outline-variant rounded-xl p-4">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COLORS[st] || 'bg-slate-100 text-slate-600'}`}>{st}</span>
                  <div className="font-hanken text-2xl font-bold text-on-surface mt-2">{loading ? '…' : count}</div>
                  <div className="mt-2 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-1 font-bold uppercase">{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
          <h3 className="font-hanken text-base font-bold text-on-surface mb-4">Tổng Quan Nông Trại</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-surface-container-low rounded-xl animate-pulse" />)}
            </div>
          ) : farms.length === 0 ? (
            <div className="text-center py-8 text-xs text-on-surface-variant">
              <div className="text-3xl mb-2">🏡</div>
              <p>Chưa có nông trại nào được gán.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {farms.slice(0, 6).map(farm => (
                <div key={farm.id} className="flex items-center justify-between p-3 border border-outline-variant rounded-xl hover:bg-surface-container/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center text-sm font-bold">
                      {farm.name?.[0] || 'F'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{farm.name || farm.farmName || 'Nông trại'}</p>
                      <p className="text-[10px] text-on-surface-variant">{farm.address || farm.location || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="text-[10px] font-bold text-emerald-700">Hoạt động</span>
                  </div>
                </div>
              ))}
              {farms.length > 6 && (
                <p className="text-[10px] text-on-surface-variant text-center">+ {farms.length - 6} nông trại khác</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerKPIs;
