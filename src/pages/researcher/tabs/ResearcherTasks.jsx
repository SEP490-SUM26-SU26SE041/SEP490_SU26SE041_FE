import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { tasksApi, taskReportsApi, experimentsApi, measurementDefinitionsApi, taskImagesApi } from '../../../api/experimentApi';
import { skillsApi } from '../../../api/skillsApi';
import { useToast } from '../../../context/ToastContext';
import { canCancelTask, canEditTask, canDeleteTask, canSubmitReport, canGenerateTasksFromStage, canCreateTaskOnStage } from '../../../utils/taskValidation';

// ── Business Validation: Reassign ──────────────────────────────────────────────────
const REASSIGN_ALLOWED_STATUSES = ['Pending', 'Assigned', 'InProgress', 'Overdue'];
const REASSIGN_BLOCKED_STATUSES = ['Completed', 'Approved', 'Cancelled', 'Rejected', 'Resigned', 'Reassigned'];

export const getTaskAssignee = (task) => {
  if (!task) return { id: null, name: null };
  return {
    id: task.assignedToId || task.assignedToUserId || task.assigneeId || null,
    name: task.assignedToName || task.assignedToUserName || task.assigneeName || null
  };
};

export const isTaskAssigned = (task) => {
  const { id, name } = getTaskAssignee(task);
  return Boolean(id || name);
};

export const canReassignTask = (task, currentUserId) => {
  if (!task) return { allowed: false, reason: 'Không có tác vụ' };
  if (!REASSIGN_ALLOWED_STATUSES.includes(task.status)) {
    return { allowed: false, reason: `Không thể chuyển giao khi task đang ở trạng thái "${task.status}"` };
  }
  if (!isTaskAssigned(task)) {
    return { allowed: false, reason: 'Tác vụ chưa được gán — dùng "Gán" để phân công' };
  }
  const { id: assigneeId } = getTaskAssignee(task);
  if (currentUserId && assigneeId === currentUserId) {
    return { allowed: false, reason: 'Bạn là người đang được gán — không thể tự chuyển cho mình' };
  }
  return { allowed: true, reason: '' };
};

// ── Portal helper ─────────────────────────────────────────────────────────────

