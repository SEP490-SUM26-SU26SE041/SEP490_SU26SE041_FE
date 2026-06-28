import React, { useEffect, useState } from 'react';
import { tasksApi } from '../../../api/experimentApi';
import { useToast } from '../../../context/ToastContext';

const TASK_TABS = [
  { id: 'all', label: 'Tất Cả' },
  { id: 'today', label: 'Hôm Nay' },
  { id: 'upcoming', label: 'Sắp Tới' },
  { id: 'overdue', label: 'Quá Hạn' },
];

const STATUS_COLORS = {
  Pending: 'bg-blue-100 text-blue-700',
  InProgress: 'bg-amber-100 text-amber-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Overdue: 'bg-rose-100 text-rose-700',
  Cancelled: 'bg-slate-100 text-slate-600',
};

const TASK_TYPE_ICONS = {
  Planting: '🌱', Watering: '💧', Fertilizing: '🧪',
  Observation: '👁️', Inspection: '🔍', Harvest: '🌾', Other: '📋'
};

const ResearcherTasks = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchTasks = async () => {
    try {
      setLoading(true);
      let data = [];
      switch (activeTab) {
        case 'today': data = await tasksApi.getToday(); break;
        case 'upcoming': data = await tasksApi.getUpcoming(7); break;
        case 'overdue': data = await tasksApi.getOverdue(); break;
        default: data = await tasksApi.getMy(); break;
      }
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Không thể tải tác vụ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [activeTab]);

  const filtered = tasks.filter(t => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.title || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.experimentTitle || '').toLowerCase().includes(q)
    );
  });

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'Pending').length,
    inProgress: tasks.filter(t => t.status === 'InProgress').length,
    completed: tasks.filter(t => t.status === 'Completed').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tổng', value: stats.total, bg: 'bg-surface-container-low', color: 'text-on-surface' },
          { label: 'Chờ', value: stats.pending, bg: 'bg-blue-50', color: 'text-blue-700' },
          { label: 'Đang Làm', value: stats.inProgress, bg: 'bg-amber-50', color: 'text-amber-700' },
          { label: 'Hoàn Thành', value: stats.completed, bg: 'bg-emerald-50', color: 'text-emerald-700' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-outline-variant rounded-2xl p-4 flex flex-col gap-1`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{s.label}</span>
            <span className={`font-hanken text-2xl font-bold ${s.color}`}>{loading ? '…' : s.value}</span>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TASK_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-white border border-outline-variant text-on-surface-variant hover:bg-surface-container/30'
            }`}>
            {tab.label}
          </button>
        ))}
        <div className="ml-auto">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" placeholder="Tìm kiếm tác vụ..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-64" />
          </div>
        </div>
      </div>

      {/* Tasks list */}
      {loading ? (
        <div className="bg-white border border-outline-variant rounded-2xl p-12 text-center text-sm text-on-surface-variant">Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-outline-variant rounded-2xl p-12 text-center text-sm text-on-surface-variant">
          Không có tác vụ nào.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(task => (
            <TaskCard key={task.id} task={task} onRefresh={fetchTasks} />
          ))}
        </div>
      )}
    </div>
  );
};

const TaskCard = ({ task, onRefresh }) => {
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const handleStart = async () => {
    try {
      await tasksApi.start(task.id);
      showToast('Đã bắt đầu thực hiện tác vụ', 'success');
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Không thể bắt đầu tác vụ', 'error');
    }
  };

  const handleComplete = async () => {
    try {
      await tasksApi.complete(task.id);
      showToast('Đã hoàn thành tác vụ!', 'success');
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Không thể hoàn thành tác vụ', 'error');
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Hủy tác vụ này?')) return;
    try {
      await tasksApi.cancel(task.id);
      showToast('Đã hủy tác vụ', 'success');
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Không thể hủy tác vụ', 'error');
    }
  };

  const icon = TASK_TYPE_ICONS[task.taskType] || '📋';
  const statusColor = STATUS_COLORS[task.status] || 'bg-slate-100 text-slate-600';
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed';

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all ${
      isOverdue ? 'border-rose-300 border-l-4 border-l-rose-500' : 'border-outline-variant'
    }`}>
      <div className="p-5 flex items-start gap-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-xl shrink-0">
          {icon}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-hanken font-bold text-sm text-on-surface">{task.title || '—'}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}>
              {task.status === 'InProgress' ? 'Đang Làm' : task.status === 'Pending' ? 'Chờ' : task.status === 'Completed' ? 'Hoàn Thành' : task.status}
            </span>
            {isOverdue && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">Quá hạn</span>}
          </div>
          {task.description && <p className="text-xs text-on-surface-variant line-clamp-2">{task.description}</p>}

          <div className="flex items-center gap-4 mt-2 text-[10px] text-on-surface-variant">
            {task.experimentTitle && (
              <span className="flex items-center gap-1">
                <span>🧪</span> {task.experimentTitle}
              </span>
            )}
            {task.batchCode && (
              <span className="flex items-center gap-1 font-mono">
                <span>📦</span> {task.batchCode}
              </span>
            )}
            {task.dueDate && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-rose-600 font-bold' : ''}`}>
                <span>📅</span> {new Date(task.dueDate).toLocaleDateString('vi-VN')}
              </span>
            )}
            {task.requiredSkillDescription && (
              <span className="flex items-center gap-1">
                <span>⚙️</span> {task.requiredSkillDescription}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-xl hover:bg-surface-container/50 text-on-surface-variant transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-outline-variant pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <InfoCell label="Experiment" value={task.experimentTitle || '—'} />
            <InfoCell label="Giai Đoạn" value={task.experimentStageName || '—'} />
            <InfoCell label="Batch" value={task.batchCode || '—'} />
            <InfoCell label="Lịch Chăm Sóc" value={task.careScheduleTitle || '—'} />
            <InfoCell label="Người Tạo" value={task.createdByName || '—'} />
            <InfoCell label="Người Gán" value={task.assignedToName || '—'} />
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-outline-variant">
            {task.status === 'Pending' && (
              <button onClick={handleStart}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all">
                ▶ Bắt Đầu
              </button>
            )}
            {task.status === 'InProgress' && (
              <button onClick={handleComplete}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all">
                ✅ Hoàn Thành
              </button>
            )}
            {(task.status === 'Pending' || task.status === 'InProgress') && (
              <button onClick={handleCancel}
                className="px-4 py-2 border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all">
                Hủy
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const InfoCell = ({ label, value }) => (
  <div className="p-2 bg-surface-container-low/50 rounded-xl">
    <div className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant mb-0.5">{label}</div>
    <div className="font-semibold text-on-surface truncate">{value}</div>
  </div>
);

export default ResearcherTasks;
