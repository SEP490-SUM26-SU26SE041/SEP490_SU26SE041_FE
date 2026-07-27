import React, { useEffect, useState } from 'react';
import { tasksApi, taskReportsApi, experimentsApi } from '../../../api/experimentApi';
import { useToast } from '../../../context/ToastContext';
import { useConfirm, ConfirmDialog } from '../../../components/common/ConfirmDialog';

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
  const [experimentId, setExperimentId] = useState('');
  const [experiments, setExperiments] = useState([]);
  const [reportsModal, setReportsModal] = useState({ open: false, task: null, reports: [], loading: false });

  // Load danh sách experiments của researcher để fill vào dropdown filter
  useEffect(() => {
    const loadExperiments = async () => {
      try {
        const data = await experimentsApi.getAll();
        const list = Array.isArray(data) ? data : (data?.items || []);
        setExperiments(list);
      } catch { setExperiments([]); }
    };
    loadExperiments();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = { scope: activeTab, upcomingDays: 7 };
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
        {/* Filter theo thực nghiệm */}
        <select value={experimentId} onChange={e => setExperimentId(e.target.value)}
          className="px-3 py-2 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-[220px]">
          <option value="">Tất cả thực nghiệm</option>
          {experiments.map(exp => (
            <option key={exp.id} value={exp.id}>{exp.title || exp.name || `Exp ${exp.id.slice(0, 8)}`}</option>
          ))}
        </select>
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
            <TaskCard key={task.id} task={task} onRefresh={fetchTasks} onOpenReports={openReports} />
          ))}
        </div>
      )}

      {/* Task Reports Modal */}
      {reportsModal.open && (
        <TaskReportsModal
          task={reportsModal.task}
          reports={reportsModal.reports}
          loading={reportsModal.loading}
          onClose={closeReports}
        />
      )}
    </div>
  );
};

const TaskReportsModal = ({ task, reports, loading, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in" onClick={onClose}>
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-5 border-b border-outline-variant">
        <div className="min-w-0">
          <h3 className="font-hanken font-bold text-base text-on-surface">Báo Cáo Tác Vụ</h3>
          <p className="text-xs text-on-surface-variant mt-0.5 truncate">{task?.title || task?.taskTitle || '—'}</p>
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
              const resultEntries = r.resultData && typeof r.resultData === 'object'
                ? Object.entries(r.resultData)
                : [];
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

                  {r.reportText && (
                    <p className="text-sm text-on-surface whitespace-pre-line mt-1">{r.reportText}</p>
                  )}

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
);

const TaskCard = ({ task, onRefresh, onOpenReports }) => {
  const { showToast } = useToast();
  const { ask: askConfirm, state: confirmState, handleClose: closeConfirm } = useConfirm();
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
    if (!(await askConfirm({ title: 'Hủy tác vụ', message: 'Bạn có chắc muốn hủy tác vụ này?', confirmText: 'Hủy tác vụ' }))) return;
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
            {task.status === 'Completed' && onOpenReports && (
              <button onClick={() => onOpenReports(task)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all">
                📄 Xem Báo Cáo
              </button>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog state={confirmState} onClose={closeConfirm} />
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
