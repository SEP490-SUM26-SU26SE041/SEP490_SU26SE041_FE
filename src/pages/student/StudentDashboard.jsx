import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from '../../context/ToastContext';
import { tasksApi, taskReportsApi, measurementRecordsApi } from '../../api/sharedTaskApi';
import { experimentsApi } from '../../api/studentTechApi';
import { batchesApi } from '../../api/experimentApi';

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
        <div className="px-6 py-6 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-900">Smart <span className="text-blue-600">Farm</span></h1>
          <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">Student Portal</p>
          {(() => { try { const u = JSON.parse(localStorage.getItem('user') || '{}'); return u.fullName ? <p className="mt-2 text-xs text-slate-500 font-medium">{u.fullName}</p> : null; } catch { return null; } })()}
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
          <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
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

  const handleComplete = async (task) => {
    try {
      await tasksApi.complete(task.id);
      showToast('Đã hoàn thành tác vụ!', 'success');
      fetchTasks();
    } catch (err) { showToast(err.message || 'Không thể hoàn thành', 'error'); }
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
                      <button onClick={() => handleComplete(task)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all">✅ Hoàn Thành</button>
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
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportText, setReportText] = useState('');
  const [resultData, setResultData] = useState([{ key: '', value: '' }]);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [uploading, setUploading] = useState(false);

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

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportText.trim()) { showToast('Vui lòng nhập nội dung báo cáo', 'error'); return; }
    try {
      setSaving(true);
      const dataObj = {};
      resultData.forEach(r => { if (r.key.trim()) dataObj[r.key.trim()] = r.value; });
      await taskReportsApi.create({ taskId: task.id, reportText, resultData: dataObj });
      showToast('Đã gửi báo cáo!', 'success');
      setReportText('');
      setResultData([{ key: '', value: '' }]);
      const data = await taskReportsApi.getByTask(task.id);
      setReports(Array.isArray(data) ? data : []);
      if (onUpdated) onUpdated();
    } catch (err) { showToast(err.message || 'Lỗi gửi báo cáo', 'error'); }
    finally { setSaving(false); }
  };

  const handleUploadImage = async (e) => {
    e.preventDefault();
    if (!imageUrl.trim()) { showToast('Vui lòng nhập URL ảnh', 'error'); return; }
    try {
      setUploading(true);
      const token = localStorage.getItem('token');
      await fetch('/api/task-images/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          taskId: task.id,
          taskReportId: null,
          experimentId: task.experimentId || '00000000-0000-0000-0000-000000000000',
          batchId: task.batchId || '00000000-0000-0000-0000-000000000000',
          imageUrl: imageUrl.trim(),
          caption: imageCaption.trim(),
          capturedAt: new Date().toISOString()
        })
      });
      showToast('Đã upload ảnh!', 'success');
      setImageUrl('');
      setImageCaption('');
    } catch (err) { showToast(err.message || 'Lỗi upload ảnh', 'error'); }
    finally { setUploading(false); }
  };

  const updateResult = (idx, field, value) => {
    setResultData(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const statusColors = STATUS_COLORS[task.status] || 'bg-slate-100 text-slate-600';
  const statusLabel = { Pending: 'Chờ', InProgress: 'Đang Làm', Completed: 'Hoàn Thành', Overdue: 'Quá Hạn' }[task.status] || task.status;

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
              { label: 'Trạng thái', value: statusLabel },
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
          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm text-slate-900">📝 Gửi Báo Cáo</h4>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors}`}>{statusLabel}</span>
            </div>
            <form onSubmit={handleSubmitReport} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nội dung báo cáo</label>
                <textarea value={reportText} onChange={e => setReportText(e.target.value)} rows={3}
                  placeholder="Mô tả kết quả quan sát của bạn..."
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dữ liệu định lượng (tùy chọn)</label>
                <div className="space-y-2">
                  {resultData.map((r, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input type="text" value={r.key} placeholder="Key (VD: plantsObserved)"
                        onChange={e => updateResult(idx, 'key', e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      <input type="text" value={r.value} placeholder="Giá trị"
                        onChange={e => updateResult(idx, 'value', e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                      {resultData.length > 1 && (
                        <button type="button" onClick={() => setResultData(prev => prev.filter((_, i) => i !== idx))}
                          className="px-2 text-rose-500 hover:bg-rose-50 rounded-lg font-bold">✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setResultData(prev => [...prev, { key: '', value: '' }])}
                    className="text-xs text-blue-600 font-semibold hover:underline">
                    + Thêm dòng dữ liệu
                  </button>
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all">
                {saving ? '⏳ Đang gửi...' : '✉️ Gửi Báo Cáo'}
              </button>
            </form>
          </div>

          {/* Image Upload */}
          <div className="border-t border-slate-200 pt-6">
            <h4 className="font-bold text-sm text-slate-900 mb-3">📷 Upload Ảnh Minh Chứng</h4>
            <form onSubmit={handleUploadImage} className="space-y-2 bg-gradient-to-br from-teal-50 to-emerald-50 p-3 rounded-xl border border-teal-100">
              <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                placeholder="URL ảnh (sau khi upload lên storage)"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
              <input type="text" value={imageCaption} onChange={e => setImageCaption(e.target.value)}
                placeholder="Mô tả ảnh (tùy chọn)"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white" />
              <button type="submit" disabled={uploading}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-600/20 disabled:opacity-50 transition-all">
                {uploading ? '⏳ Đang upload...' : '📤 Upload Ảnh'}
              </button>
            </form>
          </div>

          {/* Reports History */}
          {reports.length > 0 && (
            <div className="border-t border-slate-200 pt-6">
              <h4 className="font-bold text-sm text-slate-900 mb-3">📜 Lịch Sử Báo Cáo ({reports.length})</h4>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {reports.map(r => {
                  const resultEntries = r.resultData && typeof r.resultData === 'object'
                    ? Object.entries(r.resultData)
                    : [];
                  const imageList = Array.isArray(r.images) ? r.images : [];
                  const dateText = r.reportedAt || r.createdAt;
                  const reporterName = r.reporterName || r.reportedByName || 'Bạn';
                  return (
                    <div key={r.id} className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                            {reporterName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-xs text-slate-900 truncate">{reporterName}</p>
                            <p className="text-[10px] text-slate-500">Báo cáo tác vụ</p>
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
                            <span key={k} className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 rounded-full text-[10px] font-mono font-bold">
                              {k}: <span className="text-slate-900">{String(v)}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {imageList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {imageList.map((img, i) => (
                            <a key={i} href={img.url || img} target="_blank" rel="noopener noreferrer"
                              className="block w-12 h-12 rounded-md overflow-hidden border border-blue-200 hover:opacity-80">
                              <img src={img.url || img} alt={img.name || `img-${i}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
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
    if (!form.experimentId) return showToast('Vui lòng chọn thí nghiệm', 'error');
    if (!form.batchId) return showToast('Vui lòng chọn batch', 'error');
    if (!form.value && !form.textValue) return showToast('Vui lòng nhập giá trị đo', 'error');

    try {
      setSaving(true);
      const extraObj = {};
      extraData.forEach(r => { if (r.key.trim()) extraObj[r.key.trim()] = r.value; });
      await measurementRecordsApi.create({
        experimentId: form.experimentId,
        experimentStageId: form.experimentStageId || undefined,
        batchId: form.batchId,
        measurementDefinitionId: form.measurementDefinitionId || undefined,
        value: form.value ? parseFloat(form.value) : undefined,
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Thí nghiệm *</label>
                <select name="experimentId" value={form.experimentId} onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                  <option value="">— Chọn thí nghiệm —</option>
                  {experiments.map(e => (
                    <option key={e.id} value={e.id}>{e.title || e.name || e.id.slice(0, 8)}</option>
                  ))}
                </select>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Batch *</label>
                <select name="batchId" value={form.batchId} onChange={handleChange} disabled={!form.experimentId}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-50">
                  <option value="">— Chọn batch —</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.code || b.batchCode || b.id.slice(0, 8)}</option>
                  ))}
                </select>
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
                <input type="number" step="0.01" name="value" value={form.value} onChange={handleChange}
                  placeholder="VD: 12.5"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-indigo-700 mb-1">Giá trị chữ</label>
                <input type="text" name="textValue" value={form.textValue} onChange={handleChange}
                  placeholder="Hoặc nhập mô tả..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày đo</label>
              <input type="date" name="measuredAt" value={form.measuredAt} onChange={handleChange}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
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
          const imageList = Array.isArray(r.images) ? r.images : [];
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
                        <p className="text-[10px] text-slate-400 font-mono break-all">{k}</p>
                        <p className="font-semibold text-slate-900 break-all">{String(v)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {imageList.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {imageList.map((img, i) => (
                    <a key={i} href={img.url || img} target="_blank" rel="noopener noreferrer"
                      className="block w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:opacity-80">
                      <img src={img.url || img} alt={img.name || `img-${i}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
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
