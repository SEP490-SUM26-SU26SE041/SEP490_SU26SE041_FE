import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../context/ToastContext';
import { authLogoutSync } from '../../utils/authLogout';
import { tasksApi, taskReportsApi, taskImagesApi, measurementRecordsApi } from '../../api/sharedTaskApi';
import { measurementDefinitionsApi, batchesApi } from '../../api/experimentApi';
import TaskReportForm, { buildReportPayload } from '../../components/tasks/TaskReportForm';
import ImageUploader from '../../components/tasks/ImageUploader';
import BulkMeasurementForm from '../../components/technician/BulkMeasurementForm';
import NotificationBell from '../../components/notifications/NotificationBell';
import {
  extractMeasurementsFromReport, buildMeasurementPayloads, createMeasurementsFromTaskReport,
  extractBulkItemsFromResultData, createMeasurementsBulk, filterDefinitionsByTaskGroup
} from '../../utils/measurementBridge';

// ── Portal helper ─────────────────────────────────────────────────────────────

const Portal = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

const TECH_TABS = [
  { id: 'overview', label: 'Tổng Quan', icon: '🏠' },
  { id: 'tasks', label: 'Công Việc', icon: '📋' },
  { id: 'reports', label: 'Báo Cáo', icon: '📝' },
  { id: 'measurements', label: 'Đo Lường', icon: '📊' },
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

// ── Technician Dashboard ─────────────────────────────────────────────────────────

const TechnicianDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 font-sans text-slate-900 fixed inset-0 z-[1000]">
      <aside className="w-64 bg-white border-r border-slate-200 text-slate-900 flex flex-col fixed h-full z-50 shadow-sm">
        <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Vườn <span className="text-emerald-600">Ươm</span></h1>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">Kỹ Thuật Viên</p>
          </div>
          <NotificationBell />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {TECH_TABS.map(tab => (
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
              {TECH_TABS.find(t => t.id === activeTab)?.label || 'Dashboard'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {activeTab === 'overview' && 'Tổng quan công việc và hoạt động của bạn'}
              {activeTab === 'tasks' && 'Danh sách công việc được giao'}
              {activeTab === 'reports' && 'Báo cáo tác vụ đã gửi'}
              {activeTab === 'measurements' && 'Lịch sử ghi nhận đo lường'}
            </p>
          </div>
          {activeTab === 'overview' && <TechOverview />}
          {activeTab === 'tasks' && <TechTasksTab />}
          {activeTab === 'reports' && <TechReportsTab />}
          {activeTab === 'measurements' && <TechMeasurementsTab />}
        </div>
      </main>
    </div>
  );
};

// ── Tech Overview ──────────────────────────────────────────────────────────────

const TechOverview = () => {
  const { showToast } = useToast();
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, completed: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [recentTasks, setRecentTasks] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [my, overdue] = await Promise.allSettled([
          tasksApi.getMy(),
          tasksApi.getOverdue()
        ]);
        const allTasks = my.status === 'fulfilled' ? my.value : [];
        const overdueTasks = overdue.status === 'fulfilled' ? overdue.value : [];
        const today = new Date().toISOString().split('T')[0];

        const pending = allTasks.filter(t => t.status === 'Pending').length;
        const inProgress = allTasks.filter(t => t.status === 'InProgress').length;
        const completed = allTasks.filter(t => t.status === 'Completed').length;
        setStats({ pending, inProgress, completed, overdue: overdueTasks.length });
        setRecentTasks(Array.isArray(allTasks) ? allTasks.slice(0, 5) : []);
      } catch { /* silent */ } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-600/20">
        <h3 className="font-hanken text-xl font-bold mb-1">Chào mừng Kỹ Thuật Viên!</h3>
        <p className="text-emerald-100 text-sm">Tiếp tục thực hiện các công việc chăm sóc và bảo trì.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Chờ Xử Lý', value: stats.pending, icon: '⏳', bg: 'bg-blue-50 border-blue-200', color: 'text-blue-700' },
          { label: 'Đang Làm', value: stats.inProgress, icon: '🔧', bg: 'bg-amber-50 border-amber-200', color: 'text-amber-700' },
          { label: 'Hoàn Thành', value: stats.completed, icon: '✅', bg: 'bg-emerald-50 border-emerald-200', color: 'text-emerald-700' },
          { label: 'Quá Hạn', value: stats.overdue, icon: '🚨', bg: 'bg-rose-50 border-rose-200', color: 'text-rose-700' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border rounded-2xl p-5`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{s.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">{s.label}</span>
            </div>
            <span className={`font-hanken text-3xl font-bold ${s.color}`}>{loading ? '…' : s.value}</span>
          </div>
        ))}
      </div>

      {/* Recent Tasks */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-4">Công Việc Gần Đây</h3>
        {recentTasks.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Chưa có công việc nào.</p>
        ) : (
          <div className="space-y-3">
            {recentTasks.map(task => {
              const icon = TASK_TYPE_ICONS[task.taskType] || '📋';
              const color = STATUS_COLORS[task.status] || 'bg-slate-100 text-slate-600';
              const statusLabel = { Pending: 'Chờ', InProgress: 'Đang Làm', Completed: 'Hoàn Thành' }[task.status] || task.status;
              return (
                <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <span className="text-xl">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{task.title || '—'}</p>
                    {task.experimentTitle && <p className="text-xs text-slate-400 truncate">{task.experimentTitle}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${color}`}>{statusLabel}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Tech Tasks Tab ─────────────────────────────────────────────────────────────

const TechTasksTab = () => {
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
    } catch {
      showToast('Không thể tải tác vụ', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchTasks(); }, [taskTab]);

  const handleStart = async (task) => {
    try {
      await tasksApi.start(task.id);
      showToast('Đã bắt đầu thực hiện tác vụ', 'success');
      fetchTasks();
    } catch (err) { showToast(err.message || 'Không thể bắt đầu', 'error'); }
  };

  const handleCancel = async (task) => {
    try {
      await tasksApi.cancel(task.id);
      showToast('Đã hủy tác vụ', 'info');
      fetchTasks();
    } catch (err) { showToast(err.message || 'Không thể hủy', 'error'); }
  };

  const openDetail = async (task) => {
    setSelectedTask(task);
    setShowDetail(true);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Task type filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          {TASK_TABS.map(tab => (
            <button key={tab.id} onClick={() => setTaskTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                taskTab === tab.id
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
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
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <button onClick={() => openDetail(task)} className="font-hanken font-bold text-sm text-slate-900 hover:text-emerald-600 transition-colors">{task.title || '—'}</button>
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
                      <button onClick={() => handleStart(task)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all">▶ Bắt Đầu</button>
                    )}
                    {task.status === 'InProgress' && (
                      <button onClick={() => openDetail(task)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all">✅ Hoàn Thành</button>
                    )}
                    {(task.status === 'Pending' || task.status === 'InProgress') && (
                      <button onClick={() => handleCancel(task)} className="px-3 py-2 border border-rose-300 text-rose-500 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-all">✕ Hủy</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Detail Modal */}
      {showDetail && selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => setShowDetail(false)} onUpdated={fetchTasks} />
      )}
    </div>
  );
};

// ── Task Detail Modal ──────────────────────────────────────────────────────────

const TaskDetailModal = ({ task, onClose, onUpdated }) => {
  const { showToast } = useToast();
  const [reports, setReports] = useState([]);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportText, setReportText] = useState('');
  const [resultData, setResultData] = useState([{ key: '', value: '' }]);
  const [reportImages, setReportImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  // reportId → List<TaskImage> fetch từ API GET /task-images/task/{reportId}
  const [reportImagesByReportId, setReportImagesByReportId] = useState({});
  const [imagesLoading, setImagesLoading] = useState(false);
  // MeasurementDefinitions của experiment hiện tại
  const [definitions, setDefinitions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Chỉ fetch reports. Ảnh của từng report sẽ được load ở useEffect bên dưới.
        const rep = await taskReportsApi.getByTask(task.id);
        setReports(Array.isArray(rep) ? rep : []);
      } catch { /* silent */ setReports([]); } finally { setLoading(false); }
    };
    fetchData();
  }, [task.id]);

  /**
   * Load ảnh từ API GET /task-images/task/{reportId} cho từng report.
   * Fallback: nếu API fail, dùng r.images.
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

  /**
   * Load MeasurementDefinitions của experiment để map key 'def_<uuid>' → metric info
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

  /**
   * Resolve key 'def_<uuid>' hoặc custom key trong resultData thành label hiển thị.
   * - Nếu key bắt đầu bằng 'def_' → tra definition theo id → trả về metricName (+ unit)
   * - Nếu không → trả về key gốc
   * Map lưu trong `definitionMap` (memoized).
   */
  const definitionMap = useMemo(() => {
    const m = new Map();
    for (const d of definitions) m.set(d.id, d);
    return m;
  }, [definitions]);

  const resolveMetricLabel = (key) => {
    if (typeof key !== 'string') return String(key);
    if (key.startsWith('def_')) {
      const defId = key.slice(4);
      const def = definitionMap.get(defId);
      if (def?.metricName) {
        return def.unit ? `${def.metricName} (${def.unit})` : def.metricName;
      }
      // Fallback: rút gọn UUID nếu chưa load xong definitions
      return `Chỉ số #${defId.slice(0, 8)}`;
    }
    return key;
  };

  // Fetch batch để lấy groupId chính xác (dùng API GET /batches/{batchId})
  // → filter MeasurementDefinition đúng nhóm của batch hiện tại
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
    try {
      setSaving(true);
      const dataObj = buildReportPayload(resultData);
      const reportRes = await taskReportsApi.create({ taskId: task.id, reportText, resultData: dataObj });
      const reportId = reportRes?.id || reportRes?.data?.id;

      // Bridge: tạo MeasurementRecord từ các field đo lường
// - Observation/Measurement: dùng POST /measurement-records/bulk (đúng schema)
// - Các task khác: dùng POST /measurement-records từng cái (legacy bridge)
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
        // Build Map<name, definition> để map measurementName → definitionId
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
      const rep = await taskReportsApi.getByTask(task.id);
      setReports(Array.isArray(rep) ? rep : []);
    } catch (err) { showToast(err.message || 'Lỗi gửi báo cáo', 'error'); }
    finally { setSaving(false); }
  };

  // Business rule: phải gửi báo cáo trước, sau đó mới complete.
  // Cho phép complete nếu: có nội dung báo cáo HOẶC có ảnh mới HOẶC đã có lịch sử báo cáo
  const handleCompleteTask = async () => {
    // P0 fix: bắt buộc có nội dung mới (không chỉ ảnh, không chỉ lịch sử)
    const hasNewContent = reportText.trim().length > 0;
    const minLength = 10;
    if (!hasNewContent) {
      showToast(`Vui lòng nhập nội dung báo cáo (tối thiểu ${minLength} ký tự) trước khi hoàn thành`, 'error');
      return;
    }
    if (reportText.trim().length < minLength) {
      showToast(`Nội dung quá ngắn — cần tối thiểu ${minLength} ký tự (hiện ${reportText.trim().length})`, 'error');
      return;
    }
    try {
      setCompleting(true);

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

      let mResult = { created: 0, skipped: 0, success: 0 };
      if (hasNewContent && Object.keys(dataObj).length > 0) {
        const usesBulkPath = task?.taskType === 'Measurement' || task?.taskType === 'Observation';
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

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Chi Tiết Tác Vụ</h3>
            <p className="text-xs text-slate-400">{task.title || '—'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Task Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Loại', value: task.taskType || '—' },
              { label: 'Trạng thái', value: task.status || '—' },
              { label: 'Thí nghiệm', value: task.experimentTitle || '—' },
              { label: 'Batch', value: task.batchCode || '—' },
              { label: 'Giai đoạn', value: task.experimentStageName || '—' },
              { label: 'Hạn chót', value: task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : '—' },
              { label: 'Người giao', value: task.createdByName || '—' },
            ].map(item => (
              <div key={item.label} className="p-3 bg-slate-50 rounded-xl">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{item.label}</p>
                <p className="font-semibold text-slate-900 text-xs mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Skill Requirements */}
          {Array.isArray(task.skillRequirements) && task.skillRequirements.length > 0 && (
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-indigo-400 font-bold uppercase">Yêu Cầu Kỹ Năng</p>
                <span className="text-[10px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-full">
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
                            className={`w-2 h-4 rounded-sm ${
                              level <= (sk.requiredLevel || 0)
                                ? 'bg-indigo-500'
                                : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="ml-1 text-xs font-bold text-indigo-600 w-4 text-center">{sk.requiredLevel || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {task.description && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-[10px] text-blue-400 font-bold uppercase mb-1">Mô tả</p>
              <p className="text-sm text-slate-700">{task.description}</p>
            </div>
          )}

          {/* Report Form */}
          {task.status !== 'Completed' && (
            <div className="border-t border-slate-200 pt-6">
              <h4 className="font-bold text-sm text-slate-900 mb-3">📝 Báo Cáo Công Việc</h4>
              {task.status === 'InProgress' && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                  ⚠️ Báo cáo là bắt buộc. Nhập nội dung (≥10 ký tự) rồi bấm "Hoàn Thành & Gửi Báo Cáo" — task sẽ tự động sang Hoàn Thành.
                </p>
              )}
              {task.status === 'Pending' && (
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
                  ℹ️ Có thể gửi báo cáo trước. Sau khi gửi, task vẫn ở trạng thái Chờ cho đến khi bấm Bắt Đầu.
                </p>
              )}
              <TaskReportForm
                task={task}
                reportText={reportText}
                setReportText={setReportText}
                resultData={resultData}
                setResultData={setResultData}
                images={reportImages}
                setImages={setReportImages}
                saving={saving || completing}
                disabled={task.status === 'Completed'}
                hideSubmit={true}
                onSubmit={handleSubmitReport}
                color="emerald"
                submitLabel="Gửi Báo Cáo"
              />

              {/* 2 nút action nằm TRONG form — đồng bộ với Student Dashboard */}
              <div className="pt-4 border-t border-slate-200 mt-2 flex items-center justify-between gap-3">
                {task.status === 'InProgress' ? (() => {
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
                  // Task Pending — cho gửi báo cáo nhưng KHÔNG complete
                  <>
                    <div className="text-xs text-slate-600">
                      <p className="font-bold text-slate-800">Gửi báo cáo (chưa hoàn thành)</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Task vẫn ở trạng thái Chờ</p>
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
            </div>
          )}

          {/* Task Completed - thông báo + nút Đóng */}
          {task.status === 'Completed' && (
            <div className="border-t border-slate-200 pt-6 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                <p className="font-bold text-slate-800">✓ Tác vụ đã hoàn thành</p>
                <p className="text-[10px] text-slate-500">Báo cáo đã được lưu — xem lại trong "Lịch Sử Báo Cáo"</p>
              </div>
              <button type="button" onClick={onClose}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition-colors">
                Đóng
              </button>
            </div>
          )}

          {/* Reports History */}
          {reports.length > 0 && (
            <div className="border-t border-slate-200 pt-6">
              <h4 className="font-bold text-sm text-slate-900 mb-3">📜 Lịch Sử Báo Cáo ({reports.length})</h4>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {reports.map(r => {
                  const resultEntries = r.resultData && typeof r.resultData === 'object'
                    ? Object.entries(r.resultData)
                    : [];
                  // Ưu tiên ảnh fetch từ API /task-images/task/{reportId}
                  const imageList = reportImagesByReportId[r.id] || (Array.isArray(r.images) ? r.images : []);
                  const dateText = r.reportedAt || r.createdAt;
                  const reporterName = r.reporterName || r.reportedByName || 'Technician';
                  return (
                    <div key={r.id} className="p-3 bg-green-50 rounded-xl border border-green-100">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                            {reporterName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-slate-900 truncate">{reporterName}</p>
                            <p className="text-[10px] text-slate-500">{r.taskTitleSnapshot || r.taskTitle || 'Báo cáo tác vụ'}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0">
                          {dateText ? new Date(dateText).toLocaleString('vi-VN') : '—'}
                        </span>
                      </div>

                      {r.reportText && (
                        <p className="text-xs text-slate-700 whitespace-pre-line line-clamp-3">{r.reportText}</p>
                      )}

                      {resultEntries.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {resultEntries.map(([k, v]) => (
                            <span key={k} className="px-2 py-0.5 bg-white border border-green-200 text-emerald-800 rounded-full text-[10px] font-semibold">
                              {resolveMetricLabel(k)}: <span className="text-slate-900 font-bold">{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {imageList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {imageList.map((img, i) => (
                            <a key={img.id || i} href={img.imageUrl || img.url} target="_blank" rel="noopener noreferrer"
                              className="block w-12 h-12 rounded-md overflow-hidden border border-green-200 hover:opacity-80 relative group"
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
                      {imagesLoading && imageList.length === 0 && (
                        <p className="text-[10px] text-slate-400 italic mt-2">⏳ Đang tải ảnh...</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Images */}
          {uploadedImages.length > 0 && (
            <div className="border-t border-slate-200 pt-6">
              <h4 className="font-bold text-sm text-slate-900 mb-3">Hình Ảnh ({uploadedImages.length})</h4>
              <div className="grid grid-cols-3 gap-2">
                {uploadedImages.map(img => (
                  <div key={img.id} className="bg-slate-100 rounded-xl overflow-hidden aspect-square">
                    {img.imageUrl ? (
                      <img src={img.imageUrl} alt={img.caption || ''} className="w-full h-full object-cover" onError={(e) => e.target.style.display='none'} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">Không có ảnh</div>
                    )}
                    {img.caption && <p className="text-[10px] text-center p-1 bg-slate-50 text-slate-600 truncate">{img.caption}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Footer action NGOÀI form — đã bỏ, do form đã có 2 nút Đóng + Hoàn Thành & Gửi Báo Cáo
          bên trong (xem tab "Báo Cáo" phía trên). Khi ở các tab khác, dùng nút X ở header để đóng. */}
    </div>
    </Portal>
  );
};

// ── Tech Reports Tab ───────────────────────────────────────────────────────────

const TechReportsTab = () => {
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
   * Load ảnh từ API GET /task-images/task/{reportId} cho các report.
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
            className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">— Tất cả tác vụ —</option>
            {taskOptions.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400">Đang tải...</div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400">Chưa có báo cáo nào.</div>
      ) : (
        visibleReports.map(r => {
          const imageList = reportImagesByReportId[r.id] || (Array.isArray(r.images) ? r.images : []);
          return (
          <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.taskTitle && <p className="text-sm font-bold text-slate-900">{r.taskTitle}</p>}
                  {r.taskType && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                      {r.taskType}
                    </span>
                  )}
                </div>
                {(r.experimentTitle || r.batchCode || r.stageName) && (
                  <p className="text-xs text-slate-500 mt-1">
                    {[r.experimentTitle, r.batchCode && `Batch ${r.batchCode}`, r.stageName].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Task: {r.taskId || '—'}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-slate-400 font-mono">{r.reportedAt ? new Date(r.reportedAt).toLocaleString('vi-VN') : (r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—')}</p>
                {r.measurements && r.measurements.length > 0 && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-[10px] font-bold">{r.measurements.length} đo lường</span>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-3">{r.reportText}</p>
            {r.resultData && Object.keys(r.resultData).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.entries(r.resultData).map(([k, v]) => (
                  <span key={k} className="px-3 py-1 bg-slate-100 rounded-lg text-xs">
                    <span className="text-slate-500">{resolveMetricLabel(k)}:</span> <span className="font-bold text-slate-900">{String(v)}</span>
                  </span>
                ))}
              </div>
            )}
            {/* Ảnh từ API /task-images/task/{reportId} */}
            {imageList.length > 0 && (
              <div className="flex flex-wrap gap-2">
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

// ── Tech Measurements Tab ──────────────────────────────────────────────────────

const TechMeasurementsTab = () => {
  const { showToast } = useToast();
  const [records, setRecords] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [filterBatchId, setFilterBatchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showBulkForm, setShowBulkForm] = useState(false);

  const fetchRecords = async (bId) => {
    if (!bId) { setRecords([]); setLoading(false); return; }
    try {
      setLoading(true);
      const data = await measurementRecordsApi.getByBatch(bId);
      setRecords(Array.isArray(data) ? data : []);
    } catch {
      showToast('Không thể tải dữ liệu đo lường', 'error');
      setRecords([]);
    } finally { setLoading(false); }
  };

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

        if (batchIds.length === 0) {
          setRecords([]);
          return;
        }

        const perBatch = await Promise.all(
          batchIds.map(b =>
            measurementRecordsApi.getByBatch(b.id)
              .then(list => Array.isArray(list) ? list : [])
              .catch(() => [])
              .then(list => list.map(r => ({
                ...r,
                batchCode: r.batchCode || b.code
              })))
          )
        );

        const merged = perBatch
          .flat()
          .sort((a, b) => new Date(b.measuredAt || 0) - new Date(a.measuredAt || 0));
        setRecords(merged);
        if (batchIds.length > 0 && !selectedBatch) setSelectedBatch(batchIds[0].id);
      } catch {
        setRecords([]);
      } finally { setLoading(false); }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilter = () => {
    if (filterBatchId.trim()) fetchRecords(filterBatchId.trim());
  };

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

  const visibleRecords = useMemo(
    () => selectedBatch ? records.filter(r => r.batchId === selectedBatch || r.batchCode === selectedBatch) : records,
    [records, selectedBatch]
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header với nút bulk */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-bold text-slate-900">📊 Dữ Liệu Đo Lường</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Xem các bản ghi đã đo + ghi nhận hàng loạt theo <strong>MeasurementDefinition</strong>.
            </p>
          </div>
          <button onClick={() => setShowBulkForm(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20">
            📏 Ghi nhận đo lường (Bulk)
          </button>
        </div>
      </div>

      {/* Batch filter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Lọc theo tác vụ (Batch)</label>
            <select
              value={selectedBatch}
              onChange={e => setSelectedBatch(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
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
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
              <button onClick={handleFilter} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20">Tìm</button>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-3">
          {visibleRecords.length} bản ghi đo lường {selectedBatch ? '(đã lọc)' : '(tất cả batch của bạn)'}
        </p>
      </div>

      {/* Records */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400">Đang tải...</div>
      ) : visibleRecords.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
          {selectedBatch || filterBatchId ? 'Không có dữ liệu cho Batch này.' : 'Chưa có dữ liệu đo lường.'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-emerald-50 border-b border-emerald-200">
                <tr>
                  {['Ngày đo', 'Batch', 'Chỉ số', 'Giá trị', 'Đơn vị', 'Giá trị mục tiêu', 'Người đo', 'Ghi chú'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-emerald-700 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{r.measuredAt ? new Date(r.measuredAt).toLocaleString('vi-VN') : '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-500">{r.batchCode || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 text-xs">{r.metricName || '—'}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700 text-xs">{r.value !== null && r.value !== undefined ? r.value : (r.textValue || '—')}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.unit || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.targetValue || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{r.measuredByName || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 max-w-[150px] truncate">{r.extraData ? JSON.stringify(r.extraData) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal ghi nhận đo lường hàng loạt */}
      <BulkMeasurementForm
        open={showBulkForm}
        onClose={() => setShowBulkForm(false)}
        showToast={showToast}
        experimentId={tasks.find(t => t.batchId === selectedBatch)?.experimentId || tasks.find(t => t.experimentId)?.experimentId || ''}
        stageId={tasks.find(t => t.batchId === selectedBatch)?.stageId || tasks.find(t => t.experimentStageId)?.experimentStageId || ''}
        defaultBatchId={selectedBatch}
        batches={batchOptions}
        onSubmitted={() => {
          // Reload records của batch hiện tại
          if (selectedBatch) fetchRecords(selectedBatch);
          else if (filterBatchId) fetchRecords(filterBatchId);
        }}
      />
    </div>
  );
};

// ── Tech Farms Tab ─────────────────────────────────────────────────────────────
// (Removed per user request - no longer used in dashboard)

export default TechnicianDashboard;
