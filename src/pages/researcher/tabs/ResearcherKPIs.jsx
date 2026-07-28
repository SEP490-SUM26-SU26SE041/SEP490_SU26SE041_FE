import React, { useEffect, useMemo, useState } from 'react';
import { experimentsApi, tasksApi } from '../../../api/experimentApi';
import { kpisApi } from '../../../api/dashboardApi';
import { useToast } from '../../../context/ToastContext';
import { LineChart, BarChart, Gauge } from '../../../components/dashboard/Charts';

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
  Cancelled: 'bg-rose-100 text-rose-700'
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const dayKey = (d) => {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const withinDays = (date, days) => {
  if (!days) return true;
  const now = new Date();
  const target = new Date(date);
  const diff = (now - target) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
};

// Build a series of length N where each index = count of events on that day
const buildDailySeries = (dates, days) => {
  const now = new Date();
  const series = [];
  const length = days || 30;
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
  const completed = tasks.filter(t => t.status === 'Completed').length;
  return Math.round((completed / tasks.length) * 100);
};

const computeOnTimeRate = (tasks) => {
  if (!Array.isArray(tasks) || tasks.length === 0) return 0;
  const completedWithDue = tasks.filter(t => t.status === 'Completed' && t.dueDate && t.completedAt);
  if (completedWithDue.length === 0) return 0;
  const onTime = completedWithDue.filter(t => new Date(t.completedAt) <= new Date(t.dueDate)).length;
  return Math.round((onTime / completedWithDue.length) * 100);
};

// ── Component ────────────────────────────────────────────────────────────────

const ResearcherKPIs = () => {
  const { showToast } = useToast();
  const [kpis, setKpis] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [personnelPerformance, setPersonnelPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [kpiRes, expRes, taskRes, personnelRes] = await Promise.allSettled([
          kpisApi.getKpis({ 
            fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            toDate: new Date().toISOString()
          }),
          experimentsApi.getAll(),
          tasksApi.getMy(),
          kpisApi.getPersonnelPerformance({})
        ]);
        setKpis(kpiRes.status === 'fulfilled' ? kpiRes.value : null);
        setExperiments(expRes.status === 'fulfilled' ? (Array.isArray(expRes.value) ? expRes.value : []) : []);
        setTasks(taskRes.status === 'fulfilled' ? (Array.isArray(taskRes.value) ? taskRes.value : []) : []);
        setPersonnelPerformance(personnelRes.status === 'fulfilled' ? (Array.isArray(personnelRes.value) ? personnelRes.value : []) : []);
      } catch (err) {
        showToast(err.message || 'Không thể tải dữ liệu KPI', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [showToast]);

  const days = PERIOD_RANGES.find(p => p.id === period)?.days || 0;

  // Use real KPI data from API
  const totalExp = kpis?.totalExperiments || experiments.length;
  const activeExp = kpis?.activeExperiments || experiments.filter(e => e.status === 'Active').length;
  const completedExp = kpis?.completedExperiments || experiments.filter(e => e.status === 'Completed').length;
  const totalProductivity = kpis?.taskCompletionRate || computeProductivity(tasks);
  const overallOnTime = kpis?.onTimeCompletionRate || computeOnTimeRate(tasks);
  const totalOverdue = kpis?.overdueTasks || tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed').length;

  // ── Experiment growth KPI ─────────────────────────────────────────────────
  const expCreatedDates = useMemo(
    () => experiments.map(e => e.createdAt).filter(Boolean),
    [experiments]
  );
  const experimentTrend = useMemo(() => buildDailySeries(expCreatedDates, days), [expCreatedDates, days]);

  // ── Task completion KPI ───────────────────────────────────────────────────
  const taskCompletedDates = useMemo(
    () => tasks.filter(t => t.status === 'Completed' && t.completedAt).map(t => t.completedAt),
    [tasks]
  );
  const taskTrend = useMemo(() => buildDailySeries(taskCompletedDates, days), [taskCompletedDates, days]);

  // ── On-track evaluation (scientific route compliance) ─────────────────────
  const onTrackExp = activeExp + completedExp;
  const onTrackPct = totalExp ? Math.round((onTrackExp / totalExp) * 100) : 0;

  // ── Staff aggregation (fallback when API data unavailable) ─────────────────────
  const staffMap = useMemo(() => {
    const map = new Map();
    tasks.forEach(t => {
      const id = t.assignedToId || t.assignedToUserId || t.assigneeId || t.createdById;
      const name = t.assignedToName || t.assigneeName || t.createdByName || 'Chưa gán';
      if (!id && name === 'Chưa gán') return;
      const key = id || `unassigned-${name}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name,
          total: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          overdue: 0,
          completedDates: [],
          dueDates: []
        });
      }
      const entry = map.get(key);
      entry.total += 1;
      if (t.status === 'Completed') {
        entry.completed += 1;
        if (t.completedAt) entry.completedDates.push(t.completedAt);
      } else if (t.status === 'InProgress') entry.inProgress += 1;
      else if (t.status === 'Pending') entry.pending += 1;
      if (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed') entry.overdue += 1;
      if (t.dueDate) entry.dueDates.push(t.dueDate);
    });
    return map;
  }, [tasks]);

  // Use real personnel performance from API
  const staffList = useMemo(() => {
    if (personnelPerformance.length > 0) {
      return personnelPerformance.map(p => ({
        id: p.userId,
        name: p.fullName,
        total: p.totalTasksAssigned,
        completed: p.tasksCompleted,
        inProgress: p.tasksInProgress,
        pending: p.tasksPending,
        overdue: p.tasksOverdue,
        productivity: p.completionRate,
        onTimeRate: p.onTimeCompletionRate
      }));
    }
    // Fallback to computed data from tasks
    return Array.from(staffMap.values()).map(s => ({
      ...s,
      productivity: computeProductivity(tasks.filter(t =>
        (t.assignedToId || t.assignedToUserId || t.assigneeId || t.createdById) === s.id
        || (t.assignedToName || t.assigneeName || t.createdByName) === s.name
      )),
      onTimeRate: computeOnTimeRate(tasks.filter(t =>
        (t.assignedToId || t.assignedToUserId || t.assigneeId || t.createdById) === s.id
        || (t.assignedToName || t.assigneeName || t.createdByName) === s.name
      ))
    })).sort((a, b) => b.productivity - a.productivity);
  }, [personnelPerformance, staffMap, tasks]);

  // Top staff workload (bar chart)
  const workloadData = staffList.slice(0, 6).map(s => ({
    label: s.name.length > 14 ? s.name.slice(0, 14) + '…' : s.name,
    value: s.total,
    color: s.overdue > 0 ? '#ef4444' : '#486730'
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="font-hanken text-xl font-bold text-on-surface">T25 · Theo Dõi KPI & Hiệu Suất</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Đánh giá tiến độ thực nghiệm theo lộ trình khoa học & kiểm soát công việc của nhân viên.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PERIOD_RANGES.map(p => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                period === p.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
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
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Năng Suất Nhân Sự</span>
          <div className="flex items-end gap-2 mt-2">
            <span className="font-hanken text-3xl font-bold text-emerald-600">{loading ? '…' : totalProductivity}%</span>
            <span className="text-[10px] text-on-surface-variant mb-1">hoàn thành/tổng</span>
          </div>
          <div className="mt-3 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalProductivity}%` }} />
          </div>
        </div>
        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Đúng Hạn</span>
          <div className="flex items-end gap-2 mt-2">
            <span className="font-hanken text-3xl font-bold text-blue-600">{loading ? '…' : overallOnTime}%</span>
            <span className="text-[10px] text-on-surface-variant mb-1">công việc</span>
          </div>
          <div className="mt-3 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${overallOnTime}%` }} />
          </div>
        </div>
        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Quá Hạn</span>
          <div className="font-hanken text-3xl font-bold text-rose-600 mt-2">{loading ? '…' : totalOverdue}</div>
          <p className="text-[10px] text-on-surface-variant mt-1">tác vụ cần xử lý gấp</p>
        </div>
      </div>

      {/* Scientific route compliance + Growth charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
          <h3 className="font-hanken text-base font-bold text-on-surface mb-1">Tuân Thủ Lộ Trình Khoa Học</h3>
          <p className="text-xs text-on-surface-variant mb-4">Tỷ lệ thí nghiệm đang đi đúng hướng nghiên cứu</p>
          <div className="flex items-center justify-center py-2">
            <Gauge value={onTrackPct} max={100} label="On-Track" color="#486730" size={140} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 pt-4 border-t border-outline-variant">
            {[
              { label: 'Hoàn thành', value: experiments.filter(e => e.status === 'Completed').length, color: 'text-emerald-700' },
              { label: 'Đang chạy', value: experiments.filter(e => e.status === 'Active').length, color: 'text-emerald-600' },
              { label: 'Lệch hướng', value: experiments.filter(e => e.status === 'Cancelled' || e.status === 'Draft').length, color: 'text-slate-500' }
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-[9px] uppercase tracking-wider font-bold text-on-surface-variant">{s.label}</p>
                <p className={`font-hanken text-xl font-bold ${s.color}`}>{loading ? '…' : s.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-hanken text-base font-bold text-on-surface">Tăng Trưởng Thí Nghiệm</h3>
              <p className="text-xs text-on-surface-variant">Số thí nghiệm được tạo theo ngày trong kỳ</p>
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
            <p className="text-xs text-on-surface-variant">Số tác vụ hoàn thành mỗi ngày — đo lường hiệu suất nhân sự</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase">
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
              TB {taskTrend.length ? (taskTrend.reduce((s, p) => s + p.value, 0) / taskTrend.length).toFixed(1) : 0}/ngày
            </span>
          </div>
        </div>
        <LineChart data={taskTrend} color="#10b981" fillColor="rgba(16,185,129,0.12)" height={200} unit="" />
      </div>

      {/* Personnel performance table + workload chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h3 className="font-hanken text-base font-bold text-on-surface">Hiệu Suất Nhân Sự</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Xếp hạng dựa trên năng suất & tỷ lệ đúng hạn</p>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-on-surface-variant">Đang tải…</div>
          ) : staffList.length === 0 ? (
            <div className="p-10 text-center text-xs text-on-surface-variant">
              <div className="text-3xl mb-2">👥</div>
              <p>Chưa có dữ liệu nhân sự.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-surface-container-low/50 border-b border-outline-variant">
                  <tr>
                    {['#', 'Nhân viên', 'Tổng', 'Hoàn thành', 'Năng suất', 'Đúng hạn', 'Quá hạn'].map(h => (
                      <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {staffList.map((s, idx) => {
                    const initials = (s.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                    const rankColor = idx === 0 ? 'bg-amber-100 text-amber-700'
                      : idx === 1 ? 'bg-slate-200 text-slate-700'
                      : idx === 2 ? 'bg-orange-100 text-orange-700'
                      : 'bg-surface-container-low text-on-surface-variant';
                    return (
                      <tr key={s.id} className="hover:bg-surface-container/20">
                        <td className="px-4 py-3">
                          <span className={`inline-flex w-7 h-7 rounded-full items-center justify-center text-[10px] font-bold ${rankColor}`}>{idx + 1}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">{initials}</div>
                            <span className="text-sm font-semibold text-on-surface truncate max-w-[160px]">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-on-surface">{s.total}</td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-700">{s.completed}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${s.productivity}%` }} />
                            </div>
                            <span className="text-xs font-bold text-emerald-700">{s.productivity}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold ${s.onTimeRate >= 80 ? 'text-emerald-700' : s.onTimeRate >= 50 ? 'text-amber-700' : 'text-rose-700'}`}>
                            {s.onTimeRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {s.overdue > 0 ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold">{s.overdue}</span>
                          ) : (
                            <span className="text-[10px] text-on-surface-variant">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
          <h3 className="font-hanken text-base font-bold text-on-surface mb-1">Khối Lượng Công Việc</h3>
          <p className="text-xs text-on-surface-variant mb-4">Top nhân viên theo tổng tác vụ</p>
          {workloadData.length === 0 ? (
            <div className="py-10 text-center text-xs text-on-surface-variant">Chưa có dữ liệu</div>
          ) : (
            <BarChart data={workloadData} color="#486730" height={260} unit="" />
          )}
        </div>
      </div>

      {/* Experiment status overview */}
      <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-hanken text-base font-bold text-on-surface">Trạng Thái Thí Nghiệm</h3>
            <p className="text-xs text-on-surface-variant">Phân bổ theo từng giai đoạn trong pipeline khoa học</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {['Draft', 'Approved', 'Active', 'Completed', 'Cancelled'].map(st => {
            const count = experiments.filter(e => e.status === st).length;
            const pct = totalExp ? Math.round((count / totalExp) * 100) : 0;
            return (
              <div key={st} className="border border-outline-variant rounded-xl p-4">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COLORS[st]}`}>{st}</span>
                <div className="font-hanken text-2xl font-bold text-on-surface mt-2">{loading ? '…' : count}</div>
                <div className="mt-2 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1 font-bold uppercase">{pct}%</p>
              </div>
            );
          })}
        </div>
        
        {/* Batch and measurement summary from KPIs */}
        {kpis && (
          <div className="mt-4 pt-4 border-t border-outline-variant">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-[10px] text-on-surface-variant font-bold uppercase">Tổng Lô</p>
                <p className="font-hanken text-xl font-bold text-primary">{kpis.totalBatches || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-on-surface-variant font-bold uppercase">Lô Đang Trồng</p>
                <p className="font-hanken text-xl font-bold text-emerald-600">{kpis.activeBatches || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-on-surface-variant font-bold uppercase">Lô Đã Thu Hoạch</p>
                <p className="font-hanken text-xl font-bold text-blue-600">{kpis.harvestedBatches || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-on-surface-variant font-bold uppercase">Bản Ghi Đo</p>
                <p className="font-hanken text-xl font-bold text-amber-600">{kpis.totalMeasurementRecords || 0}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearcherKPIs;