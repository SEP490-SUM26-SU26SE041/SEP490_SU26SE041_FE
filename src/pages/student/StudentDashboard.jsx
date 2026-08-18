import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../context/ToastContext';
import { tasksApi, taskReportsApi, taskImagesApi, measurementRecordsApi } from '../../api/sharedTaskApi';
import { experimentsApi } from '../../api/studentTechApi';
import { canSubmitReport } from '../../utils/taskValidation';
import { authLogoutSync } from '../../utils/authLogout';
import NotificationBell from '../../components/notifications/NotificationBell';
import TaskReportForm, { buildReportPayload } from '../../components/tasks/TaskReportForm';
import ImageUploader from '../../components/tasks/ImageUploader';
import { extractMeasurementsFromReport, buildMeasurementPayloads, createMeasurementsFromTaskReport, previewMeasurements, extractBulkItemsFromResultData, createMeasurementsBulk, filterDefinitionsByTaskGroup } from '../../utils/measurementBridge';
import { batchesApi, measurementDefinitionsApi } from '../../api/experimentApi';
import { validateForm, isValid, required, nonNegativeNumber, pastOrTodayDate, minValue, maxValue, compose } from '../../utils/validation';

const STU_TABS = [
  { id: 'overview', label: 'Tổng Quan', icon: '🏠' },
  { id: 'tasks', label: 'Công Việc', icon: '📋' },
  { id: 'reports', label: 'Báo Cáo', icon: '📝' },
  { id: 'morphology', label: 'Ghi Nhận', icon: '📊' },
];

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

// ── Portal helper ─────────────────────────────────────────────────────────────
// Render modals at document root so they escape the dashboard's stacking
// context (which has z-[1000]) and always sit above the SharedSidebar (z-50).

const Portal = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

// ── Student Dashboard ──────────────────────────────────────────────────────────

const StudentDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 font-sans text-slate-900 fixed inset-0 z-[1000]">
      <aside className="w-64 bg-white border-r border-slate-200 text-slate-900 flex flex-col fixed h-full z-50 shadow-sm">
        <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Vườn <span className="text-emerald-600">Ươm</span></h1>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">Sinh Viên</p>
            {(() => { try { const u = JSON.parse(localStorage.getItem('user') || '{}'); return u.fullName ? <p className="mt-2 text-xs text-slate-500 font-medium">{u.fullName}</p> : null; } catch { return null; } })()}
          </div>
          <NotificationBell />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {STU_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}>
              <span className="text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <button onClick={() => authLogoutSync()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 text-sm font-medium transition-all">
            <span className="text-base">🚪</span> Đăng Xuất
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="px-8 py-8">
          <div className="mb-8">
            <h2 className="font-hanken text-2xl font-bold text-slate-900">
              {STU_TABS.find(t => t.id === activeTab)?.label || 'Dashboard'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {activeTab === 'overview' && 'Tổng quan công việc và hoạt động của bạn'}
              {activeTab === 'tasks' && 'Danh sách công việc được giao'}
              {activeTab === 'reports' && 'Báo cáo tác vụ đã gửi'}
              {activeTab === 'morphology' && 'Ghi nhận dữ liệu hình thái học'}
            </p>
          </div>

          {activeTab === 'overview' && <StudentOverview setActiveTab={setActiveTab} />}
          {activeTab === 'tasks' && <StudentTasksTab />}
          {activeTab === 'reports' && <StudentReportsTab />}
          {activeTab === 'morphology' && <StudentMorphologySection setActiveTab={setActiveTab} />}
        </div>
      </main>
    </div>
  );
};

// ── Student Overview ───────────────────────────────────────────────────────────

