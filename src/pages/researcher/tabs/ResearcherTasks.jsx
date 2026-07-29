import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { tasksApi, taskReportsApi, experimentsApi } from '../../../api/experimentApi';
import { useToast } from '../../../context/ToastContext';

// ── Portal helper ─────────────────────────────────────────────────────────────

const Portal = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  Pending:    { label: 'Chờ',        dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  InProgress: { label: 'Đang Làm',   dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  Completed:  { label: 'Hoàn Thành', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  Cancelled:  { label: 'Đã Hủy',     dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200' },
};

const TASK_TYPE_META = {
  Planting:    { label: 'Trồng',         icon: '🌱', color: 'bg-emerald-50 text-emerald-600' },
  Watering:    { label: 'Tưới nước',     icon: '💧', color: 'bg-blue-50 text-blue-600' },
  Fertilizing: { label: 'Bón phân',      icon: '🧪', color: 'bg-amber-50 text-amber-600' },
  Observation: { label: 'Quan sát',      icon: '👁️', color: 'bg-purple-50 text-purple-600' },
  Inspection:  { label: 'Kiểm tra',     icon: '🔍', color: 'bg-indigo-50 text-indigo-600' },
  Harvest:     { label: 'Thu hoạch',    icon: '🌾', color: 'bg-orange-50 text-orange-600' },
  Other:       { label: 'Khác',          icon: '📋', color: 'bg-slate-50 text-slate-600' },
};

const STATUS_ORDER = ['Pending', 'InProgress', 'Completed', 'Cancelled'];

const VIEW_MODES = [
  { id: 'kanban', label: 'Bảng Kanban', icon: '🗂️' },
  { id: 'calendar', label: 'Lịch Tuần',  icon: '📅' },
  { id: 'list', label: 'Danh Sách',    icon: '📋' },
];

// ── Date helpers ──────────────────────────────────────────────────────────────

const toDayKey = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().split('T')[0];
};

const startOfWeek = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
};

const formatViDate = (d) => new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

const relativeDay = (d) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d); target.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return { text: 'Hôm nay', cls: 'text-amber-700 bg-amber-50 border-amber-200' };
  if (diff === 1) return { text: 'Ngày mai', cls: 'text-blue-700 bg-blue-50 border-blue-200' };
  if (diff === -1) return { text: 'Hôm qua', cls: 'text-slate-600 bg-slate-50 border-slate-200' };
  if (diff > 0) return { text: `Còn ${diff} ngày`, cls: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
  return { text: `Trễ ${-diff} ngày`, cls: 'text-rose-700 bg-rose-50 border-rose-200' };
};

// ── Component ─────────────────────────────────────────────────────────────────

