import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../context/ToastContext';
import { tasksApi, taskReportsApi, taskImagesApi, measurementRecordsApi } from '../api/sharedTaskApi';
import { measurementDefinitionsApi, batchesApi } from '../api/experimentApi';
import TaskReportForm, { buildReportPayload } from '../components/tasks/TaskReportForm';
import { extractMeasurementsFromReport, buildMeasurementPayloads, createMeasurementsFromTaskReport, MEASUREMENT_FIELD_MAP, getMeasurementNameVi, extractBulkItemsFromResultData, createMeasurementsBulk, filterDefinitionsByTaskGroup } from '../utils/measurementBridge';

const Portal = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

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

const PersonalTaskList = () => {
  const { showToast } = useToast();
  const [userRole] = useState(() => {
    const path = window.location.pathname;
    return path.includes('technician') ? 'Technician' : 'Student';
  });
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(window.location.pathname);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const handleNavigate = () => setCurrentPage(window.location.pathname);
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

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
      showToast('Không thể tải tác vụ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [activeTab]);

  const handleStart = async (task) => {
    try {
      await tasksApi.start(task.id);
      showToast('Đã bắt đầu thực hiện tác vụ', 'success');
      fetchTasks();
    } catch (err) { showToast(err.message || 'Không thể bắt đầu tác vụ', 'error'); }
  };

  // Complete task = submit report (modal handles both API calls)
  const handleSubmitComplete = async ({ reportText, resultData, images }) => {
    try {
      // 1. Submit report first (business rule: report required before completion)
      const dataObj = buildReportPayload(resultData);
      const reportRes = await taskReportsApi.create({ taskId: selectedTask.id, reportText, resultData: dataObj });
      const reportId = reportRes?.id || reportRes?.data?.id;

      // 2. Bridge: tự động tạo MeasurementRecord từ các field đo lường trong resultData
      let definitions = [];
      try {
        const expId = selectedTask.experimentId || selectedTask.experiment?.id;
        if (expId) {
          const data = await measurementDefinitionsApi.getByExperiment(expId);
          definitions = Array.isArray(data) ? data : [];
        }
      } catch { definitions = []; }

      // Fetch batch qua API GET /batches/{batchId} để lấy groupId chắc chắn đúng
      let batchGroupId = null;
      try {
        const batchId = selectedTask.batchId || selectedTask.batch?.id;
        if (batchId) {
          const b = await batchesApi.getById(batchId);
          batchGroupId = b?.groupId || null;
        }
      } catch { batchGroupId = null; }

      // Lọc definitions theo nhóm của batch (chỉ lấy 1 nhóm, tránh trùng metricName)
      const effectiveDefinitions = filterDefinitionsByTaskGroup(definitions, selectedTask, batchGroupId);

      const isMeasurementTask = selectedTask.taskType === 'Measurement' || selectedTask.taskType === 'Observation';
      let measureResult;
      if (isMeasurementTask) {
        const bulkItems = extractBulkItemsFromResultData(resultData, effectiveDefinitions);
        measureResult = await createMeasurementsBulk(selectedTask, bulkItems, {
          measuredAt: new Date().toISOString(),
          notes: `Tự động từ TaskReport${reportId ? ` #${reportId}` : ''}`
        }, measurementRecordsApi.bulk);
      } else {
        // Build Map<name, definition> để measurementName → definitionId
        const defByName = new Map(effectiveDefinitions.map(d => [d.metricName, d]));
        const measurementPayloads = buildMeasurementPayloads(
          selectedTask,
          extractMeasurementsFromReport(dataObj),
          {
            measuredAt: new Date().toISOString(),
            notes: `Tự động từ TaskReport${reportId ? ` #${reportId}` : ''}`
          },
          defByName
        );
        measureResult = await createMeasurementsFromTaskReport(measurementPayloads, measurementRecordsApi);
      }

      // 3. Gắn ảnh đính kèm vào TaskReport (multipart với File + đầy đủ metadata)
      let imageOk = 0;
      if (images && images.length > 0) {
        const imageResults = await Promise.allSettled(
          images.map((img) => {
            // Mỗi img có { file, previewUrl, caption, fileName, fileSize, imageId?, url? }
            // - Nếu có file (mới chọn từ máy) → gửi multipart với File
            // - Nếu không có file (ảnh đã upload trước đó) → gửi JSON với imageUrl
            if (img.file) {
              return taskImagesApi.upload({
                file: img.file,
                imageUrl: img.url, // optional URL nếu đã có Cloudinary
                caption: img.caption || '',
                capturedAt: img.uploadedAt || new Date().toISOString(),
                experimentId: selectedTask.experimentId || selectedTask.experiment?.id,
                batchId: selectedTask.batchId || selectedTask.batch?.id,
                taskReportId: reportId,
                taskId: selectedTask.id
              });
            }
            return taskImagesApi.create({
              taskReportId: reportId,
              taskId: selectedTask.id,
              experimentId: selectedTask.experimentId || selectedTask.experiment?.id,
              batchId: selectedTask.batchId || selectedTask.batch?.id,
              imageUrl: img.url,
              caption: img.caption || '',
              capturedAt: img.uploadedAt || new Date().toISOString()
            });
          })
        );
        imageOk = imageResults.filter(r => r.status === 'fulfilled' && r.value?.success !== false).length;
      }

      // 4. Mark complete
      await tasksApi.complete(selectedTask.id);

      // Toast thông báo đầy đủ
      const toastMsg = [];
      const measurementCount = measureResult.success ?? measureResult.created ?? 0;
      if (measurementCount > 0) {
        const preview = previewMeasurements(dataObj);
        toastMsg.push(`📊 ${measurementCount} chỉ số${preview ? ` (${preview})` : ''}`);
      }
      if (imageOk > 0) toastMsg.push(`📷 ${imageOk} ảnh`);
      showToast(
        toastMsg.length > 0 ? `Đã hoàn thành tác vụ! ${toastMsg.join(' · ')}` : 'Đã hoàn thành tác vụ và gửi báo cáo!',
        'success'
      );
      if (measureResult.failed > 0) {
        console.warn('[handleSubmitComplete] Một số measurement không tạo được:', measureResult.errors);
      }

      setShowReportModal(false);
      setSelectedTask(null);
      fetchTasks();
    } catch (err) {
      showToast(err.message || 'Không thể hoàn thành tác vụ', 'error');
    }
  };

  const handleCancel = async (task) => {
    try {
      await tasksApi.cancel(task.id);
      showToast('Đã hủy tác vụ', 'info');
      fetchTasks();
    } catch (err) { showToast(err.message || 'Không thể hủy tác vụ', 'error'); }
  };

  const openReportModal = (task) => {
    setSelectedTask(task);
    setShowReportModal(true);
  };

  const openDetail = (task) => {
    setSelectedTask(task);
    setShowDetail(true);
  };

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'Pending').length,
    inProgress: tasks.filter(t => t.status === 'InProgress').length,
    completed: tasks.filter(t => t.status === 'Completed').length,
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 font-sans text-slate-900 fixed inset-0 z-[1000]">
      <SharedSidebar2 userRole={userRole} currentPage={currentPage} navigateTo={navigateTo} />

      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-5xl">
          {/* Header */}
          <div className="mb-8">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Requirement T16</p>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">Danh Sách Công Việc Cá Nhân</h1>
            <p className="text-sm text-slate-500 mt-1">Xem và thực hiện các công việc được giao</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Tổng', value: stats.total, bg: 'bg-white border-slate-200', color: 'text-slate-900' },
              { label: 'Chờ', value: stats.pending, bg: 'bg-blue-50 border-blue-200', color: 'text-blue-700' },
              { label: 'Đang Làm', value: stats.inProgress, bg: 'bg-amber-50 border-amber-200', color: 'text-amber-700' },
              { label: 'Hoàn Thành', value: stats.completed, bg: 'bg-emerald-50 border-emerald-200', color: 'text-emerald-700' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-2xl p-5 border shadow-sm`}>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{s.label}</p>
                <p className={`text-3xl font-bold mt-1 ${s.color}`}>{loading ? '…' : s.value}</p>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-2xl border-slate-200 shadow-sm mb-6 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
              {TASK_TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>
                  {tab.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-500 font-semibold">{tasks.length} tác vụ</span>
            </div>
          </div>

          {/* Tasks */}
          {loading ? (
            <div className="bg-white rounded-2xl border-slate-200 p-12 text-center text-slate-400">Đang tải...</div>
          ) : tasks.length === 0 ? (
            <div className="bg-white rounded-2xl border-slate-200 p-12 text-center text-slate-400">Không có công việc nào.</div>
          ) : (
            <div className="space-y-4">
              {tasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  userRole={userRole}
                  onStart={() => handleStart(task)}
                  onCancel={() => handleCancel(task)}
                  onReport={() => openReportModal(task)}
                  onDetail={() => openDetail(task)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {showReportModal && selectedTask && (
        <TaskReportModal
          task={selectedTask}
          mode="complete"
          onClose={() => { setShowReportModal(false); setSelectedTask(null); }}
          onSubmit={handleSubmitComplete}
        />
      )}

      {showDetail && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setShowDetail(false)}
          onStart={() => { handleStart(selectedTask); setShowDetail(false); }}
          onCompleteRequest={() => { setShowDetail(false); openReportModal(selectedTask); }}
        />
      )}
    </div>
  );
};

// ── Task Item ──────────────────────────────────────────────────────────────────

const TaskItem = ({ task, userRole, onStart, onCancel, onReport, onDetail }) => {
  const icon = TASK_TYPE_ICONS[task.taskType] || '📋';
  const statusColor = STATUS_COLORS[task.status] || 'bg-slate-100 text-slate-600';
  const statusBg = task.status === 'InProgress' ? 'bg-amber-50 border-l-4 border-l-amber-500' : task.status === 'Completed' ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'bg-white border-l-4 border-l-slate-200';
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed' && task.status !== 'Completed';
  const statusLabel = { Pending: 'Chờ', InProgress: 'Đang Làm', Completed: 'Hoàn Thành', Overdue: 'Quá Hạn' }[task.status] || task.status;

  return (
    <div className={`${statusBg} rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all`}>
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button onClick={onDetail} className="font-hanken font-bold text-sm text-slate-900 hover:text-blue-600 transition-colors">{task.title || '—'}</button>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}>{statusLabel}</span>
            {isOverdue && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">Quá hạn</span>}
            {task.taskType && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{task.taskType}</span>}
          </div>
          {task.description && <p className="text-xs text-slate-500 line-clamp-2 mb-2">{task.description}</p>}
          <div className="flex items-center gap-4 text-[10px] text-slate-400 flex-wrap">
            {task.experimentTitle && <span>🧪 {task.experimentTitle}</span>}
            {task.batchCode && <span>📦 {task.batchCode}</span>}
            {task.dueDate && <span className={isOverdue ? 'text-rose-500 font-bold' : ''}>📅 {new Date(task.dueDate).toLocaleDateString('vi-VN')}</span>}
            {task.createdByName && <span>👤 {task.createdByName}</span>}
            {task.requiredSkillDescription && <span>🎯 {task.requiredSkillDescription}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button onClick={onDetail} className="px-3 py-2 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-all">👁️ Chi tiết</button>
          {task.status === 'Pending' && (
            <button onClick={onStart} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all">▶ Bắt Đầu</button>
          )}
          {task.status === 'InProgress' && (
            <button onClick={onReport} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all">✅ Hoàn Thành</button>
          )}
          {(task.status === 'Pending' || task.status === 'InProgress') && (
            <button onClick={onCancel} className="px-3 py-2 border border-rose-300 text-rose-500 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-all">✕ Hủy</button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Task Report Modal ──────────────────────────────────────────────────────────

const TaskReportModal = ({ task, mode = 'report', onClose, onSubmit }) => {
  const { showToast } = useToast();
  const [reportText, setReportText] = useState('');
  const [saving, setSaving] = useState(false);
  const [resultData, setResultData] = useState([{ key: '', value: '' }]);
  const [images, setImages] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reportText.trim()) { showToast('Vui lòng nhập nội dung báo cáo', 'error'); return; }
    try {
      setSaving(true);
      await onSubmit({ reportText, resultData, images });
    } catch (err) {
      showToast(err.message || 'Không thể gửi báo cáo', 'error');
    } finally { setSaving(false); }
  };

  const updateResult = (idx, field, value) => setResultData(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));

  const isComplete = mode === 'complete';
  const titleText = isComplete ? 'Hoàn Thành & Báo Cáo' : 'Báo Cáo Tác Vụ';
  const headerBg = isComplete ? 'bg-gradient-to-r from-emerald-50 to-teal-50' : 'bg-white';

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className={`px-6 py-4 border-b border-slate-200 flex justify-between items-center ${headerBg}`}>
          <div>
            <h3 className="font-hanken font-bold text-lg text-slate-900">{titleText}</h3>
            {isComplete && <p className="text-xs text-emerald-700 mt-0.5">Báo cáo là bắt buộc trước khi hoàn thành</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className={`p-3 rounded-xl border ${isComplete ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
            <p className="text-xs text-slate-500 font-semibold">Tác vụ</p>
            <p className="font-bold text-sm text-slate-900">{task.title || '—'}</p>
            {task.description && <p className="text-xs text-slate-500 mt-1">{task.description}</p>}
          </div>
          <TaskReportForm
            task={task}
            reportText={reportText}
            setReportText={setReportText}
            resultData={resultData}
            setResultData={setResultData}
            images={images}
            setImages={setImages}
            saving={saving}
            disabled={false}
            onSubmit={handleSubmit}
            color={isComplete ? 'emerald' : 'blue'}
            submitLabel={isComplete ? '✅ Hoàn Thành & Gửi Báo Cáo' : 'Gửi Báo Cáo'}
          />
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50">Hủy</button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
};

// ── Task Detail Modal ──────────────────────────────────────────────────────────

const TaskDetailModal = ({ task, onClose, onStart, onCompleteRequest }) => {
  const statusColor = STATUS_COLORS[task.status] || 'bg-slate-100 text-slate-600';
  const statusLabel = { Pending: 'Chờ', InProgress: 'Đang Làm', Completed: 'Hoàn Thành', Overdue: 'Quá Hạn' }[task.status] || task.status;
  const tm = TASK_TYPE_ICONS[task.taskType] || '📋';

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Chi Tiết Tác Vụ</h3>
            <p className="text-xs text-slate-400">{task.title || '—'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Loại', value: <span className="flex items-center gap-1.5">{tm} {task.taskType || '—'}</span> },
              { label: 'Trạng thái', value: <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}>{statusLabel}</span> },
              { label: 'Thí nghiệm', value: task.experimentTitle || '—' },
              { label: 'Batch', value: task.batchCode || '—' },
              { label: 'Giai đoạn', value: task.experimentStageName || '—' },
              { label: 'Hạn chót', value: task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : '—' },
              { label: 'Người giao', value: task.createdByName || '—' },
              { label: 'Yêu cầu kỹ năng', value: task.requiredSkillDescription || '—' },
            ].map(item => (
              <div key={item.label} className="p-3 bg-slate-50 rounded-xl">
                <p className="text-[10px] text-slate-400 font-bold uppercase">{item.label}</p>
                <p className="font-semibold text-slate-900 text-xs mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
          {task.description && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-[10px] text-blue-400 font-bold uppercase mb-1">Mô tả</p>
              <p className="text-sm text-slate-700">{task.description}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-4 px-6 pb-6 border-t border-slate-200">
          <button onClick={onClose} className="px-5 py-2.5 border border-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50">Đóng</button>
          {task.status === 'Pending' && (
            <button onClick={onStart} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20">▶ Bắt Đầu</button>
          )}
          {task.status === 'InProgress' && (
            <button onClick={onCompleteRequest} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20">✅ Hoàn Thành</button>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
};

// ── Inline Sidebar ─────────────────────────────────────────────────────────────

const SharedSidebar2 = ({ userRole, currentPage, navigateTo }) => {
  const role = userRole || 'Student';
  const tabs = role === 'Technician'
    ? [
        { id: '/technician', label: 'Tổng Quan', icon: '🏠' },
        { id: '/technician/task-list', label: 'T16 Công Việc', icon: '📋' },
        { id: '/technician/care-completion', label: 'T18 Hoàn Thành', icon: '✅' },
        { id: '/technician/emergency-report', label: 'T5 Báo Cáo', icon: '🚨' },
      ]
    : [
        { id: '/student', label: 'Tổng Quan', icon: '🏠' },
        { id: '/student/task-list', label: 'T16 Công Việc', icon: '📋' },
        { id: '/student/care-completion', label: 'T18 Hoàn Thành', icon: '✅' },
        { id: '/student/morphology-entry', label: 'T19 Ghi Nhận', icon: '📊' },
      ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 text-slate-900 flex flex-col fixed h-full z-50 shadow-sm">
      <div className="px-6 py-6 border-b border-slate-100">
        <h1 className="text-lg font-bold text-slate-900">Smart <span className="text-blue-600">Farm</span></h1>
        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">{role} Portal</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => navigateTo(tab.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              currentPage === tab.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}>
            <span className="text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-100">
        <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 text-sm font-medium transition-all">
          <span className="text-base">🚪</span> Đăng Xuất
        </button>
      </div>
    </aside>
  );
};

export default PersonalTaskList;