const StudentOverview = ({ setActiveTab }) => {
  const { showToast } = useToast();
  const [stats, setStats] = useState({ my: 0, today: 0, upcoming: 0, overdue: 0 });
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [myData, todayData, upcomingData, overdueData] = await Promise.allSettled([
          tasksApi.getMy(),
          tasksApi.getToday(),
          tasksApi.getUpcoming(7),
          tasksApi.getOverdue()
        ]);
        const allTasks = myData.status === 'fulfilled' ? (Array.isArray(myData.value) ? myData.value : []) : [];
        const todayTasks = todayData.status === 'fulfilled' ? (Array.isArray(todayData.value) ? todayData.value : []) : [];
        const upcomingTasks = upcomingData.status === 'fulfilled' ? (Array.isArray(upcomingData.value) ? upcomingData.value : []) : [];
        const overdueTasks = overdueData.status === 'fulfilled' ? (Array.isArray(overdueData.value) ? overdueData.value : []) : [];

        setStats({
          my: allTasks.length,
          today: todayTasks.length,
          upcoming: upcomingTasks.length,
          overdue: overdueTasks.length
        });
        setRecentTasks(allTasks.slice(0, 5));
      } catch { /* silent */ } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-600/20">
        <h3 className="font-hanken text-xl font-bold mb-1">Chào mừng bạn trở lại!</h3>
        <p className="text-blue-100 text-sm">Tiếp tục học hỏi và thực hành canh tác thông minh.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Công Việc Của Tôi', value: stats.my, icon: '📋', bg: 'bg-blue-50 border-blue-200', color: 'text-blue-700', tab: 'tasks' },
          { label: 'Hôm Nay', value: stats.today, icon: '📅', bg: 'bg-amber-50 border-amber-200', color: 'text-amber-700', tab: 'tasks' },
          { label: 'Sắp Tới (7 ngày)', value: stats.upcoming, icon: '⏰', bg: 'bg-indigo-50 border-indigo-200', color: 'text-indigo-700', tab: 'tasks' },
          { label: 'Quá Hạn', value: stats.overdue, icon: '🚨', bg: 'bg-rose-50 border-rose-200', color: 'text-rose-700', tab: 'tasks' },
        ].map(s => (
          <button key={s.label} onClick={() => setActiveTab(s.tab)}
            className={`${s.bg} border rounded-2xl p-5 text-left hover:shadow-md transition-all group`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{s.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">{s.label}</span>
            </div>
            <span className={`font-hanken text-3xl font-bold ${s.color} group-hover:underline`}>{loading ? '…' : s.value}</span>
          </button>
        ))}
      </div>

      {/* Recent Tasks */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900">Công Việc Gần Đây</h3>
          <button onClick={() => setActiveTab('tasks')} className="text-xs text-blue-600 font-semibold hover:underline">Xem tất cả →</button>
        </div>
        {recentTasks.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Chưa có công việc nào.</p>
        ) : (
          <div className="space-y-3">
            {recentTasks.map(task => {
              const icon = TASK_TYPE_ICONS[task.taskType] || '📋';
              const color = STATUS_COLORS[task.status] || 'bg-slate-100 text-slate-600';
              const statusLabel = { Pending: 'Chờ', InProgress: 'Đang Làm', Completed: 'Hoàn Thành', Overdue: 'Quá Hạn' }[task.status] || task.status;
              return (
                <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-blue-50 transition-colors">
                  <span className="text-xl">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{task.title || '—'}</p>
                    {task.experimentTitle && <p className="text-xs text-slate-400 truncate">{task.experimentTitle}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{statusLabel}</span>
                    {task.dueDate && <span className="text-[10px] text-slate-400">📅 {new Date(task.dueDate).toLocaleDateString('vi-VN')}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'T16 - Công Việc Cá Nhân', desc: 'Xem danh sách công việc được giao', tab: 'tasks', icon: '📋', color: 'from-blue-500 to-blue-600' },
          { label: 'T18 - Hoàn Thành Chăm Sóc', desc: 'Ghi nhận hoàn thành công việc', tab: 'reports', icon: '✅', color: 'from-emerald-500 to-emerald-600' },
          { label: 'T19 - Ghi Nhận Hình Thái', desc: 'Thu thập dữ liệu thực địa', tab: 'morphology', icon: '📊', color: 'from-indigo-500 to-indigo-600' },
        ].map(action => (
          <button key={action.tab} onClick={() => setActiveTab(action.tab)}
            className={`bg-gradient-to-r ${action.color} rounded-2xl p-5 text-white text-left shadow-lg hover:shadow-xl transition-all hover:-translate-y-1`}>
            <div className="text-2xl mb-2">{action.icon}</div>
            <h4 className="font-bold text-sm mb-1">{action.label}</h4>
            <p className="text-white/80 text-xs">{action.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Student Tasks Tab ───────────────────────────────────────────────────────────

const StudentTasksTab = () => {
  const { showToast } = useToast();
  const [taskTab, setTaskTab] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      let data = [];
      switch (taskTab) {
        case 'today': data = await tasksApi.getToday(); break;
        case 'upcoming': data = await tasksApi.getUpcoming(7); break;
        case 'overdue': data = await tasksApi.getOverdue(); break;
        default: data = await tasksApi.getMy(); break;
      }
      setTasks(Array.isArray(data) ? data : []);
    } catch { showToast('Không thể tải tác vụ', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, [taskTab]);

  const handleStart = async (task) => {
    try {
      await tasksApi.start(task.id);
      showToast('Đã bắt đầu thực hiện tác vụ', 'success');
      fetchTasks();
    } catch (err) { showToast(err.message || 'Không thể bắt đầu', 'error'); }
  };

  const openDetail = (task) => {
    setSelectedTask(task);
    setShowDetail(true);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          {TASK_TABS.map(tab => (
            <button key={tab.id} onClick={() => setTaskTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                taskTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {tab.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500 font-semibold">{tasks.length} tác vụ</span>
        </div>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">Đang tải...</div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">Không có công việc nào.</div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const icon = TASK_TYPE_ICONS[task.taskType] || '📋';
            const color = STATUS_COLORS[task.status] || 'bg-slate-100 text-slate-600';
            const statusBg = task.status === 'InProgress' ? 'bg-amber-50 border-l-4 border-l-amber-500' : task.status === 'Completed' ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'bg-white border-l-4 border-l-slate-200';
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed';
            const statusLabel = { Pending: 'Chờ', InProgress: 'Đang Làm', Completed: 'Hoàn Thành', Overdue: 'Quá Hạn' }[task.status] || task.status;

            return (
              <div key={task.id} className={`${statusBg} rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all`}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <button onClick={() => openDetail(task)} className="font-hanken font-bold text-sm text-slate-900 hover:text-blue-600 transition-colors">{task.title || '—'}</button>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{statusLabel}</span>
                      {isOverdue && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">Quá hạn</span>}
                      {task.taskType && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{task.taskType}</span>}
                    </div>
                    {task.description && <p className="text-xs text-slate-500 line-clamp-2 mb-2">{task.description}</p>}
                    <div className="flex items-center gap-4 text-[10px] text-slate-400 flex-wrap">
                      {task.experimentTitle && <span>🧪 {task.experimentTitle}</span>}
                      {task.batchCode && <span>📦 {task.batchCode}</span>}
                      {task.dueDate && <span className={isOverdue ? 'text-rose-500 font-bold' : ''}>📅 {new Date(task.dueDate).toLocaleDateString('vi-VN')}</span>}
                      {task.requiredSkillDescription && <span>🎯 {task.requiredSkillDescription}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openDetail(task)} className="px-3 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all">👁️ Chi tiết</button>
                    {task.status === 'Pending' && (
                      <button onClick={() => handleStart(task)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all">▶ Bắt Đầu</button>
                    )}
                    {task.status === 'InProgress' && (
                      <button onClick={() => openDetail(task)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all">✅ Hoàn Thành</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selectedTask && (
        <StudentTaskDetailModal task={selectedTask} onClose={() => setShowDetail(false)} onUpdated={fetchTasks} />
      )}
    </div>
  );
};

// ── Student Task Detail Modal ──────────────────────────────────────────────────

const StudentTaskDetailModal = ({ task, onClose, onUpdated }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportText, setReportText] = useState('');
  const [resultData, setResultData] = useState([{ key: '', value: '' }]);
  const [reportImages, setReportImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  // Map: reportId → List<TaskImage> fetch từ API GET /task-images/task/{reportId}
  const [reportImagesByReportId, setReportImagesByReportId] = useState({});
  const [imagesLoading, setImagesLoading] = useState(false);
  const [displayedReportText, setDisplayedReportText] = useState('');
  const [displayedResultData, setDisplayedResultData] = useState([{ key: '', value: '' }]);
  // MeasurementDefinitions của experiment hiện tại (cache để map key 'def_<uuid>' → metric info)
  const [definitions, setDefinitions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await taskReportsApi.getByTask(task.id);
        setReports(Array.isArray(data) ? data : []);
      } catch { setReports([]); } finally { setLoading(false); }
    };
    fetchData();
  }, [task.id]);

  /**
   * Load ảnh từ API GET /task-images/task/{reportId} cho từng report.
   * Cache theo reportId để tránh gọi lại khi re-render.
   * Fallback: nếu API fail, dùng images có sẵn trong report (r.images).
   */
  useEffect(() => {
    if (!Array.isArray(reports) || reports.length === 0) {
      setReportImagesByReportId({});
      return;
    }
    const reportsNeedingFetch = reports.filter(r => r.id && !reportImagesByReportId[r.id]);
    if (reportsNeedingFetch.length === 0) return;

    let cancelled = false;
    setImagesLoading(true);
    (async () => {
      const results = await Promise.allSettled(
        reportsNeedingFetch.map(r => taskImagesApi.getByTaskReport(r.id))
      );
      if (cancelled) return;
      setReportImagesByReportId(prev => {
        const next = { ...prev };
        reportsNeedingFetch.forEach((r, i) => {
          const res = results[i];
          if (res.status === 'fulfilled') {
            const list = Array.isArray(res.value) ? res.value : (Array.isArray(res.value?.data) ? res.value.data : []);
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
  }, [reports]);

  /**
   * Load MeasurementDefinitions của experiment để map key 'def_<uuid>' → metric info
   * (metricName, unit, targetValue) trong kết quả báo cáo.
   */
  useEffect(() => {
    const expId = task?.experimentId || task?.experiment?.id;
    if (!expId) {
      setDefinitions([]);
      return;
    }
    let cancelled = false;
    measurementDefinitionsApi.getByExperiment(expId)
      .then(data => {
        if (cancelled) return;
        setDefinitions(Array.isArray(data) ? data : []);
      })
      .catch(() => { if (!cancelled) setDefinitions([]); });
    return () => { cancelled = true; };
  }, [task?.experimentId, task?.experiment?.id]);

  // Map id → definition
  const definitionMap = useMemo(() => {
    const m = new Map();
    for (const d of definitions) m.set(d.id, d);
    return m;
  }, [definitions]);

  // Resolve key 'def_<uuid>' thành label hiển thị (metricName + unit)
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

  // Fetch batch để lấy groupId chính xác (dùng API GET /batches/{batchId})
  const [batchGroupId, setBatchGroupId] = useState(null);
  useEffect(() => {
    const batchId = task?.batchId || task?.batch?.id;
    if (!batchId) { setBatchGroupId(null); return; }
    let cancelled = false;
    batchesApi.getById(batchId)
      .then(b => { if (!cancelled) setBatchGroupId(b?.groupId || null); })
      .catch(() => { if (!cancelled) setBatchGroupId(null); });
    return () => { cancelled = true; };
  }, [task?.batchId, task?.batch?.id]);

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportText.trim()) { showToast('Vui lòng nhập nội dung báo cáo', 'error'); return; }
    // P0-#6: validate nghiệp vụ — chặn submit cho task đã Cancelled/Rejected
    const reportCheck = canSubmitReport(task);
    if (!reportCheck.allowed) { showToast(reportCheck.reason, 'error'); return; }
    try {
      setSaving(true);
      const dataObj = buildReportPayload(resultData);
      const reportRes = await taskReportsApi.create({ taskId: task.id, reportText, resultData: dataObj });
      const reportId = reportRes?.id || reportRes?.data?.id;

      // Bridge: tạo MeasurementRecord (Bulk cho Measurement/Observation Task, Legacy cho các loại khác)
      const usesBulkPath = task?.taskType === 'Measurement' || task?.taskType === 'Observation';
      // Lọc definitions theo nhóm của batch (fetch trực tiếp qua GET /batches/{batchId})
      const effectiveDefinitions = filterDefinitionsByTaskGroup(definitions, task, batchGroupId);
      let mResult;
      if (usesBulkPath) {
        // Truyền definitions để items có metricName/unit/targetValue
        const bulkItems = extractBulkItemsFromResultData(resultData, effectiveDefinitions);
        mResult = await createMeasurementsBulk(task, bulkItems, {
          measuredAt: new Date().toISOString(),
          notes: `Tự động từ TaskReport${reportId ? ` #${reportId}` : ''}`
        }, measurementRecordsApi.bulk);
      } else {
        // Build Map<name, definition> để map key 'plantHeight' → definition tương ứng
        const defByName = new Map(
          effectiveDefinitions.map(d => [d.metricName, d])
        );
        const payloads = buildMeasurementPayloads(
          task,
          extractMeasurementsFromReport(dataObj),
          {
            measuredAt: new Date().toISOString(),
            notes: `Tự động từ TaskReport${reportId ? ` #${reportId}` : ''}`
          },
          defByName
        );
        mResult = await createMeasurementsFromTaskReport(payloads, measurementRecordsApi);
      }

      // Gắn ảnh đính kèm vào TaskReport (multipart với File + đầy đủ metadata)
      let imageOk = 0;
      if (reportImages.length > 0) {
        const imageResults = await Promise.allSettled(
          reportImages.map((img) => {
            if (img.file) {
              return taskImagesApi.upload({
                file: img.file,
                imageUrl: img.url,
                caption: img.caption || '',
                capturedAt: img.uploadedAt || new Date().toISOString(),
                experimentId: task.experimentId || task.experiment?.id,
                batchId: task.batchId || task.batch?.id,
                taskReportId: reportId,
                taskId: task.id
              });
            }
            return taskImagesApi.create({
              taskReportId: reportId,
              taskId: task.id,
              experimentId: task.experimentId || task.experiment?.id,
              batchId: task.batchId || task.batch?.id,
              imageUrl: img.url,
              caption: img.caption || '',
              capturedAt: img.uploadedAt || new Date().toISOString()
            });
          })
        );
        imageOk = imageResults.filter(r => r.status === 'fulfilled' && r.value?.success !== false).length;
        const imageFail = imageResults.length - imageOk;
        if (imageFail > 0) {
          showToast(`⚠️ ${imageFail} ảnh upload thất bại — báo cáo v�n được lưu`, 'warning');
        }
      }

      const toastMsg = [];
      if (usesBulkPath) {
        if (mResult.created > 0) toastMsg.push(`📊 ${mResult.created} chỉ số`);
        if (mResult.skipped > 0) toastMsg.push(`⚠️ ${mResult.skipped} bỏ qua`);
      } else if (mResult.success > 0) {
        toastMsg.push(`📊 ${mResult.success} chỉ số`);
      }
      if (imageOk > 0) toastMsg.push(`📷 ${imageOk} ảnh`);
      showToast(toastMsg.length > 0 ? `Đã gửi báo cáo! ${toastMsg.join(' · ')}` : 'Đã gửi báo cáo!', 'success');

      setReportText('');
      setResultData([{ key: '', value: '' }]);
      setReportImages([]);
      const data = await taskReportsApi.getByTask(task.id);
      setReports(Array.isArray(data) ? data : []);
      if (onUpdated) onUpdated();
      showToast('Đã gửi báo cáo', 'success');
    } catch (err) { showToast(err.message || 'Lỗi gửi báo cáo', 'error'); }
    finally { setSaving(false); }
  };

  // Business rule: phải gửi báo cáo trước, sau đó mới được complete.
  // Cho phép complete nếu: có nội dung báo cáo HOẶC có ảnh mới HOẶC đã có lịch sử báo cáo
  const handleCompleteTask = async () => {
    // P0 fix: bắt buộc có nội dung mới (không chỉ ảnh, không chỉ lịch sử)
    const hasNewContent = reportText.trim().length > 0;
    const minLength = 10;
    if (!hasNewContent) {
      showToast(`Vui lòng nhập nội dung báo cáo (tối thiểu ${minLength} ký tự) trước khi hoàn thành`, 'error');
      setActiveTab('report');
      return;
    }
    if (reportText.trim().length < minLength) {
      showToast(`Nội dung báo cáo quá ngắn — cần tối thiểu ${minLength} ký tự (hiện ${reportText.trim().length})`, 'error');
      return;
    }
    try {
      setCompleting(true);

      // 1. Tạo TaskReport mới nếu có nội dung/ảnh mới
      let reportId;
      let dataObj = {};
      if (hasNewContent) {
        dataObj = buildReportPayload(resultData);
        const reportRes = await taskReportsApi.create({ taskId: task.id, reportText, resultData: dataObj });
        reportId = reportRes?.id || reportRes?.data?.id;
      } else if (hasReportHistory) {
        // Dùng report gần nhất làm anchor cho ảnh mới
        reportId = reports[reports.length - 1]?.id;
      }

      // 2. Bridge: tạo MeasurementRecord (Bulk cho Measurement/Observation Task, Legacy cho các loại khác)
      let mResult = { created: 0, skipped: 0, success: 0 };
      if (hasNewContent && Object.keys(dataObj).length > 0) {
        const usesBulkPath = task?.taskType === 'Measurement' || task?.taskType === 'Observation';
        // Lọc definitions theo nhóm của batch (fetch trực tiếp qua GET /batches/{batchId})
        const effectiveDefinitions = filterDefinitionsByTaskGroup(definitions, task, batchGroupId);
        if (usesBulkPath) {
          const bulkItems = extractBulkItemsFromResultData(resultData, effectiveDefinitions);
          mResult = await createMeasurementsBulk(task, bulkItems, {
            measuredAt: new Date().toISOString(),
            notes: `Tự động từ TaskReport${reportId ? ` #${reportId}` : ''}`
          }, measurementRecordsApi.bulk);
        } else {
          const defByName = new Map(
            effectiveDefinitions.map(d => [d.metricName, d])
          );
          const payloads = buildMeasurementPayloads(
            task,
            extractMeasurementsFromReport(dataObj),
            {
              measuredAt: new Date().toISOString(),
              notes: `Tự động từ TaskReport${reportId ? ` #${reportId}` : ''}`
            },
            defByName
          );
          mResult = await createMeasurementsFromTaskReport(payloads, measurementRecordsApi);
        }
      }

      // 3. Gắn ảnh đính kèm vào TaskReport (multipart với File + đầy đủ metadata)
      if (hasNewImages && reportId) {
        await Promise.allSettled(
          reportImages.map((img) => {
            if (img.file) {
              return taskImagesApi.upload({
                file: img.file,
                imageUrl: img.url,
                caption: img.caption || '',
                capturedAt: img.uploadedAt || new Date().toISOString(),
                experimentId: task.experimentId || task.experiment?.id,
                batchId: task.batchId || task.batch?.id,
                taskReportId: reportId,
                taskId: task.id
              });
            }
            return taskImagesApi.create({
              taskReportId: reportId,
              taskId: task.id,
              experimentId: task.experimentId || task.experiment?.id,
              batchId: task.batchId || task.batch?.id,
              imageUrl: img.url,
              caption: img.caption || '',
              capturedAt: img.uploadedAt || new Date().toISOString()
            });
          })
        );
      }

      // 4. Hoàn thành task
      await tasksApi.complete(task.id);

      const toastMsg = [];
      const usesBulkPath = task?.taskType === 'Measurement' || task?.taskType === 'Observation';
      if (usesBulkPath) {
        if (mResult.created > 0) toastMsg.push(`📊 ${mResult.created} chỉ số`);
        if (mResult.skipped > 0) toastMsg.push(`⚠️ ${mResult.skipped} bỏ qua`);
      } else if (mResult.success > 0) {
        toastMsg.push(`📊 ${mResult.success} chỉ số`);
      }
      if (hasNewImages) toastMsg.push(`📷 ${reportImages.length} ảnh`);
      const modeLabel = hasNewContent ? 'báo cáo mới' : (hasNewImages ? 'bổ sung ảnh' : 'lịch sử');
      showToast(toastMsg.length > 0
        ? `Đã hoàn thành tác vụ (${modeLabel})! ${toastMsg.join(' · ')}`
        : `Đã hoàn thành tác vụ dựa trên ${modeLabel}!`,
        'success');

      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      showToast(err.message || 'Không thể hoàn thành tác vụ', 'error');
    } finally {
      setCompleting(false);
    }
  };

  const updateResult = (idx, field, value) => {
    setResultData(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const statusColors = STATUS_COLORS[task.status] || 'bg-slate-100 text-slate-600';
  const statusLabel = { Pending: 'Chờ', InProgress: 'Đang Làm', Completed: 'Hoàn Thành', Overdue: 'Quá Hạn' }[task.status] || task.status;
  const isCompleted = task.status === 'Completed';
  const isInProgress = task.status === 'InProgress';
  const isPending = task.status === 'Pending';
  const reportCount = reports.length;

  const TABS = [
    { id: 'overview', label: 'Tổng Quan', icon: '📋' },
    { id: 'report', label: 'Báo Cáo', icon: '📝', badge: !isCompleted ? null : null },
    { id: 'images', label: 'Hình Ảnh', icon: '📷' },
    { id: 'history', label: 'Lịch Sử', icon: '📜', badge: reportCount > 0 ? reportCount : null },
  ];

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-indigo-50 shrink-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-2xl shrink-0 shadow-lg shadow-blue-600/20">
                {TASK_TYPE_ICONS[task.taskType] || '📋'}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-lg text-slate-900 truncate">{task.title || '—'}</h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">🧪 {task.experimentTitle || '—'} {task.batchCode && `· 📦 ${task.batchCode}`}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${statusColors}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
              {statusLabel}
            </span>
            {task.dueDate && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-700">
                📅 {new Date(task.dueDate).toLocaleDateString('vi-VN')}
              </span>
            )}
            {task.experimentStageName && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-700">
                🎯 {task.experimentStageName}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-slate-50/40 px-6 shrink-0">
          <div className="flex items-center gap-1 -mb-px">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-3 text-sm font-bold transition-all flex items-center gap-2 border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Loại', value: task.taskType || '—', icon: '🏷️' },
                  { label: 'Hạn chót', value: task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : '—', icon: '📅' },
                  { label: 'Thí nghiệm', value: task.experimentTitle || '—', icon: '🧪' },
                  { label: 'Batch', value: task.batchCode || '—', icon: '📦' },
                  { label: 'Giai đoạn', value: task.experimentStageName || '—', icon: '🎯' },
                  { label: 'Người giao', value: task.createdByName || '—', icon: '👤' },
                  { label: 'Lịch chăm sóc', value: task.careScheduleTitle || '—', icon: '📅' },
                  { label: 'Yêu cầu kỹ năng', value: task.requiredSkillDescription || '—', icon: '⚙️' },
                ].map(item => (
                  <div key={item.label} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
                      <span>{item.icon}</span>{item.label}
                    </p>
                    <p className="font-semibold text-slate-900 text-sm mt-1 truncate">{item.value}</p>
                  </div>
                ))}
              </div>

              {task.description && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-[10px] text-blue-600 font-bold uppercase mb-1.5 flex items-center gap-1.5">📝 Mô tả</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{task.description}</p>
                </div>
              )}

              {/* Skill Requirements */}
              {Array.isArray(task.skillRequirements) && task.skillRequirements.length > 0 && (
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] text-indigo-600 font-bold uppercase flex items-center gap-1.5">⚙️ Yêu Cầu Kỹ Năng</p>
                    <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                      {task.skillRequirements.length} kỹ năng
                    </span>
                  </div>
                  <div className="space-y-2">
                    {task.skillRequirements.map((sk, idx) => (
                      <div key={sk.skillId || idx} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-indigo-100">
                        <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-900 truncate">{sk.skillName || `Skill ${sk.skillId?.slice(0, 8) || idx}`}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{sk.skillId}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Level</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(level => (
                              <span key={level}
                                className={`w-2 h-4 rounded-sm ${level <= (sk.requiredLevel || 0) ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                            ))}
                          </div>
                          <span className="ml-1 text-xs font-bold text-indigo-600 w-4 text-center">{sk.requiredLevel || 0}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'report' && (
            <div className="space-y-4">
              {!isCompleted && (
                <div className={`p-3 rounded-xl border text-sm font-semibold flex items-start gap-2 ${
                  isInProgress ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                  <span className="text-lg shrink-0">{isInProgress ? '⚠️' : 'ℹ️'}</span>
                  <div>
                    <p className="font-bold">{isInProgress ? 'Báo cáo là bắt buộc để hoàn thành' : 'Gửi báo cáo cho tác vụ'}</p>
                    <p className="text-xs mt-0.5 opacity-80">
                      {isInProgress ? 'Nhập nội dung tối thiểu 10 ký tự rồi bấm "Hoàn Thành & Gửi Báo Cáo" — task sẽ tự động chuyển sang Hoàn Thành.' : 'Có thể gửi báo cáo bất kỳ lúc nào, tác vụ vẫn ở trạng thái Chờ.'}
                    </p>
                  </div>
                </div>
              )}
              {/* Truyền hideSubmitInternal=true để TaskReportForm KHÔNG render nút submit — nút sẽ được đặt dưới đây */}
              <TaskReportForm
                task={task}
                reportText={reportText}
                setReportText={setReportText}
                resultData={resultData}
                setResultData={setResultData}
                images={reportImages}
                setImages={setReportImages}
                saving={saving || completing}
                disabled={isCompleted}
                hideSubmit={true}
                onSubmit={handleSubmitReport}
                color="blue"
                submitLabel="Gửi Báo Cáo"
              />

              {/* Footer-action đặt trong form — giống UX Student popup */}
              {!isCompleted && (
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3 sticky bottom-0 bg-white -mx-6 px-6 pb-2">
                  {isInProgress ? (() => {
                    const reportLength = reportText.trim().length;
                    const minLength = 10;
                    const hasContent = reportLength >= minLength;
                    const hint = reportLength === 0
                      ? 'Nhập nội dung báo cáo (≥10 ký tự) rồi bấm Hoàn Thành'
                      : !hasContent
                        ? `Còn thiếu ${minLength - reportLength} ký tự — bấm Hoàn Thành để gửi và đóng task`
                        : 'Sẵn sàng — bấm Hoàn Thành để gửi báo cáo và chuyển task sang Hoàn Thành';
                    return (
                      <>
                        <div className="text-xs text-slate-600 min-w-0">
                          <p className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              hasContent ? 'bg-emerald-500' : 'bg-amber-500'
                            }`} />
                            {hasContent ? 'Sẵn sàng hoàn thành' : 'Cần nhập nội dung'}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 truncate">{hint}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button type="button" onClick={onClose}
                            className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                            Đóng
                          </button>
                          <button type="button" onClick={handleCompleteTask} disabled={completing || !hasContent}
                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2">
                            <span>✅</span>
                            {completing ? 'Đang hoàn thành...' : 'Hoàn Thành & Gửi Báo Cáo'}
                          </button>
                        </div>
                      </>
                    );
                  })() : (
                    // Task ở trạng thái Pending — vẫn cho gửi báo cáo nhưng KHÔNG complete
                    <>
                      <div className="text-xs text-slate-600">
                        <p className="font-bold text-slate-800">Gửi báo cáo (chưa hoàn thành)</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Task vẫn ở trạng thái Chờ cho đến khi bấm Bắt Đầu</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button type="button" onClick={onClose}
                          className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">
                          Đóng
                        </button>
                        <button type="button" onClick={handleSubmitReport} disabled={saving || !reportText.trim()}
                          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2">
                          <span>📨</span>
                          {saving ? 'Đang gửi...' : 'Gửi Báo Cáo'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Trạng thái Completed — chỉ có nút Đóng */}
              {isCompleted && (
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-600">
                    <p className="font-bold text-slate-800">Tác vụ đã hoàn thành</p>
                    <p className="text-[10px] text-slate-500">Báo cáo đã được lưu — bạn có thể xem lại trong tab Lịch Sử</p>
                  </div>
                  <button type="button" onClick={onClose}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition-colors">
                    Đóng
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-4">
              {/* Upload section - cho phép upload ảnh mới */}
              {!isCompleted && (
                <ImageUploader
                  value={reportImages}
                  onChange={setReportImages}
                  experimentId={task?.experimentId}
                  batchId={task?.batchId}
                  taskId={task?.id}
                  disabled={saving}
                />
              )}

              {/* Reports images gallery - lấy ảnh từ API /task-images/task/{reportId} */}
              <div>
                <p className="text-xs font-bold text-slate-700 mb-3 flex items-center justify-between">
                  <span>📷 Thư Viện Ảnh Minh Chứng</span>
                  <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                    {imagesLoading && <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
                    {Object.values(reportImagesByReportId).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0)} ảnh
                  </span>
                </p>
                {(() => {
                  const allImages = Object.entries(reportImagesByReportId).flatMap(([reportId, imgs]) =>
                    (Array.isArray(imgs) ? imgs : []).map((img, i) => ({ ...img, _reportId: reportId, _key: `${reportId}-${img.id || i}` }))
                  );
                  if (allImages.length === 0 && !imagesLoading) {
                    return (
                      <div className="text-center text-sm text-slate-400 py-12 border-2 border-dashed border-slate-200 rounded-xl">
                        <div className="text-4xl mb-2">🖼️</div>
                        <p>Chưa có ảnh minh chứng nào</p>
                      </div>
                    );
                  }
                  if (allImages.length === 0 && imagesLoading) {
                    return (
                      <div className="text-center text-sm text-slate-400 py-12 border-2 border-dashed border-slate-200 rounded-xl">
                        <div className="text-3xl mb-2 animate-pulse">⏳</div>
                        <p>Đang tải ảnh từ server...</p>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {allImages.map((img) => (
                        <a key={img._key} href={img.imageUrl || img.url} target="_blank" rel="noopener noreferrer"
                          className="aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group relative">
                          <img src={img.imageUrl || img.url} alt={img.caption || 'img'}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          {img.caption && (
                            <span className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-black/60 text-white text-[9px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
                              {img.caption}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {loading ? (
                <div className="text-center text-sm text-slate-400 py-12">Đang tải...</div>
              ) : reports.length === 0 ? (
                <div className="text-center text-sm text-slate-400 py-12 border-2 border-dashed border-slate-200 rounded-xl">
                  <div className="text-4xl mb-2">📭</div>
                  <p>Chưa có báo cáo nào</p>
                </div>
              ) : (
                <div className="relative pl-6">
                  <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-slate-200" />
                  {reports.map((r, idx) => {
                    const resultEntries = r.resultData && typeof r.resultData === 'object' ? Object.entries(r.resultData) : [];
                    // Ưu tiên ảnh fetch từ API /task-images/task/{reportId}, fallback về r.images
                    const imageList = reportImagesByReportId[r.id] || (Array.isArray(r.images) ? r.images : []);
                    const dateText = r.reportedAt || r.createdAt;
                    const reporterName = r.reporterName || r.reportedByName || 'Bạn';
                    return (
                      <div key={r.id} className="relative pb-5 last:pb-0">
                        <div className="absolute -left-[14px] top-1 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow" />
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                                {reporterName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-xs text-slate-900 truncate">{reporterName}</p>
                                <p className="text-[10px] text-slate-500">Báo cáo #{reports.length - idx}</p>
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                              {dateText ? new Date(dateText).toLocaleString('vi-VN') : '—'}
                            </span>
                          </div>
                          {r.reportText && (
                            <p className="text-xs text-slate-700 whitespace-pre-line">{r.reportText}</p>
                          )}
                          {resultEntries.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {resultEntries.map(([k, v]) => (
                                <span key={k} className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 rounded-full text-[10px] font-semibold">
                                  {resolveMetricLabel(k)}: <span className="text-slate-900 font-bold">{String(v)}</span>
                                </span>
                              ))}
                            </div>
                          )}
                          {imageList.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {imageList.map((img, i) => (
                                <a key={img.id || i} href={img.imageUrl || img.url} target="_blank" rel="noopener noreferrer"
                                  className="block w-12 h-12 rounded-md overflow-hidden border border-blue-200 hover:opacity-80 relative group"
                                  title={img.caption || ''}>
                                  <img src={img.imageUrl || img.url} alt={img.caption || `img-${i}`} className="w-full h-full object-cover" />
                                  {img.caption && (
                                    <span className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/70 text-white text-[8px] truncate opacity-0 group-hover:opacity-100">
                                      {img.caption}
                                    </span>
                                  )}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - STICKY với action phù hợp theo tab và status.
            Yêu cầu nghiệp vụ (đồ án): bắt buộc nhập nội dung báo cáo mới cho bấm Hoàn Thành.
            Lý do: Báo cáo rỗng = tác vụ hoàn thành "ảo", không audit được.
            Ảnh chỉ là đính kèm minh chứng — không thay thế được text.
            Lịch sử báo cáo cũng không đủ: cần có số liệu MỚI cho lần complete này. */}
        {/* Footer cố định — chỉ hiện khi KHÔNG ở tab "report"
            (tab "report" đã có sẵn 2 nút Đóng + Hoàn Thành & Gửi Báo Cáo bên trong form,
            tránh trùng lặp UX). Khi ở tab "report" thì đóng bằng nút X trên header. */}
        {activeTab !== 'report' && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                {isInProgress && (
                  <>
                    <p className="font-bold text-slate-800 text-sm">Đang thực hiện</p>
                    <p className="text-[10px] text-slate-500">Chuyển sang tab "Báo Cáo" để gửi báo cáo và hoàn thành</p>
                  </>
                )}
                {isPending && (
                  <>
                    <p className="font-bold text-slate-800 text-sm">Tác vụ đang chờ</p>
                    <p className="text-[10px] text-slate-500">Bấm "Bắt Đầu" ở danh sách để tiến hành</p>
                  </>
                )}
                {isCompleted && (
                  <>
                    <p className="font-bold text-slate-800 text-sm">Tác vụ đã hoàn thành</p>
                    <p className="text-[10px] text-slate-500">Báo cáo đã được lưu vào hệ thống</p>
                  </>
                )}
              </div>
              <button onClick={onClose}
                className="px-5 py-2 border border-slate-300 rounded-xl text-sm font-semibold hover:bg-white transition-colors">
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </Portal>
  );
};

// ── Student Morphology / Growth Records Section ────────────────────────────────

const StudentMorphologySection = ({ setActiveTab }) => {
  const { showToast } = useToast();
  const [records, setRecords] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [filterBatchId, setFilterBatchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEntryModal, setShowEntryModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const myTasks = await tasksApi.getMy().catch(() => []);
        const taskList = Array.isArray(myTasks) ? myTasks : [];
        setTasks(taskList);

        const seen = new Set();
        const batchIds = [];
        for (const t of taskList) {
          if (t.batchId && !seen.has(t.batchId)) {
            seen.add(t.batchId);
            batchIds.push({ id: t.batchId, code: t.batchCode || t.batchId.slice(0, 8) });
          }
        }

        if (batchIds.length === 0) { setRecords([]); return; }

        const perBatch = await Promise.all(
          batchIds.map(b =>
            measurementRecordsApi.getByBatch(b.id)
              .then(list => Array.isArray(list) ? list : [])
              .catch(() => [])
              .then(list => list.map(r => ({ ...r, batchCode: r.batchCode || b.code })))
          )
        );

        const merged = perBatch
          .flat()
          .sort((a, b) => new Date(b.measuredAt || 0) - new Date(a.measuredAt || 0));
        setRecords(merged);
        if (batchIds.length > 0 && !selectedBatch) setSelectedBatch(batchIds[0].id);
      } catch {
        showToast('Không thể tải dữ liệu tăng trưởng', 'error');
        setRecords([]);
      } finally { setLoading(false); }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const batchOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    for (const t of tasks) {
      if (t.batchId && !seen.has(t.batchId)) {
        seen.add(t.batchId);
        opts.push({ id: t.batchId, label: t.batchCode || t.batchId.slice(0, 8) });
      }
    }
    return opts;
  }, [tasks]);

  const fetchRecords = async (bId) => {
    if (!bId) return;
    try {
      setLoading(true);
      const data = await measurementRecordsApi.getByBatch(bId);
      const list = Array.isArray(data) ? data : [];
      setRecords(prev => {
        const others = prev.filter(r => r.batchId !== bId);
        return [...others, ...list];
      });
    } catch { showToast('Không thể tải dữ liệu', 'error'); }
    finally { setLoading(false); }
  };

  const handleFilter = () => {
    if (filterBatchId.trim()) fetchRecords(filterBatchId.trim());
  };

  const handleOpenFullEntry = () => {
    setShowEntryModal(true);
  };

  const handleEntrySaved = async () => {
    setShowEntryModal(false);
    try {
      setLoading(true);
      const myTasks = await tasksApi.getMy().catch(() => []);
      const taskList = Array.isArray(myTasks) ? myTasks : [];
      setTasks(taskList);
      const seen = new Set();
      const batchIds = [];
      for (const t of taskList) {
        if (t.batchId && !seen.has(t.batchId)) {
          seen.add(t.batchId);
          batchIds.push({ id: t.batchId, code: t.batchCode || t.batchId.slice(0, 8) });
        }
      }
      const perBatch = await Promise.all(
        batchIds.map(b =>
          measurementRecordsApi.getByBatch(b.id)
            .then(list => Array.isArray(list) ? list : [])
            .catch(() => [])
            .then(list => list.map(r => ({ ...r, batchCode: r.batchCode || b.code })))
        )
      );
      const merged = perBatch
        .flat()
        .sort((a, b) => new Date(b.measuredAt || 0) - new Date(a.measuredAt || 0));
      setRecords(merged);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const visibleRecords = useMemo(
    () => selectedBatch
      ? records.filter(r => r.batchId === selectedBatch || r.batchCode === selectedBatch)
      : records,
    [records, selectedBatch]
  );

  const stats = useMemo(() => {
    const total = visibleRecords.length;
    const today = visibleRecords.filter(r => {
      const d = r.measuredAt ? new Date(r.measuredAt) : null;
      if (!d) return false;
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    const batches = new Set(visibleRecords.map(r => r.batchId || r.batchCode)).size;
    return { total, today, batches };
  }, [visibleRecords]);

  return (
    <div className="animate-fade-in space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex justify-between items-start gap-3">
          <div>
            <h3 className="text-xl font-bold mb-2">Ghi Nhận Tăng Trưởng</h3>
            <p className="text-indigo-100 text-sm">Thu thập các chỉ số sinh học định tính của cây trồng mà cảm biến IoT không thể đo được.</p>
          </div>
          <div className="text-4xl">📊</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tổng bản ghi</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hôm nay</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.today}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Số batch</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{stats.batches}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Lọc theo tác vụ (Batch)</label>
            <select
              value={selectedBatch}
              onChange={e => setSelectedBatch(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">— Tất cả batch —</option>
              {batchOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tìm bằng Batch ID</label>
            <div className="flex gap-2">
              <input type="text" value={filterBatchId} onChange={e => setFilterBatchId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFilter()}
                placeholder="Nhập Batch ID..."
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
              <button onClick={handleFilter}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20">
                Tìm
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {visibleRecords.length} bản ghi {selectedBatch ? '(đã lọc)' : '(tất cả batch của bạn)'}
          </p>
          <button onClick={handleOpenFullEntry}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all">
            ➕ Ghi Nhận Mới
          </button>
        </div>
      </div>

      {/* Modal Ghi Nhận */}
      {showEntryModal && (
        <MorphologyEntryModal
          onClose={() => setShowEntryModal(false)}
          onSaved={handleEntrySaved}
        />
      )}

      {/* Records table */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400">Đang tải...</div>
      ) : visibleRecords.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
          {selectedBatch || filterBatchId
            ? 'Không có dữ liệu cho Batch này.'
            : 'Chưa có bản ghi tăng trưởng nào.'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-indigo-50 border-b border-indigo-200">
                <tr>
                  {['Ngày đo', 'Batch', 'Chỉ số', 'Giá trị', 'Đơn vị', 'Giá trị mục tiêu', 'Người đo', 'Ghi chú'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {r.measuredAt ? new Date(r.measuredAt).toLocaleString('vi-VN') : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{r.batchCode || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 text-xs">{r.metricName || '—'}</td>
                    <td className="px-4 py-3 font-bold text-indigo-700 text-xs">
                      {r.value !== null && r.value !== undefined ? r.value : (r.textValue || '—')}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.unit || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.targetValue || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.measuredByName || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-[150px] truncate">
                      {r.extraData ? JSON.stringify(r.extraData) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Morphology Entry Modal (in-dashboard, no route change) ────────────────────

const MorphologyEntryModal = ({ onClose, onSaved }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    experimentId: '',
    experimentStageId: '',
    batchId: '',
    measurementDefinitionId: '',
    value: '',
    textValue: '',
    measuredAt: new Date().toISOString().split('T')[0]
  });
  const [extraData, setExtraData] = useState([
    { key: 'plantNumber', value: '' },
    { key: 'location', value: '' },
    { key: 'leafColor', value: 'Medium green' },
    { key: 'stemCondition', value: 'Healthy' },
    { key: 'pestSymptoms', value: 'None' },
    { key: 'diseaseSymptoms', value: 'None' }
  ]);
  const [experiments, setExperiments] = useState([]);
  const [stages, setStages] = useState([]);
  const [batches, setBatches] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingInit(true);
        const data = await experimentsApi.getAll().catch(() => []);
        setExperiments(Array.isArray(data) ? data : []);
      } catch { setExperiments([]); } finally { setLoadingInit(false); }
    };
    load();
  }, []);

  useEffect(() => {
    const loadStages = async () => {
      if (!form.experimentId) { setStages([]); return; }
      try {
        const data = await experimentsApi.getStages(form.experimentId).catch(() => []);
        setStages(Array.isArray(data) ? data : []);
      } catch { setStages([]); }
    };
    loadStages();
  }, [form.experimentId]);

  useEffect(() => {
    const loadBatches = async () => {
      if (!form.experimentId) { setBatches([]); return; }
      try {
        const data = batchesApi.getByExperiment ? await batchesApi.getByExperiment(form.experimentId) : [];
        setBatches(Array.isArray(data) ? data : []);
      } catch { setBatches([]); }
    };
    loadBatches();
  }, [form.experimentId]);

  useEffect(() => {
    const loadDefs = async () => {
      if (!form.experimentId) { setDefinitions([]); return; }
      try {
        const data = await experimentsApi.getMeasurements(form.experimentId).catch(() => []);
        setDefinitions(Array.isArray(data) ? data : []);
      } catch { setDefinitions([]); }
    };
    loadDefs();
  }, [form.experimentId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };
  const updateExtra = (idx, field, val) => {
    setExtraData(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };
  const addExtra = () => setExtraData(prev => [...prev, { key: '', value: '' }]);
  const removeExtra = (idx) => setExtraData(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Xác định min/max từ measurementDefinition đã chọn
    const def = definitions.find(d => d.id === form.measurementDefinitionId);
    const defMin = def?.minValue !== undefined ? Number(def.minValue) : null;
    const defMax = def?.maxValue !== undefined ? Number(def.maxValue) : null;

    const valueValidators = [];
    if (form.value !== '' && form.value !== null && form.value !== undefined) {
      valueValidators.push(nonNegativeNumber('Giá trị đo phải ≥ 0'));
      if (defMin !== null) valueValidators.push(minValue(defMin, `Giá trị tối thiểu ${defMin}`));
      if (defMax !== null) valueValidators.push(maxValue(defMax, `Giá trị tối đa ${defMax}`));
    }

    const schema = {
      experimentId: required('Vui lòng chọn thí nghiệm'),
      batchId: required('Vui lòng chọn batch'),
      measuredAt: pastOrTodayDate('Ngày đo không được ở tương lai'),
      value: compose(...valueValidators)
    };

    // Validate value/textValue chỉ khi definition yêu cầu
    const wantsNumeric = def?.dataType === 'Number' || def?.dataType === 'Decimal' || def?.dataType === 'Integer';
    const wantsText = def?.dataType === 'Text' || def?.dataType === 'String';
    if (wantsNumeric && (form.value === '' || form.value === null || form.value === undefined)) {
      schema.value = (v) => v === '' || v === null || v === undefined ? 'Vui lòng nhập giá trị số' : null;
    }
    if (wantsText && !form.textValue.trim()) {
      schema.textValue = required('Vui lòng nhập giá trị văn bản');
    }
    if (!wantsNumeric && !wantsText && !form.value && !form.textValue) {
      schema.value = () => 'Vui lòng nhập giá trị đo';
    }

    const errs = validateForm(form, schema);
    if (!isValid(errs)) {
      setErrors(errs);
      const firstKey = Object.keys(errs)[0];
      showToast(errs[firstKey], 'error');
      return;
    }
    setErrors({});

    try {
      setSaving(true);
      const extraObj = {};
      extraData.forEach(r => { if (r.key.trim()) extraObj[r.key.trim()] = r.value; });
      await measurementRecordsApi.create({
        experimentId: form.experimentId,
        experimentStageId: form.experimentStageId || undefined,
        batchId: form.batchId,
        measurementDefinitionId: form.measurementDefinitionId || undefined,
        value: form.value !== '' && form.value !== null && form.value !== undefined ? parseFloat(form.value) : undefined,
        textValue: form.textValue || undefined,
        extraData: Object.keys(extraObj).length > 0 ? extraObj : undefined,
        measuredAt: form.measuredAt ? new Date(form.measuredAt).toISOString() : new Date().toISOString()
      });
      showToast('Đã ghi nhận đo lường!', 'success');
      onSaved();
    } catch (err) {
      showToast(err.message || 'Không thể ghi nhận', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center z-10 rounded-t-2xl">
          <div>
            <h3 className="font-bold text-lg text-slate-900">📊 Ghi Nhận Tăng Trưởng</h3>
            <p className="text-xs text-slate-400">Form đầy đủ cho T19</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {loadingInit ? (
          <div className="p-12 text-center text-slate-400">Đang tải...</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Thí nghiệm <span className="text-rose-500">*</span></label>
                <select name="experimentId" value={form.experimentId} onChange={handleChange}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white ${errors.experimentId ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-indigo-500'}`}>
                  <option value="">— Chọn thí nghiệm —</option>
                  {experiments.map(e => (
                    <option key={e.id} value={e.id}>{e.title || e.name || e.id.slice(0, 8)}</option>
                  ))}
                </select>
                {errors.experimentId && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.experimentId}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Giai đoạn</label>
                <select name="experimentStageId" value={form.experimentStageId} onChange={handleChange} disabled={!form.experimentId}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50">
                  <option value="">— Chọn giai đoạn —</option>
                  {stages.map(s => (
                    <option key={s.id} value={s.id}>{s.name || s.stageName || s.id.slice(0, 8)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Batch <span className="text-rose-500">*</span></label>
                <select name="batchId" value={form.batchId} onChange={handleChange} disabled={!form.experimentId}
                  className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white disabled:bg-slate-50 ${errors.batchId ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-indigo-500'}`}>
                  <option value="">— Chọn batch —</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.code || b.batchCode || b.id.slice(0, 8)}</option>
                  ))}
                </select>
                {errors.batchId && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.batchId}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chỉ số đo</label>
                <select name="measurementDefinitionId" value={form.measurementDefinitionId} onChange={handleChange} disabled={!form.experimentId}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50">
                  <option value="">— Tùy chỉnh —</option>
                  {definitions.map(d => (
                    <option key={d.id} value={d.id}>{d.name || d.metricName || d.id.slice(0, 8)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <div>
                <label className="block text-xs font-bold text-indigo-700 mb-1">Giá trị số</label>
                <input type="number" step="0.01" min="0" name="value" value={form.value} onChange={handleChange}
                  placeholder="VD: 12.5"
                  className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white ${errors.value ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-indigo-500'}`} />
                {errors.value && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.value}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-indigo-700 mb-1">Giá trị chữ</label>
                <input type="text" name="textValue" value={form.textValue} onChange={handleChange}
                  placeholder="Hoặc nhập mô tả..."
                  className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white ${errors.textValue ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-indigo-500'}`} />
                {errors.textValue && <p className="text-[10px] text-rose-600 mt-1 font-semibold">{errors.textValue}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày đo</label>
              <input type="date" name="measuredAt" value={form.measuredAt} onChange={handleChange}
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 bg-white ${errors.measuredAt ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-indigo-500'}`} />
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-700 uppercase">Dữ liệu bổ sung (hình thái)</p>
                <button type="button" onClick={addExtra}
                  className="text-xs text-indigo-600 font-bold hover:underline">+ Thêm</button>
              </div>
              <div className="space-y-2">
                {extraData.map((r, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input type="text" value={r.key} placeholder="Key (VD: leafColor)"
                      onChange={e => updateExtra(idx, 'key', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                    <input type="text" value={r.value} placeholder="Giá trị"
                      onChange={e => updateExtra(idx, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                    <button type="button" onClick={() => removeExtra(idx)}
                      className="px-2 text-rose-500 hover:bg-rose-50 rounded-lg font-bold">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={onClose}
                className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50">
                Hủy
              </button>
              <button type="submit" disabled={saving}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all">
                {saving ? '⏳ Đang lưu...' : '💾 Lưu Ghi Nhận'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
    </Portal>
  );
};

// ── Student Reports Tab ────────────────────────────────────────────────────────

const StudentReportsTab = () => {
  const { showToast } = useToast();
  const [reports, setReports] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState('');
  const [loading, setLoading] = useState(true);
  // reportId → List<TaskImage> fetch từ API /task-images/task/{reportId}
  const [reportImagesByReportId, setReportImagesByReportId] = useState({});
  const [imagesLoading, setImagesLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const myTasks = await tasksApi.getMy().catch(() => []);
        const taskList = Array.isArray(myTasks) ? myTasks : [];
        setTasks(taskList);

        const perTask = await Promise.all(
          taskList.map(t =>
            taskReportsApi.getByTask(t.id)
              .then(rep => Array.isArray(rep) ? rep : [])
              .catch(() => [])
              .then(list => list.map(r => ({
                ...r,
                taskId: t.id,
                taskTitle: t.title,
                experimentTitle: t.experimentTitle,
                batchCode: t.batchCode,
                stageName: t.experimentStageName,
                taskType: t.taskType
              })))
          )
        );

        const merged = perTask
          .flat()
          .sort((a, b) => new Date(b.reportedAt || b.createdAt || 0) - new Date(a.reportedAt || a.createdAt || 0));
        setReports(merged);
      } catch {
        showToast('Không thể tải báo cáo', 'error');
        setReports([]);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  /**
   * Load ảnh từ API GET /task-images/task/{reportId} cho các report có id.
   * Cached theo reportId, fallback về r.images nếu API fail.
   */
  useEffect(() => {
    const valid = reports.filter(r => r.id);
    if (valid.length === 0) {
      setReportImagesByReportId({});
      return;
    }
    const need = valid.filter(r => !reportImagesByReportId[r.id]);
    if (need.length === 0) return;

    let cancelled = false;
    setImagesLoading(true);
    (async () => {
      const results = await Promise.allSettled(
        need.map(r => taskImagesApi.getByTaskReport(r.id))
      );
      if (cancelled) return;
      setReportImagesByReportId(prev => {
        const next = { ...prev };
        need.forEach((r, i) => {
          const res = results[i];
          if (res.status === 'fulfilled') {
            const list = Array.isArray(res.value) ? res.value : (Array.isArray(res.value?.data) ? res.value.data : []);
            next[r.id] = list;
          } else {
            next[r.id] = Array.isArray(r.images) ? r.images : [];
          }
        });
        return next;
      });
      setImagesLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  const taskOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    for (const t of tasks) {
      if (!t?.id || seen.has(t.id)) continue;
      seen.add(t.id);
      opts.push({ id: t.id, label: t.title || t.experimentTitle || t.id.slice(0, 8) });
    }
    return opts;
  }, [tasks]);

  const visibleReports = useMemo(
    () => selectedTask ? reports.filter(r => r.taskId === selectedTask) : reports,
    [reports, selectedTask]
  );

  // Map taskId → experimentId
  const taskExpMap = useMemo(() => {
    const m = new Map();
    for (const t of tasks) if (t.id && t.experimentId) m.set(t.id, t.experimentId);
    return m;
  }, [tasks]);

  // Lấy unique experimentIds cần resolve
  const neededExpIds = useMemo(() => {
    const set = new Set();
    for (const r of visibleReports) {
      const expId = taskExpMap.get(r.taskId);
      if (expId) set.add(expId);
    }
    return Array.from(set);
  }, [visibleReports, taskExpMap]);

  // Cache definitions theo experimentId: Map<experimentId, Map<defId, definition>>
  const [defsByExp, setDefsByExp] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const expId of neededExpIds) {
        if (defsByExp[expId]) continue;
        try {
          const data = await measurementDefinitionsApi.getByExperiment(expId);
          if (cancelled) return;
          const list = Array.isArray(data) ? data : [];
          setDefsByExp(prev => ({ ...prev, [expId]: list }));
        } catch {
          if (!cancelled) setDefsByExp(prev => ({ ...prev, [expId]: [] }));
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neededExpIds.join('|')]);

  const resolveMetricLabel = (key, taskId) => {
    if (typeof key !== 'string') return String(key);
    if (key.startsWith('def_')) {
      const defId = key.slice(4);
      const expId = taskExpMap.get(taskId);
      const defs = expId ? defsByExp[expId] || [] : [];
      const def = defs.find(d => d.id === defId);
      if (def?.metricName) {
        return def.unit ? `${def.metricName} (${def.unit})` : def.metricName;
      }
      return `Chỉ số #${defId.slice(0, 8)}`;
    }
    return key;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">
            {visibleReports.length} báo cáo {selectedTask ? 'đã lọc' : 'đã gửi'}
          </p>
          <select
            value={selectedTask}
            onChange={e => setSelectedTask(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">— Tất cả tác vụ —</option>
            {taskOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400">Đang tải...</div>
      ) : visibleReports.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">Chưa có báo cáo nào.</div>
      ) : (
        visibleReports.map(r => {
          const resultEntries = r.resultData && typeof r.resultData === 'object'
            ? Object.entries(r.resultData)
            : [];
          const imageList = reportImagesByReportId[r.id] || (Array.isArray(r.images) ? r.images : []);
          const dateText = r.reportedAt || r.createdAt;
          const reporterName = r.reporterName || r.reportedByName || 'Bạn';
          return (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start mb-3 gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.taskTitle && <p className="text-sm font-bold text-slate-900">{r.taskTitle}</p>}
                    {r.taskType && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">
                        {r.taskType}
                      </span>
                    )}
                  </div>
                  {(r.experimentTitle || r.batchCode || r.stageName) && (
                    <p className="text-xs text-slate-500 mt-1">
                      {[r.experimentTitle, r.batchCode && `Batch ${r.batchCode}`, r.stageName].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">
                      {reporterName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[10px] text-slate-500">{reporterName}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  {dateText ? new Date(dateText).toLocaleString('vi-VN') : '—'}
                </span>
              </div>

              {r.reportText && <p className="text-sm text-slate-700 whitespace-pre-line">{r.reportText}</p>}

              {resultEntries.length > 0 && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">Dữ Liệu</p>
                  <div className="grid grid-cols-2 gap-2">
                    {resultEntries.map(([k, v]) => (
                      <div key={k} className="text-xs">
                        <p className="text-[10px] text-slate-400 font-semibold break-all">{resolveMetricLabel(k, r.taskId)}</p>
                        <p className="font-semibold text-slate-900 break-all">{String(v)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {imageList.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {imageList.map((img, i) => (
                    <a key={img.id || i} href={img.imageUrl || img.url} target="_blank" rel="noopener noreferrer"
                      className="block w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 relative group"
                      title={img.caption || ''}>
                      <img src={img.imageUrl || img.url} alt={img.caption || `img-${i}`} className="w-full h-full object-cover" />
                      {img.caption && (
                        <span className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/70 text-white text-[9px] truncate opacity-0 group-hover:opacity-100">
                          {img.caption}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              )}
              {imagesLoading && imageList.length === 0 && (
                <p className="text-[10px] text-slate-400 italic mt-2">⏳ Đang tải ảnh từ server...</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};

// ── Student Farms Tab ─────────────────────────────────────────────────────────
// (Removed per user request - no longer used in dashboard)

export default StudentDashboard;