const ResearcherTasks = () => {
  const { showToast } = useToast();
  const [view, setView] = useState('kanban');
  const [activeTab, setActiveTab] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [experimentId, setExperimentId] = useState('');
  const [experiments, setExperiments] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [reportsModal, setReportsModal] = useState({ open: false, task: null, reports: [], loading: false });
  const [weekAnchor, setWeekAnchor] = useState(new Date());

  useEffect(() => {
    const loadExperiments = async () => {
      try {
        const data = await experimentsApi.getAll();
        setExperiments(Array.isArray(data) ? data : (data?.items || []));
      } catch { setExperiments([]); }
    };
    loadExperiments();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = { scope: activeTab, upcomingDays: 30 };
      if (experimentId) params.experimentId = experimentId;
      const data = await tasksApi.getByResearcherCreated(params);
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Không thể tải tác vụ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [activeTab, experimentId]);

  const filtered = useMemo(() => {
    if (!search) return tasks;
    const q = search.toLowerCase();
    return tasks.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.experimentTitle || '').toLowerCase().includes(q) ||
      (t.assignedToName || '').toLowerCase().includes(q)
    );
  }, [tasks, search]);

  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'Pending').length,
    inProgress: tasks.filter(t => t.status === 'InProgress').length,
    completed: tasks.filter(t => t.status === 'Completed').length,
    overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed' && t.status !== 'Cancelled').length,
  }), [tasks]);

  const openReports = async (task) => {
    setReportsModal({ open: true, task, reports: [], loading: true });
    try {
      const data = await taskReportsApi.getByTask(task.id);
      setReportsModal(prev => ({ ...prev, reports: Array.isArray(data) ? data : [], loading: false }));
    } catch (err) {
      showToast(err.message || 'Không thể tải báo cáo', 'error');
      setReportsModal(prev => ({ ...prev, reports: [], loading: false }));
    }
  };
  const closeReports = () => setReportsModal({ open: false, task: null, reports: [], loading: false });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ── Header / Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-hanken font-bold text-xl text-on-surface">Quản Lý Tác Vụ</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">Theo dõi, phân công và hoàn thành tác vụ thí nghiệm</p>
        </div>
        <div className="flex bg-white border border-outline-variant rounded-xl p-1 shadow-sm">
          {VIEW_MODES.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                view === v.id ? 'bg-indigo-600 text-white shadow' : 'text-on-surface-variant hover:bg-surface-container/30'
              }`}>
              <span>{v.icon}</span>{v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats KPI ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Tổng Tác Vụ',  value: stats.total,       bg: 'bg-white',           text: 'text-on-surface',   icon: '📋' },
          { label: 'Chờ Xử Lý',    value: stats.pending,     bg: 'bg-blue-50',         text: 'text-blue-700',     icon: '⏳' },
          { label: 'Đang Làm',     value: stats.inProgress,  bg: 'bg-amber-50',        text: 'text-amber-700',    icon: '⚙️' },
          { label: 'Hoàn Thành',   value: stats.completed,   bg: 'bg-emerald-50',      text: 'text-emerald-700',  icon: '✅' },
          { label: 'Quá Hạn',      value: stats.overdue,     bg: 'bg-rose-50',         text: 'text-rose-700',     icon: '🚨' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-outline-variant rounded-2xl px-4 py-3 flex items-center gap-3`}>
            <div className="text-2xl">{s.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{s.label}</div>
              <div className={`font-hanken text-xl font-bold ${s.text}`}>{loading ? '…' : s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-outline-variant rounded-2xl p-3 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-surface-container-low rounded-xl p-1">
            {[
              { id: 'all', label: 'Tất Cả' },
              { id: 'today', label: 'Hôm Nay' },
              { id: 'upcoming', label: 'Sắp Tới' },
              { id: 'overdue', label: 'Quá Hạn' },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab.id ? 'bg-white text-indigo-700 shadow' : 'text-on-surface-variant hover:text-on-surface'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="h-6 w-px bg-outline-variant" />
          <select value={experimentId} onChange={e => setExperimentId(e.target.value)}
            className="px-3 py-2 border border-outline-variant rounded-xl bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-[220px]">
            <option value="">🧪 Tất cả thực nghiệm</option>
            {experiments.map(exp => (
              <option key={exp.id} value={exp.id}>{exp.title || exp.name || `Exp ${String(exp.id).slice(0, 8)}`}</option>
            ))}
          </select>
          <div className="ml-auto relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" placeholder="Tìm kiếm tác vụ..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-outline-variant rounded-xl bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-64" />
          </div>
        </div>
      </div>

      {/* ── View ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white border border-outline-variant rounded-2xl p-16 text-center">
          <div className="inline-block w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-on-surface-variant mt-3">Đang tải tác vụ...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-outline-variant rounded-2xl p-16 text-center">
          <div className="text-5xl mb-3">📭</div>
          <p className="font-semibold text-on-surface">Chưa có tác vụ nào</p>
          <p className="text-xs text-on-surface-variant mt-1">Hãy tạo tác vụ mới từ tab Thực Nghiệm để bắt đầu</p>
        </div>
      ) : view === 'kanban' ? (
        <KanbanView tasks={filtered} onSelect={setSelectedTask} onOpenReports={openReports} onChange={fetchTasks} />
      ) : view === 'calendar' ? (
        <CalendarView tasks={filtered} weekAnchor={weekAnchor} setWeekAnchor={setWeekAnchor} onSelect={setSelectedTask} />
      ) : (
        <ListView tasks={filtered} onSelect={setSelectedTask} onOpenReports={openReports} onChange={fetchTasks} />
      )}

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      {selectedTask && (
        <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} onOpenReports={openReports} onChange={() => { fetchTasks(); setSelectedTask(null); }} />
      )}

      {/* ── Reports Modal ─────────────────────────────────────────────────── */}
      {reportsModal.open && (
        <TaskReportsModal task={reportsModal.task} reports={reportsModal.reports} loading={reportsModal.loading} onClose={closeReports} />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// VIEW: Kanban
// ────────────────────────────────────────────────────────────────────────────

const KanbanView = ({ tasks, onSelect, onOpenReports, onChange }) => {
  const columns = useMemo(() => STATUS_ORDER.map(s => ({
    status: s,
    meta: STATUS_META[s],
    items: tasks.filter(t => t.status === s),
  })), [tasks]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {columns.map(col => (
        <div key={col.status} className={`bg-surface-container-low/40 border ${col.meta.border} rounded-2xl overflow-hidden flex flex-col min-h-[400px]`}>
          {/* Column header */}
          <div className={`px-4 py-3 ${col.meta.bg} border-b ${col.meta.border} flex items-center justify-between sticky top-0`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${col.meta.dot}`} />
              <span className={`text-sm font-bold ${col.meta.text}`}>{col.meta.label}</span>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${col.meta.bg} ${col.meta.text} border ${col.meta.border}`}>{col.items.length}</span>
          </div>
          {/* Cards */}
          <div className="p-3 space-y-2 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
            {col.items.length === 0 ? (
              <div className="text-center text-xs text-on-surface-variant italic py-8">Trống</div>
            ) : (
              col.items.map(t => <KanbanCard key={t.id} task={t} onSelect={onSelect} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const KanbanCard = ({ task, onSelect }) => {
  const tm = TASK_TYPE_META[task.taskType] || TASK_TYPE_META.Other;
  const sm = STATUS_META[task.status] || STATUS_META.Pending;
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed' && task.status !== 'Cancelled';
  const rel = task.dueDate ? relativeDay(task.dueDate) : null;

  return (
    <button type="button" onClick={() => onSelect(task)}
      className={`w-full text-left p-3 bg-white rounded-xl border ${overdue ? 'border-rose-300 border-l-4 border-l-rose-500' : 'border-outline-variant'} hover:shadow-md hover:border-indigo-300 transition-all group`}>
      <div className="flex items-start gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg ${tm.color} flex items-center justify-center text-base shrink-0`}>{tm.icon}</div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold line-clamp-2 ${task.status === 'Completed' ? 'line-through text-slate-400' : 'text-on-surface'}`}>{task.title || '—'}</p>
          {task.experimentTitle && (
            <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">🧪 {task.experimentTitle}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {rel && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${rel.cls}`}>{rel.text}</span>
        )}
        {task.assignedToName && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">👤 {task.assignedToName}</span>
        )}
      </div>
    </button>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// VIEW: Calendar (Week)
// ────────────────────────────────────────────────────────────────────────────

const CalendarView = ({ tasks, weekAnchor, setWeekAnchor, onSelect }) => {
  const start = startOfWeek(weekAnchor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  const tasksByDay = useMemo(() => {
    const map = {};
    days.forEach(d => { map[toDayKey(d)] = []; });
    tasks.forEach(t => {
      if (!t.dueDate) return;
      const key = toDayKey(t.dueDate);
      if (map[key]) map[key].push(t);
    });
    return map;
  }, [tasks, weekAnchor]);

  const moveWeek = (delta) => {
    const d = new Date(weekAnchor);
    d.setDate(d.getDate() + delta * 7);
    setWeekAnchor(d);
  };

  return (
    <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
      {/* Week nav */}
      <div className="px-5 py-3 border-b border-outline-variant flex items-center justify-between bg-surface-container-low/30">
        <button onClick={() => moveWeek(-1)} className="p-2 rounded-lg hover:bg-surface-container transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div className="text-sm font-bold text-on-surface">
          {formatViDate(days[0])} — {formatViDate(days[6])}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekAnchor(new Date())}
            className="px-3 py-1.5 text-xs font-bold border border-outline-variant rounded-lg hover:bg-surface-container">Hôm nay</button>
          <button onClick={() => moveWeek(1)} className="p-2 rounded-lg hover:bg-surface-container transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7 divide-x divide-outline-variant">
        {days.map(d => {
          const key = toDayKey(d);
          const dayTasks = tasksByDay[key] || [];
          const isToday = toDayKey(d) === toDayKey(new Date());
          return (
            <div key={key} className="min-h-[260px] flex flex-col">
              <div className={`px-2 py-2 text-center border-b border-outline-variant ${isToday ? 'bg-indigo-50' : ''}`}>
                <div className="text-[10px] font-bold uppercase text-on-surface-variant">
                  {d.toLocaleDateString('vi-VN', { weekday: 'short' })}
                </div>
                <div className={`text-base font-bold mt-0.5 ${isToday ? 'text-indigo-700' : 'text-on-surface'}`}>
                  {d.getDate()}
                </div>
              </div>
              <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
                {dayTasks.length === 0 ? (
                  <div className="text-[10px] text-center text-on-surface-variant italic py-3">—</div>
                ) : (
                  dayTasks.map(t => {
                    const tm = TASK_TYPE_META[t.taskType] || TASK_TYPE_META.Other;
                    const sm = STATUS_META[t.status] || STATUS_META.Pending;
                    return (
                      <button key={t.id} type="button" onClick={() => onSelect(t)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg border ${sm.border} bg-white hover:shadow-sm transition-all`}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm shrink-0">{tm.icon}</span>
                          <span className={`text-[10px] font-bold ${sm.dot.replace('bg-', 'text-').replace('-500', '-700')}`}>·</span>
                        </div>
                        <p className="text-[11px] font-semibold text-on-surface line-clamp-2 mt-0.5">{t.title || '—'}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// VIEW: List (table)
// ────────────────────────────────────────────────────────────────────────────

const ListView = ({ tasks, onSelect, onOpenReports, onChange }) => (
  <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-surface-container-low/40 border-b border-outline-variant">
          <tr className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            <th className="px-4 py-3 text-left">Tác Vụ</th>
            <th className="px-4 py-3 text-left">Thực Nghiệm</th>
            <th className="px-4 py-3 text-left">Người Gán</th>
            <th className="px-4 py-3 text-left">Hạn</th>
            <th className="px-4 py-3 text-left">Trạng Thái</th>
            <th className="px-4 py-3 text-right">Thao Tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {tasks.map(t => {
            const tm = TASK_TYPE_META[t.taskType] || TASK_TYPE_META.Other;
            const sm = STATUS_META[t.status] || STATUS_META.Pending;
            const rel = t.dueDate ? relativeDay(t.dueDate) : null;
            return (
              <tr key={t.id} className="hover:bg-surface-container-low/30 transition-colors">
                <td className="px-4 py-3">
                  <button type="button" onClick={() => onSelect(t)} className="flex items-center gap-2 text-left">
                    <div className={`w-8 h-8 rounded-lg ${tm.color} flex items-center justify-center text-sm shrink-0`}>{tm.icon}</div>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${t.status === 'Completed' ? 'line-through text-slate-400' : 'text-on-surface'} truncate max-w-[280px]`}>{t.title || '—'}</p>
                      <p className="text-[10px] text-on-surface-variant">{tm.label}</p>
                    </div>
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-on-surface truncate max-w-[180px]">{t.experimentTitle || '—'}</td>
                <td className="px-4 py-3 text-xs">
                  {t.assignedToName ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white text-[10px] font-bold flex items-center justify-center">{(t.assignedToName || '?')[0]?.toUpperCase()}</span>
                      <span className="font-semibold text-on-surface">{t.assignedToName}</span>
                    </span>
                  ) : <span className="text-on-surface-variant italic">Chưa gán</span>}
                </td>
                <td className="px-4 py-3 text-xs">
                  {t.dueDate ? (
                    <div className="space-y-1">
                      <div className="font-mono text-on-surface">{formatViDate(t.dueDate)}</div>
                      {rel && <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${rel.cls}`}>{rel.text}</span>}
                    </div>
                  ) : <span className="text-on-surface-variant">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold ${sm.bg} ${sm.text} border ${sm.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                    {sm.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onSelect(t)}
                    className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                    Chi tiết →
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// TASK DETAIL DRAWER (slide from right)
// ────────────────────────────────────────────────────────────────────────────

const TaskDetailDrawer = ({ task, onClose, onOpenReports, onChange }) => {
  const { showToast } = useToast();
  const tm = TASK_TYPE_META[task.taskType] || TASK_TYPE_META.Other;
  const sm = STATUS_META[task.status] || STATUS_META.Pending;
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed' && task.status !== 'Cancelled';
  const rel = task.dueDate ? relativeDay(task.dueDate) : null;

  const handleCancel = async () => {
    if (!window.confirm('Hủy tác vụ này?')) return;
    try { await tasksApi.cancel(task.id); showToast('Đã hủy tác vụ', 'success'); onChange(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[3000] animate-fade-in" onClick={onClose}>
        <aside className="absolute right-0 top-0 bottom-0 w-full max-w-[520px] bg-white shadow-2xl flex flex-col animate-slide-in-right" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="px-6 py-5 border-b border-outline-variant bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className={`w-12 h-12 rounded-xl ${tm.color} flex items-center justify-center text-2xl shrink-0 shadow-sm`}>{tm.icon}</div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/60 transition-colors shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${sm.bg} ${sm.text} border ${sm.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />{sm.label}
              </span>
              {overdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  🚨 Quá hạn
                </span>
              )}
            </div>
            <h3 className={`font-hanken font-bold text-lg ${task.status === 'Completed' ? 'line-through text-slate-400' : 'text-on-surface'}`}>{task.title || '—'}</h3>
            {task.experimentTitle && (
              <p className="text-xs text-on-surface-variant mt-1 truncate">🧪 {task.experimentTitle}</p>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Quick info cards */}
            <div className="grid grid-cols-2 gap-3">
              <InfoBlock label="Loại" icon={tm.icon} value={tm.label} />
              <InfoBlock label="Hạn Chót"
                icon="📅"
                value={task.dueDate ? formatViDate(task.dueDate) : '—'}
                sub={rel?.text} subCls={rel?.cls} />
            </div>

            {task.description && (
              <Section title="Mô Tả" icon="📝">
                <p className="text-sm text-on-surface whitespace-pre-line">{task.description}</p>
              </Section>
            )}

            <Section title="Chi Tiết Thực Nghiệm" icon="🧪">
              <div className="grid grid-cols-2 gap-2">
                <DetailRow label="Thực Nghiệm" value={task.experimentTitle} />
                <DetailRow label="Giai Đoạn" value={task.experimentStageName} />
                <DetailRow label="Lô" value={task.batchCode} mono />
                <DetailRow label="Lịch Chăm Sóc" value={task.careScheduleTitle} />
              </div>
            </Section>

            <Section title="Phân Công" icon="👥">
              <div className="space-y-2">
                <DetailRow label="Người Tạo" value={task.createdByName} />
                <DetailRow label="Người Gán" value={task.assignedToName || <span className="italic text-rose-500 font-semibold">⚠️ Chưa được gán</span>} />
              </div>
            </Section>

            {task.requiredSkillDescription && (
              <Section title="Kỹ Năng Yêu Cầu" icon="⚙️">
                <p className="text-sm text-on-surface">{task.requiredSkillDescription}</p>
              </Section>
            )}
          </div>

          {/* Footer actions - researcher chỉ quản lý, không thực thi */}
          <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-low/30 flex items-center gap-2 flex-wrap">
            {task.status === 'Completed' && (
              <button onClick={() => { onOpenReports(task); onClose(); }}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all">
                📄 Xem Báo Cáo
              </button>
            )}
            {(task.status === 'Pending' || task.status === 'InProgress') && (
              <>
                <div className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-500 rounded-xl text-xs flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  Việc thực hiện do người được gán (Student/Tech) xử lý
                </div>
                <button onClick={handleCancel}
                  className="px-4 py-2.5 border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl text-sm font-bold transition-all">
                  Hủy Tác Vụ
                </button>
              </>
            )}
            {task.status === 'Cancelled' && (
              <div className="flex-1 text-center text-xs text-slate-400 italic py-2">Tác vụ đã bị hủy</div>
            )}
          </div>
        </aside>
      </div>
    </Portal>
  );
};

const Section = ({ title, icon, children }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
      <span>{icon}</span><span>{title}</span>
    </div>
    <div className="bg-surface-container-low/30 rounded-xl p-3 border border-outline-variant">{children}</div>
  </div>
);

const DetailRow = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-2 text-xs">
    <span className="text-on-surface-variant shrink-0">{label}:</span>
    <span className={`font-semibold text-on-surface text-right truncate ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
  </div>
);

const InfoBlock = ({ label, icon, value, sub, subCls }) => (
  <div className="bg-surface-container-low/40 border border-outline-variant rounded-xl p-3">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
      <span>{icon}</span><span>{label}</span>
    </div>
    <div className="font-semibold text-on-surface text-sm mt-1">{value}</div>
    {sub && <span className={`inline-block mt-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${subCls}`}>{sub}</span>}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// TASK REPORTS MODAL
// ────────────────────────────────────────────────────────────────────────────

const TaskReportsModal = ({ task, reports, loading, onClose }) => (
  <Portal>
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[3500] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-outline-variant">
          <div className="min-w-0">
            <h3 className="font-hanken font-bold text-base text-on-surface">Báo Cáo Tác Vụ</h3>
            <p className="text-xs text-on-surface-variant mt-0.5 truncate">{task?.title || '—'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-container/50 transition-colors shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-center text-sm text-on-surface-variant py-8">Đang tải...</div>
          ) : reports.length === 0 ? (
            <div className="text-center text-sm text-on-surface-variant py-8">Chưa có báo cáo nào.</div>
          ) : (
            <div className="space-y-3">
              {reports.map(r => {
                const resultEntries = r.resultData && typeof r.resultData === 'object' ? Object.entries(r.resultData) : [];
                const imageList = Array.isArray(r.images) ? r.images : [];
                return (
                  <div key={r.id} className="p-4 border border-outline-variant rounded-xl bg-surface-container-low/30">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {(r.reporterName || 'T').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-on-surface truncate">{r.reporterName || 'Reporter'}</div>
                          {r.reportedAt && (
                            <div className="text-[10px] text-on-surface-variant">{new Date(r.reportedAt).toLocaleString('vi-VN')}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    {r.reportText && <p className="text-sm text-on-surface whitespace-pre-line mt-1">{r.reportText}</p>}
                    {resultEntries.length > 0 && (
                      <div className="mt-3 p-3 bg-white rounded-xl border border-outline-variant">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">Kết Quả</div>
                        <div className="grid grid-cols-2 gap-2">
                          {resultEntries.map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <div className="text-[10px] text-on-surface-variant font-mono break-all">{key}</div>
                              <div className="font-semibold text-on-surface break-all">{String(value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {imageList.length > 0 && (
                      <div className="mt-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">Hình Ảnh</div>
                        <div className="flex flex-wrap gap-2">
                          {imageList.map((img, i) => (
                            <a key={i} href={img.url || img} target="_blank" rel="noopener noreferrer"
                              className="block w-16 h-16 rounded-lg overflow-hidden border border-outline-variant hover:opacity-80">
                              <img src={img.url || img} alt={img.name || `img-${i}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  </Portal>
);

export default ResearcherTasks;