const Portal = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  Pending:    { label: 'Chờ',        dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  Assigned:   { label: 'Đã Giao',    dot: 'bg-indigo-500',  text: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  InProgress: { label: 'Đang Làm',   dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  Completed:  { label: 'Hoàn Thành', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  Approved:   { label: 'Đã Duyệt',   dot: 'bg-emerald-600', text: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  Rejected:   { label: 'Bị Từ Chối', dot: 'bg-rose-500',    text: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200' },
  Overdue:    { label: 'Quá Hạn',    dot: 'bg-rose-600',    text: 'text-rose-800',    bg: 'bg-rose-50',    border: 'border-rose-200' },
  Cancelled:  { label: 'Đã Hủy',     dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200' },
  Resigned:   { label: 'Đã Từ Chối', dot: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  Reassigned: { label: 'Đã Chuyển',  dot: 'bg-violet-500',  text: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-200' },
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

const STATUS_ORDER = ['Pending', 'Assigned', 'InProgress', 'Overdue', 'Completed', 'Approved', 'Rejected', 'Cancelled', 'Resigned', 'Reassigned'];

// Helper: kiểm tra task đã quá hạn (BE từ chối Start nếu overdue - theo spec line 909)
export const isTaskOverdue = (task) => {
  if (!task?.dueDate) return false;
  const finished = ['Completed', 'Cancelled', 'Approved', 'Rejected'];
  if (finished.includes(task.status)) return false;
  return new Date(task.dueDate) < new Date();
};

// Helper: kiểm tra task đã có report (BE không cho gửi report lần 2 - theo spec line 766)
export const hasTaskReport = (task) => {
  return task?.assignments?.some(a => a.reporterId && a.status === 'Completed') ||
         task?.hasReport === true;
};

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
const formatViDateTime = (d) => new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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
  const [users, setUsers] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [reportsModal, setReportsModal] = useState({ open: false, task: null, reports: [], loading: false });
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [editModal, setEditModal] = useState({ open: false, task: null, saving: false });
  const [skillMatches, setSkillMatches] = useState([]);
  const [userWorkload, setUserWorkload] = useState({});
  const [assignModalTask, setAssignModalTask] = useState(null);
  const [reassignModalTask, setReassignModalTask] = useState(null);
  const [assignForm, setAssignForm] = useState({ assigneeId: '', reason: '' });
  const [savingAssign, setSavingAssign] = useState(false);
  const [savingReassign, setSavingReassign] = useState(false);

  // Lấy current user ID từ localStorage
  const currentUserId = useMemo(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id || payload.sub || null;
    } catch { return null; }
  }, []);

  useEffect(() => {
    const loadExperiments = async () => {
      try {
        const data = await experimentsApi.getAll();
        setExperiments(Array.isArray(data) ? data : (data?.items || []));
      } catch { setExperiments([]); }
    };
    loadExperiments();
  }, []);

  // Load users cho assign/reassign
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await tasksApi.getSkillMatches('');
        if (Array.isArray(data)) {
          const uniqueUsers = [];
          const seen = new Set();
          data.forEach(m => {
            if (m.userId && !seen.has(m.userId)) {
              seen.add(m.userId);
              uniqueUsers.push(m);
            }
          });
          setUsers(uniqueUsers);
        }
      } catch { setUsers([]); }
    };
    loadUsers();
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

  // Handle open assign modal
  const handleOpenAssign = async (task) => {
    setAssignModalTask(task);
    setAssignForm({ assigneeId: '', reason: '' });
    setSkillMatches([]);
    setUserWorkload({});
    try {
      const matches = await tasksApi.getSkillMatches(task.id);
      const matchList = Array.isArray(matches) ? matches : [];
      setSkillMatches(matchList);

      // Fetch workload for each user
      const workloadMap = {};
      await Promise.allSettled(matchList.map(m =>
        tasksApi.getByUser(m.userId).then(res => {
          const tasks = Array.isArray(res) ? res : [];
          workloadMap[m.userId] = {
            totalTasks: tasks.length,
            pendingTasks: tasks.filter(t => t.status === 'Pending').length,
            inProgressTasks: tasks.filter(t => t.status === 'InProgress').length,
            overdueTasks: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed' && t.status !== 'Cancelled').length,
            roleName: m.roleName
          };
        }).catch(() => {})
      ));
      setUserWorkload(workloadMap);
    } catch { setSkillMatches([]); }
  };

  // Handle confirm assign
  const handleConfirmAssign = async () => {
    if (!assignModalTask) return;
    if (!assignForm.assigneeId) { showToast('Vui lòng chọn người được giao', 'error'); return; }
    setSavingAssign(true);
    try {
      await tasksApi.assign({ taskId: assignModalTask.id, assigneeId: assignForm.assigneeId, reason: assignForm.reason });
      showToast('Đã gán tác vụ', 'success');
      setAssignModalTask(null);
      fetchTasks();
    } catch (err) { showToast(err.message || 'Lỗi gán tác vụ', 'error'); }
    finally { setSavingAssign(false); }
  };

  // Handle open reassign modal
  const handleOpenReassign = async (task) => {
    const check = canReassignTask(task, currentUserId);
    if (!check.allowed) { showToast(check.reason, 'error'); return; }
    setReassignModalTask({ task, form: { assigneeId: '', reason: '' }, skillMatches: [], userWorkload: {}, loading: true });
    try {
      const matches = await tasksApi.getSkillMatches(task.id);
      const matchList = Array.isArray(matches) ? matches : [];
      setReassignModalTask(prev => prev ? { ...prev, skillMatches: matchList, loading: false } : prev);

      // Fetch workload
      const workloadMap = {};
      await Promise.allSettled(matchList.map(m =>
        tasksApi.getByUser(m.userId).then(res => {
          const tasks = Array.isArray(res) ? res : [];
          workloadMap[m.userId] = {
            totalTasks: tasks.length,
            pendingTasks: tasks.filter(t => t.status === 'Pending').length,
            inProgressTasks: tasks.filter(t => t.status === 'InProgress').length,
            overdueTasks: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Completed' && t.status !== 'Cancelled').length,
            roleName: m.roleName
          };
        }).catch(() => {})
      ));
      setReassignModalTask(prev => prev ? { ...prev, userWorkload: workloadMap } : prev);
    } catch { setReassignModalTask(prev => prev ? { ...prev, loading: false } : prev); }
  };

  // Handle confirm reassign
  const handleConfirmReassign = async () => {
    if (!reassignModalTask) return;
    const { task, form } = reassignModalTask;
    const check = canReassignTask(task, currentUserId);
    if (!check.allowed) { showToast(check.reason, 'error'); setReassignModalTask(null); return; }
    if (!form.assigneeId) { showToast('Vui lòng chọn người được chuyển giao', 'error'); return; }
    if (form.assigneeId === getTaskAssignee(task).id) { showToast('Không thể chuyển cho cùng người đang giữ task', 'error'); return; }
    setSavingReassign(true);
    try {
      await tasksApi.reassign({ taskId: task.id, newAssigneeId: form.assigneeId, reason: form.reason });
      showToast('Đã chuyển giao tác vụ', 'success');
      setReassignModalTask(null);
      fetchTasks();
    } catch (err) { showToast(err.message || 'Lỗi chuyển giao', 'error'); }
    finally { setSavingReassign(false); }
  };

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
        <KanbanView tasks={filtered} onSelect={setSelectedTask} onOpenReports={openReports} onChange={fetchTasks} onEdit={(t) => setEditModal({ open: true, task: t, saving: false })} />
      ) : view === 'calendar' ? (
        <CalendarView tasks={filtered} weekAnchor={weekAnchor} setWeekAnchor={setWeekAnchor} onSelect={setSelectedTask} />
      ) : (
        <ListView tasks={filtered} onSelect={setSelectedTask} onOpenReports={openReports} onChange={fetchTasks} onEdit={(t) => setEditModal({ open: true, task: t, saving: false })} />
      )}

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onOpenReports={openReports}
          onChange={() => { fetchTasks(); setSelectedTask(null); }}
          onEdit={(t) => setEditModal({ open: true, task: t, saving: false })}
          onAssign={handleOpenAssign}
          onReassign={handleOpenReassign}
        />
      )}

      {/* ── Edit Task Modal ───────────────────────────────────────────────── */}
      {editModal.open && (
        <TaskEditModal
          task={editModal.task}
          saving={editModal.saving}
          onClose={() => setEditModal({ open: false, task: null, saving: false })}
          onSubmit={async (payload) => {
            // P0-#3: validate nghiệp vụ trước khi gọi API
            const check = canEditTask(editModal.task);
            if (!check.allowed) { showToast(check.reason, 'error'); return; }
            try {
              setEditModal(prev => ({ ...prev, saving: true }));
              await tasksApi.update(editModal.task.id, payload);
              showToast('Đã cập nhật tác vụ', 'success');
              setEditModal({ open: false, task: null, saving: false });
              fetchTasks();
              setSelectedTask(null);
            } catch (err) {
              showToast(err.message || 'Lỗi cập nhật tác vụ', 'error');
              setEditModal(prev => ({ ...prev, saving: false }));
            }
          }}
        />
      )}

      {/* ── Reports Modal ─────────────────────────────────────────────────── */}
      {reportsModal.open && (
        <TaskReportsModal task={reportsModal.task} reports={reportsModal.reports} loading={reportsModal.loading} onClose={closeReports} />
      )}

      {/* ── Assign Modal ─────────────────────────────────────────────────── */}
      {assignModalTask && (
        <AssignReassignModal
          type="assign"
          task={assignModalTask}
          form={assignForm}
          setForm={setAssignForm}
          skillMatches={skillMatches}
          userWorkload={userWorkload}
          loading={skillMatches.length === 0}
          saving={savingAssign}
          onConfirm={handleConfirmAssign}
          onClose={() => setAssignModalTask(null)}
          currentUserId={currentUserId}
        />
      )}

      {/* ── Reassign Modal ─────────────────────────────────────────────────── */}
      {reassignModalTask && (
        <AssignReassignModal
          type="reassign"
          task={reassignModalTask.task}
          form={reassignModalTask.form}
          setForm={(patch) => setReassignModalTask(prev => prev ? { ...prev, form: { ...prev.form, ...patch } } : prev)}
          skillMatches={reassignModalTask.skillMatches}
          userWorkload={reassignModalTask.userWorkload}
          loading={reassignModalTask.loading}
          saving={savingReassign}
          onConfirm={handleConfirmReassign}
          onClose={() => setReassignModalTask(null)}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// VIEW: Kanban
// ────────────────────────────────────────────────────────────────────────────

const KanbanView = ({ tasks, onSelect, onOpenReports, onChange, onEdit }) => {
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
              col.items.map(t => <KanbanCard key={t.id} task={t} onSelect={onSelect} onEdit={onEdit} />)
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const KanbanCard = ({ task, onSelect, onEdit }) => {
  const tm = TASK_TYPE_META[task.taskType] || TASK_TYPE_META.Other;
  const sm = STATUS_META[task.status] || STATUS_META.Pending;
  const overdue = isTaskOverdue(task);
  const rel = task.dueDate ? relativeDay(task.dueDate) : null;
  // Không cho edit khi đã hoàn thành/đã hủy/đã duyệt
  const editable = !['Completed', 'Approved', 'Cancelled', 'Rejected'].includes(task.status);

  return (
    <div className={`relative bg-white rounded-xl border ${overdue ? 'border-rose-300 border-l-4 border-l-rose-500' : 'border-outline-variant'} hover:shadow-md hover:border-indigo-300 transition-all group`}>
      <button type="button" onClick={() => onSelect(task)}
        className="w-full text-left p-3">
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
      {editable && onEdit && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(task); }}
          className="absolute top-2 right-2 p-1 rounded-lg text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 opacity-0 group-hover:opacity-100 transition-all"
          title="Sửa tác vụ">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"/></svg>
        </button>
      )}
    </div>
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

const ListView = ({ tasks, onSelect, onOpenReports, onChange, onEdit }) => (
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
            const editable = !['Completed', 'Approved', 'Cancelled', 'Rejected'].includes(t.status);
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
                  <div className="inline-flex items-center gap-1">
                    {editable && onEdit && (
                      <button onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Sửa tác vụ">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"/></svg>
                      </button>
                    )}
                    <button onClick={() => onSelect(t)}
                      className="px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                      Chi tiết →
                    </button>
                  </div>
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

const TaskDetailDrawer = ({ task, onClose, onOpenReports, onChange, onEdit, onAssign, onReassign }) => {
  const { showToast } = useToast();
  const tm = TASK_TYPE_META[task.taskType] || TASK_TYPE_META.Other;
  const sm = STATUS_META[task.status] || STATUS_META.Pending;
  const overdue = isTaskOverdue(task);
  const rel = task.dueDate ? relativeDay(task.dueDate) : null;
  const assigned = isTaskAssigned(task);
  const reassignCheck = canReassignTask(task, null);

  const handleCancel = async () => {
    const check = canCancelTask(task);
    if (!check.allowed) { showToast(check.reason, 'error'); return; }
    if (!window.confirm(`Hủy tác vụ "${task.title || ''}"?`)) return;
    try { await tasksApi.cancel(task.id); showToast('Đã hủy tác vụ', 'success'); onChange(); }
    catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10500] animate-fade-in" onClick={onClose}>
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
                value={task.dueDate ? formatViDateTime(task.dueDate) : '—'}
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

            {task.skillRequirements && task.skillRequirements.length > 0 && (
              <Section title="Skill Requirements" icon="🎯">
                <div className="space-y-2">
                  {task.skillRequirements.map((sr, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">🎯</span>
                        <span className="text-sm font-semibold text-on-surface">{sr.skillName || sr.skillId}</span>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                        Yêu cầu Level {sr.requiredLevel}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {task.assignments && task.assignments.length > 0 && (
              <Section title="Lịch Sử Phân Công" icon="📋">
                <div className="space-y-2">
                  {task.assignments.map((a, i) => (
                    <div key={i} className="p-3 bg-white border border-outline-variant rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">{a.assigneeName}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          a.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                          a.status === 'Assigned' ? 'bg-blue-100 text-blue-700' :
                          a.status === 'Reassigned' ? 'bg-violet-100 text-violet-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{a.status}</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant">📧 {a.assigneeEmail}</p>
                      <p className="text-[10px] text-on-surface-variant">Vai trò: {a.assigneeRole}</p>
                      {a.reason && <p className="text-xs text-on-surface mt-1">💬 {a.reason}</p>}
                      {a.assigneeSkills && a.assigneeSkills.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {a.assigneeSkills.map((sk, j) => (
                            <span key={j} className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded">
                              {sk.skillName} L{sk.proficiencyLevel}
                            </span>
                          ))}
                        </div>
                      )}
                      {a.assignedAt && (
                        <p className="text-[10px] text-on-surface-variant mt-1">📅 {formatViDate(a.assignedAt)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-low/30 flex items-center gap-2 flex-wrap">
            {/* Completed: chỉ có Xem Báo Cáo */}
            {task.status === 'Completed' && (
              <button onClick={() => { onOpenReports(task); onClose(); }}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all">
                📄 Xem Báo Cáo
              </button>
            )}

            {/* Pending / InProgress: Sửa + Gán + Chuyển Giao + Hủy */}
            {(task.status === 'Pending' || task.status === 'InProgress') && (
              <>
                <button onClick={() => onEdit(task)}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5"
                  title="Sửa thông tin tác vụ">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"/></svg>
                  Sửa
                </button>

                {/* Nút Gán - chỉ hiện khi chưa gán */}
                {!assigned && (
                  <button onClick={() => { onAssign(task); onClose(); }}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-1.5">
                    🎯 Gán
                  </button>
                )}

                {/* Nút Chuyển Giao - chỉ hiện khi đã gán */}
                {assigned && (
                  <button onClick={() => { onReassign(task); onClose(); }}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-1.5">
                    🔄 Chuyển Giao
                  </button>
                )}

                <button onClick={handleCancel}
                  disabled={overdue}
                  className="px-4 py-2.5 border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  title={overdue ? 'Không thể hủy task quá hạn' : 'Hủy tác vụ'}>
                  Hủy
                </button>
              </>
            )}

            {/* Assigned: có thể xem báo cáo + chuyển giao */}
            {task.status === 'Assigned' && (
              <>
                <button onClick={() => { onOpenReports(task); onClose(); }}
                  disabled={hasTaskReport(task)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  📄 {hasTaskReport(task) ? 'Đã Có Báo Cáo' : 'Xem Báo Cáo'}
                </button>
                <button onClick={() => { onReassign(task); onClose(); }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-1.5">
                  🔄 Chuyển Giao
                </button>
              </>
            )}

            {/* Cancelled */}
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

const TaskReportsModal = ({ task, reports, loading, onClose }) => {
  // Definitions state (keyed by definition.id for fast lookup)
  const [definitions, setDefinitions] = useState([]);
  const [loadingDefs, setLoadingDefs] = useState(false);

  // Images map: reportId -> list of TaskImage (fetched from API)
  const [imagesMap, setImagesMap] = useState({});
  const [loadingImages, setImagesLoading] = useState(false);

  // Build definitionMap: definition.id -> definition
  const definitionMap = useMemo(() => {
    const m = new Map();
    for (const d of definitions) m.set(d.id, d);
    return m;
  }, [definitions]);

  // Resolve key 'def_<uuid>' -> display label (metricName + unit)
  const resolveMetricLabel = (key) => {
    if (typeof key !== 'string') return String(key);
    if (key.startsWith('def_')) {
      const defId = key.slice(4);
      const def = definitionMap.get(defId);
      if (def?.metricName) {
        return def.unit ? `${def.metricName} (${def.unit})` : def.metricName;
      }
      return `Chỉ số #${defId.slice(0, 8)}`;
    }
    return key;
  };

  // Fetch definitions by experimentId from task
  useEffect(() => {
    const expId = task?.experimentId || task?.experiment?.id;
    if (!expId) {
      setDefinitions([]);
      return;
    }
    let cancelled = false;
    setLoadingDefs(true);
    measurementDefinitionsApi.getByExperiment(expId)
      .then(data => {
        if (!cancelled) setDefinitions(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelled) setDefinitions([]); })
      .finally(() => { if (!cancelled) setLoadingDefs(false); });
    return () => { cancelled = true; };
  }, [task?.experimentId, task?.experiment?.id]);

  // Fetch images per report (same logic as StudentDashboard)
  useEffect(() => {
    if (!Array.isArray(reports) || reports.length === 0) {
      setImagesMap({});
      return;
    }
    const reportsNeedingFetch = reports.filter(r => r.id && !imagesMap[r.id]);
    if (reportsNeedingFetch.length === 0) return;

    let cancelled = false;
    setImagesLoading(true);
    (async () => {
      const results = await Promise.allSettled(
        reportsNeedingFetch.map(r => taskImagesApi.getByTaskReport(r.id))
      );
      if (cancelled) return;
      setImagesMap(prev => {
        const next = { ...prev };
        reportsNeedingFetch.forEach((r, i) => {
          const res = results[i];
          if (res.status === 'fulfilled') {
            const list = Array.isArray(res.value) ? res.value
              : (Array.isArray(res.value?.data) ? res.value.data : []);
            next[r.id] = list;
          } else {
            // Fallback: dùng ảnh có sẵn trong report
            next[r.id] = Array.isArray(r.images) ? r.images : [];
          }
        });
        return next;
      });
      setImagesLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports.map(r => r.id).join(',')]);

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10800] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-scale-in" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-outline-variant shrink-0">
            <div className="min-w-0 flex-1">
              <h3 className="font-hanken font-bold text-base text-on-surface">Báo Cáo Tác Vụ</h3>
              <p className="text-xs text-on-surface-variant mt-0.5 truncate">{task?.title || '—'}</p>
              {reports.length > 0 && (
                <p className="text-[10px] text-emerald-700 font-bold mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full">
                  ✅ Đã có báo cáo · BE không cho gửi thêm
                </p>
              )}
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
              <div className="space-y-4">
                {reports.map(r => {
                  const resultEntries = r.resultData && typeof r.resultData === 'object' ? Object.entries(r.resultData) : [];
                  const imageList = Array.isArray(imagesMap[r.id]) ? imagesMap[r.id] : [];
                  const dateText = r.reportedAt || r.createdAt;

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
                          <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2 flex items-center gap-1.5">
                            <span>📊</span> Kết Quả Đo Lường
                            {loadingDefs && <span className="text-[9px] text-slate-400 italic ml-1">đang tải...</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {resultEntries.map(([key, value]) => {
                              const label = resolveMetricLabel(key);
                              const def = definitionMap.get(key.startsWith('def_') ? key.slice(4) : '');
                              const unit = def?.unit || '';
                              const target = def?.targetValue;
                              const num = parseFloat(value);
                              const targetNum = parseFloat(target);
                              const meetsTarget = !isNaN(num) && !isNaN(targetNum) && num >= targetNum;
                              const closeTarget = !isNaN(num) && !isNaN(targetNum) && num < targetNum && num >= targetNum * 0.8;

                              return (
                                <div key={key} className="text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[10px] text-on-surface-variant font-bold truncate">{label}</div>
                                      <div className="flex items-baseline gap-1 mt-0.5">
                                        <span className="font-bold text-on-surface text-sm">{String(value)}</span>
                                        {unit && <span className="text-[10px] text-on-surface-variant">{unit}</span>}
                                      </div>
                                    </div>
                                    {!isNaN(num) && !isNaN(targetNum) && (
                                      <span className="shrink-0" title={`Target: ${target}${unit}`}>
                                        {meetsTarget && <span className="text-emerald-600 font-bold text-sm">✅</span>}
                                        {!meetsTarget && closeTarget && <span className="text-amber-500 font-bold text-sm">⚡</span>}
                                        {!meetsTarget && !closeTarget && <span className="text-rose-400 font-bold text-sm">⚠️</span>}
                                      </span>
                                    )}
                                  </div>
                                  {target != null && (
                                    <div className="text-[9px] text-on-surface-variant mt-0.5">
                                      🎯 Target: <span className="font-semibold">{target}{unit}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {imageList.length > 0 && (
                        <div className="mt-3">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2 flex items-center gap-1.5">
                            <span>📷</span> Hình Ảnh ({imageList.length})
                            {loadingImages && <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse ml-1" />}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {imageList.map((img, i) => (
                              <a key={img.id || i} href={img.imageUrl || img.url} target="_blank" rel="noopener noreferrer"
                                className="block w-14 h-14 rounded-lg overflow-hidden border border-outline-variant hover:opacity-80 hover:shadow-md transition-all relative group"
                                title={img.caption || ''}>
                                <img src={img.imageUrl || img.url} alt={img.caption || `img-${i}`} className="w-full h-full object-cover" />
                                {img.caption && (
                                  <span className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/70 text-white text-[8px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                    {img.caption}
                                  </span>
                                )}
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
};

export default ResearcherTasks;

// ────────────────────────────────────────────────────────────────────────────
// ASSIGN / REASSIGN MODALS
// ────────────────────────────────────────────────────────────────────────────

// Reusable Assign/Reassign modal (dùng chung cho cả 2 trường hợp)
const AssignReassignModal = ({
  type, // 'assign' | 'reassign'
  task,
  form,
  setForm,
  skillMatches,
  userWorkload,
  loading,
  saving,
  onConfirm,
  onClose,
  currentUserId
}) => {
  const isReassign = type === 'reassign';
  const currentAssignee = getTaskAssignee(task);
  const rankedMatches = useMemo(() => {
    if (!Array.isArray(skillMatches)) return [];
    return [...skillMatches].sort((a, b) => {
      const scoreA = a.matchScore || 0;
      const scoreB = b.matchScore || 0;
      const tasksA = userWorkload[a.userId]?.totalTasks || 0;
      const tasksB = userWorkload[b.userId]?.totalTasks || 0;
      return (scoreB - scoreA) || (tasksA - tasksB);
    });
  }, [skillMatches, userWorkload]);

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10600] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className={`px-6 py-4 border-b border-outline-variant ${isReassign ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : 'bg-gradient-to-r from-emerald-50 to-teal-50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-hanken font-bold text-lg ${isReassign ? 'text-blue-900' : 'text-emerald-900'}`}>
                  {isReassign ? '🔄 Chuyển Giao Tác Vụ' : '🎯 Gán Tác Vụ'}
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5 truncate">{task?.title || '—'}</p>
                {isReassign && currentAssignee.name && (
                  <p className="text-[10px] text-blue-600 mt-0.5">
                    👤 Hiện tại: <span className="font-semibold">{currentAssignee.name}</span>
                  </p>
                )}
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Task info */}
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 border border-slate-200">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Loại:</span>
                <span className="font-semibold">{task?.taskType || '—'}</span>
              </div>
              {task?.dueDate && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Hạn:</span>
                  <span className="font-semibold">{formatViDateTime(task.dueDate)}</span>
                </div>
              )}
              {task?.requiredSkillDescription && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Kỹ năng:</span>
                  <span className="font-semibold">{task.requiredSkillDescription}</span>
                </div>
              )}
            </div>

            {/* Skill matches */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                  🎯 Người phù hợp
                </p>
              </div>
              {loading ? (
                <div className="space-y-1">
                  <p className="text-xs text-on-surface-variant italic py-2">Đang tìm người phù hợp...</p>
                </div>
              ) : rankedMatches.length === 0 ? (
                <p className="text-xs text-on-surface-variant italic py-2">Không tìm thấy người phù hợp.</p>
              ) : (
                <div className="space-y-2">
                  {rankedMatches.map((m, idx) => {
                    const isSelected = form.assigneeId === m.userId;
                    const isCurrentUser = m.userId === currentAssignee.id;
                    const wl = userWorkload[m.userId];

                    return (
                      <button key={m.userId} type="button"
                        onClick={() => !isCurrentUser && setForm({ ...form, assigneeId: m.userId })}
                        disabled={isCurrentUser}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 shadow-md'
                            : isCurrentUser
                              ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                              : 'border-outline-variant bg-white hover:border-emerald-200'
                        }`}>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                          {(m.fullName || m.userId || '?')[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-on-surface truncate flex items-center gap-1.5">
                            {m.fullName || m.userId}
                            {isCurrentUser && <span className="text-[9px] text-slate-500">(Hiện tại)</span>}
                          </p>
                          <p className="text-[10px] text-on-surface-variant">{m.roleName || '—'}</p>
                          {wl && (
                            <p className="text-[9px] text-on-surface-variant mt-0.5">
                              📋 {wl.totalTasks} task · {wl.pendingTasks} chờ · {wl.inProgressTasks} đang làm
                            </p>
                          )}
                        </div>
                        {isSelected && <span className="text-emerald-600 font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">
                📝 Lý do {isReassign ? 'chuyển giao' : 'giao'} (tùy chọn)
              </label>
              <textarea
                value={form.reason || ''}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                placeholder="VD: Phân công lại do người cũ bận..."
                rows={2}
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-outline-variant bg-slate-50 flex items-center justify-end gap-2">
            <button onClick={onClose} disabled={saving}
              className="px-4 py-2 border border-outline-variant rounded-xl text-sm font-semibold hover:bg-white transition-colors disabled:opacity-50">
              Hủy
            </button>
            <button onClick={onConfirm} disabled={saving || !form.assigneeId}
              className={`px-5 py-2 rounded-xl text-sm font-bold shadow transition-all disabled:opacity-50 flex items-center gap-2 ${
                isReassign
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
              }`}>
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Đang xử lý...
                </>
              ) : isReassign ? '🔄 Chuyển Giao' : '🎯 Gán'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// TASK EDIT MODAL
// ────────────────────────────────────────────────────────────────────────────

const TASK_TYPE_OPTIONS = [
  { value: 'Planting', label: '🌱 Trồng' },
  { value: 'Watering', label: '💧 Tưới nước' },
  { value: 'Fertilizing', label: '🧪 Bón phân' },
  { value: 'Observation', label: '👁️ Quan sát' },
  { value: 'Inspection', label: '🔍 Kiểm tra' },
  { value: 'Harvest', label: '🌾 Thu hoạch' },
  { value: 'Other', label: '📋 Khác' },
];

const STATUS_OPTIONS = [
  { value: 'Pending', label: '⏳ Chờ' },
  { value: 'InProgress', label: '⚙️ Đang làm' },
  { value: 'Cancelled', label: '🚫 Đã hủy' },
];

const toDateInput = (val) => {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return '';
  // YYYY-MM-DDTHH:mm cho input datetime-local
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const TaskEditModal = ({ task, saving, onClose, onSubmit }) => {
  const initial = useMemo(() => ({
    title: task.title || '',
    description: task.description || '',
    taskType: task.taskType || 'Other',
    status: task.status || 'Pending',
    dueDate: toDateInput(task.dueDate),
    requiredSkillDescription: task.requiredSkillDescription || '',
    // Map từ task.skillRequirements (object) → dạng mảng phẳng
    skillRequirements: Array.isArray(task.skillRequirements)
      ? task.skillRequirements.map(sr => ({ skillId: sr.skillId, requiredLevel: sr.requiredLevel || 1 }))
      : [],
  }), [task]);

  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [allSkills, setAllSkills] = useState([]);
  const [skillLoading, setSkillLoading] = useState(false);

  useEffect(() => { setForm(initial); setError(''); }, [initial]);

  // Load danh sách skill từ BE
  useEffect(() => {
    let cancelled = false;
    setSkillLoading(true);
    skillsApi.getAll()
      .then(data => { if (!cancelled) setAllSkills(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setAllSkills([]); })
      .finally(() => { if (!cancelled) setSkillLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggleSkill = (skillId) => {
    setForm(prev => {
      const exists = prev.skillRequirements.some(sr => sr.skillId === skillId);
      return {
        ...prev,
        skillRequirements: exists
          ? prev.skillRequirements.filter(sr => sr.skillId !== skillId)
          : [...prev.skillRequirements, { skillId, requiredLevel: 1 }]
      };
    });
  };

  const setLevel = (skillId, level) => {
    const lv = Math.max(1, Math.min(5, Number(level) || 1));
    setForm(prev => ({
      ...prev,
      skillRequirements: prev.skillRequirements.map(sr =>
        sr.skillId === skillId ? { ...sr, requiredLevel: lv } : sr)
    }));
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setError('');

    if (!form.title.trim()) {
      setError('Tiêu đề không được để trống');
      return;
    }
    if (form.dueDate) {
      const due = new Date(form.dueDate);
      if (isNaN(due.getTime())) {
        setError('Hạn chót không hợp lệ');
        return;
      }
    }

    // Lọc skillRequirements hợp lệ trước khi gửi
    const cleanSkills = (form.skillRequirements || [])
      .filter(sr => sr && sr.skillId && Number(sr.requiredLevel) >= 1)
      .map(sr => ({ skillId: sr.skillId, requiredLevel: Number(sr.requiredLevel) }));

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      taskType: form.taskType,
      status: form.status,
      requiredSkillDescription: form.requiredSkillDescription.trim() || null,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
      skillRequirements: cleanSkills.length > 0 ? cleanSkills : [],
    };

    onSubmit(payload);
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[11000] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
        <form
          onSubmit={handleSubmit}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col animate-scale-in">
          {/* Header */}
          <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-gradient-to-br from-amber-50 via-white to-indigo-50 rounded-t-2xl">
            <div className="min-w-0 flex-1">
              <h3 className="font-hanken font-bold text-base text-on-surface flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z"/></svg>
                Sửa Tác Vụ
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5 truncate">🧪 {task.experimentTitle || '—'}</p>
            </div>
            <button type="button" onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/60 transition-colors shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">
                Tiêu đề <span className="text-rose-500">*</span>
              </label>
              <input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="VD: Tưới nước buổi sáng"
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Loại tác vụ</label>
                <select
                  value={form.taskType}
                  onChange={e => setForm({ ...form, taskType: e.target.value })}
                  className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500">
                  {TASK_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Trạng thái</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500">
                  {STATUS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Hạn chót</label>
              <input
                type="datetime-local"
                value={form.dueDate}
                onChange={e => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Kỹ năng yêu cầu</label>
              <input
                value={form.requiredSkillDescription}
                onChange={e => setForm({ ...form, requiredSkillDescription: e.target.value })}
                placeholder="VD: Biết cách đo pH, hiểu về dinh dưỡng cây trồng..."
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            {/* Skill Requirements */}
            <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  🎯 Kỹ năng yêu cầu (theo danh mục skill)
                </label>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                  {form.skillRequirements.length} đã chọn
                </span>
              </div>

              {form.skillRequirements.length > 0 && (
                <div className="space-y-2">
                  {form.skillRequirements.map((sr) => {
                    const skill = allSkills.find(s => s.id === sr.skillId);
                    return (
                      <div key={sr.skillId}
                        className="flex items-center gap-2 p-2 bg-white border border-indigo-200 rounded-lg">
                        <span className="flex-1 min-w-0 text-sm font-semibold text-on-surface truncate">
                          {skill?.skillName || sr.skillId}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-600">Level</span>
                        <input
                          type="number" min={1} max={5}
                          value={sr.requiredLevel}
                          onChange={e => setLevel(sr.skillId, e.target.value)}
                          className="w-16 px-2 py-1 border border-indigo-200 rounded-lg text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                        <button type="button"
                          onClick={() => toggleSkill(sr.skillId)}
                          className="p-1 text-indigo-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                          title="B� chọn">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {skillLoading ? (
                <p className="text-[10px] text-indigo-600 italic">Đang tải danh sách skill...</p>
              ) : allSkills.length === 0 ? (
                <p className="text-[10px] text-amber-700 italic">
                  ⚠️ Chưa có skill nào trong hệ thống. Vào Admin → Quản lý Kỹ Năng để tạo trước.
                </p>
              ) : (
                <select
                  value=""
                  onChange={e => { if (e.target.value) toggleSkill(e.target.value); e.target.value = ''; }}
                  className="w-full px-3 py-2 border border-indigo-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                  <option value="">➕ Thêm skill yêu cầu...</option>
                  {allSkills
                    .filter(s => !form.skillRequirements.some(sr => sr.skillId === s.id))
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.skillName}</option>
                    ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Mô tả</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={4}
                placeholder="Mô tả chi tiết công việc cần làm..."
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
              />
            </div>

            {error && (
              <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-low/30 flex items-center gap-2 justify-end rounded-b-2xl">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-4 py-2 border border-outline-variant rounded-xl text-sm font-semibold hover:bg-surface-container transition-colors disabled:opacity-50">
              Hủy
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-500/20 transition-all disabled:opacity-60 flex items-center gap-2">
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Đang lưu...
                </>
              ) : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </Portal>
  );
};