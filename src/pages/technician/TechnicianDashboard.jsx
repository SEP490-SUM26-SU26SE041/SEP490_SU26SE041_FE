import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { tasksApi, taskReportsApi, measurementRecordsApi } from '../../api/sharedTaskApi';
import { farmsApi, cropsApi } from '../../api/studentTechApi';

const TECH_TABS = [
  { id: 'overview', label: 'Tổng Quan', icon: '🏠' },
  { id: 'tasks', label: 'Công Việc', icon: '📋' },
  { id: 'reports', label: 'Báo Cáo', icon: '📝' },
  { id: 'measurements', label: 'Đo Lường', icon: '📊' },
  { id: 'farms', label: 'Nông Trại', icon: '🌾' },
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
        <div className="px-6 py-6 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-900">Smart <span className="text-blue-600">Farm</span></h1>
          <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">Technician Portal</p>
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
              {TECH_TABS.find(t => t.id === activeTab)?.label || 'Dashboard'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {activeTab === 'overview' && 'Tổng quan công việc và hoạt động của bạn'}
              {activeTab === 'tasks' && 'Danh sách công việc được giao'}
              {activeTab === 'reports' && 'Báo cáo tác vụ đã gửi'}
              {activeTab === 'measurements' && 'Lịch sử ghi nhận đo lường'}
              {activeTab === 'farms' && 'Thông tin nông trại và khu vực'}
            </p>
          </div>
          {activeTab === 'overview' && <TechOverview />}
          {activeTab === 'tasks' && <TechTasksTab />}
          {activeTab === 'reports' && <TechReportsTab />}
          {activeTab === 'measurements' && <TechMeasurementsTab />}
          {activeTab === 'farms' && <TechFarmsTab />}
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

  const handleComplete = async (task) => {
    try {
      await tasksApi.complete(task.id);
      showToast('Đã hoàn thành tác vụ!', 'success');
      fetchTasks();
    } catch (err) { showToast(err.message || 'Không thể hoàn thành', 'error'); }
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
                      <button onClick={() => handleComplete(task)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all">✅ Hoàn Thành</button>
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
        <TaskDetailModal task={selectedTask} onClose={() => setShowDetail(false)} />
      )}
    </div>
  );
};

// ── Task Detail Modal ──────────────────────────────────────────────────────────

const TaskDetailModal = ({ task, onClose }) => {
  const { showToast } = useToast();
  const [reports, setReports] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportText, setReportText] = useState('');
  const [resultData, setResultData] = useState([{ key: '', value: '' }]);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [taskImagesApi, setTaskImagesApi] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [rep, img] = await Promise.allSettled([
          taskReportsApi.getByTask(task.id),
          task.id ? fetch(`/api/task-images/task/${task.id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
          }).then(r => r.json()).then(d => d.data || []) : Promise.resolve([])
        ]);
        setReports(Array.isArray(rep.value) ? rep.value : []);
        setImages(Array.isArray(img.value) ? img.value : []);
      } catch { /* silent */ } finally { setLoading(false); }
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
      const rep = await taskReportsApi.getByTask(task.id);
      setReports(Array.isArray(rep) ? rep : []);
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4">
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

          {/* Report Form */}
          <div className="border-t border-slate-200 pt-6">
            <h4 className="font-bold text-sm text-slate-900 mb-3">📝 Gửi Báo Cáo</h4>
            <form onSubmit={handleSubmitReport} className="space-y-3">
              <textarea value={reportText} onChange={e => setReportText(e.target.value)} rows={3}
                placeholder="Mô tả kết quả đã thực hiện..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              <div className="space-y-1">
                {resultData.map((r, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input type="text" value={r.key} placeholder="Key (VD: waterUsed)"
                      onChange={e => updateResult(idx, 'key', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    <input type="text" value={r.value} placeholder="Giá trị"
                      onChange={e => updateResult(idx, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {resultData.length > 1 && (
                      <button type="button" onClick={() => setResultData(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 font-bold">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setResultData(prev => [...prev, { key: '', value: '' }])} className="text-xs text-emerald-600 font-semibold hover:underline">+ Thêm dữ liệu</button>
              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50">
                {saving ? 'Đang gửi...' : 'Gửi Báo Cáo'}
              </button>
            </form>
          </div>

          {/* Upload Image */}
          <div className="border-t border-slate-200 pt-6">
            <h4 className="font-bold text-sm text-slate-900 mb-3">📷 Upload Ảnh</h4>
            <form onSubmit={handleUploadImage} className="space-y-3">
              <input type="text" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                placeholder="URL ảnh (sau khi upload lên storage)"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <input type="text" value={imageCaption} onChange={e => setImageCaption(e.target.value)}
                placeholder="Mô tả ảnh (tùy chọn)"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <button type="submit" disabled={uploading}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-600/20 disabled:opacity-50">
                {uploading ? 'Đang upload...' : 'Upload Ảnh'}
              </button>
            </form>
          </div>

          {/* Reports History */}
          {reports.length > 0 && (
            <div className="border-t border-slate-200 pt-6">
              <h4 className="font-bold text-sm text-slate-900 mb-3">Lịch Sử Báo Cáo ({reports.length})</h4>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {reports.map(r => (
                  <div key={r.id} className="p-3 bg-green-50 rounded-xl border border-green-100">
                    <div className="flex justify-between mb-1">
                      <p className="text-[10px] text-green-600 font-mono font-bold">{r.id}</p>
                      <p className="text-[10px] text-slate-400">{r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}</p>
                    </div>
                    <p className="text-xs text-slate-700">{r.reportText}</p>
                    {r.resultData && Object.keys(r.resultData).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(r.resultData).map(([k, v]) => (
                          <span key={k} className="px-2 py-0.5 bg-green-200 text-green-800 rounded-full text-[10px] font-mono font-bold">
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Images */}
          {images.length > 0 && (
            <div className="border-t border-slate-200 pt-6">
              <h4 className="font-bold text-sm text-slate-900 mb-3">Hình Ảnh ({images.length})</h4>
              <div className="grid grid-cols-3 gap-2">
                {images.map(img => (
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
    </div>
  );
};

// ── Tech Reports Tab ───────────────────────────────────────────────────────────

const TechReportsTab = () => {
  const { showToast } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const data = await fetch('/api/task-reports', {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()).then(d => d.data || []);
        setReports(Array.isArray(data) ? data : []);
      } catch { setReports([]); } finally { setLoading(false); }
    };
    fetchReports();
  }, []);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{reports.length} báo cáo đã gửi</p>
      </div>
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400">Đang tải...</div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400">Chưa có báo cáo nào.</div>
      ) : (
        reports.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs font-mono text-teal-700 font-bold">Task: {r.taskId || '—'}</p>
                {r.taskTitle && <p className="text-xs text-slate-500 mt-0.5">{r.taskTitle}</p>}
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-mono">{r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}</p>
                {r.measurements && r.measurements.length > 0 && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-[10px] font-bold">{r.measurements.length} đo lường</span>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-3">{r.reportText}</p>
            {r.resultData && Object.keys(r.resultData).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(r.resultData).map(([k, v]) => (
                  <span key={k} className="px-3 py-1 bg-slate-100 rounded-lg text-xs font-mono">
                    <span className="text-slate-500">{k}:</span> <span className="font-bold text-slate-900">{String(v)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

// ── Tech Measurements Tab ──────────────────────────────────────────────────────

const TechMeasurementsTab = () => {
  const { showToast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [batchId, setBatchId] = useState('');
  const [filterBatchId, setFilterBatchId] = useState('');

  const fetchRecords = async (bId) => {
    if (!bId) { setRecords([]); setLoading(false); return; }
    try {
      setLoading(true);
      const data = await measurementRecordsApi.getByBatch(bId);
      setRecords(Array.isArray(data) ? data : []);
    } catch { setRecords([]); } finally { setLoading(false); }
  };

  const handleFilter = () => {
    if (filterBatchId.trim()) fetchRecords(filterBatchId.trim());
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Batch filter */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-700 mb-1">Lọc theo Batch ID</label>
          <input type="text" value={filterBatchId} onChange={e => setFilterBatchId(e.target.value)}
            placeholder="Nhập Batch ID..."
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
        </div>
        <button onClick={handleFilter} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20">Tìm kiếm</button>
      </div>

      {/* Records */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400">Đang tải...</div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
          {filterBatchId ? 'Không có dữ liệu cho Batch này.' : 'Nhập Batch ID để xem lịch sử đo lường.'}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-emerald-50 border-b border-emerald-200">
                <tr>
                  {['Ngày đo', 'Chỉ số', 'Giá trị', 'Đơn vị', 'Giá trị mục tiêu', 'Người đo', 'Ghi chú'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-emerald-700 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-600">{r.measuredAt ? new Date(r.measuredAt).toLocaleString('vi-VN') : '—'}</td>
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
    </div>
  );
};

// ── Tech Farms Tab ─────────────────────────────────────────────────────────────

const TechFarmsTab = () => {
  const { showToast } = useToast();
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFarms = async () => {
      try {
        setLoading(true);
        const data = await farmsApi.getAll();
        setFarms(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) {
          setSelectedFarm(data[0]);
        }
      } catch { setFarms([]); } finally { setLoading(false); }
    };
    fetchFarms();
  }, []);

  useEffect(() => {
    const fetchAreas = async () => {
      if (!selectedFarm?.id) { setAreas([]); return; }
      try {
        const data = await farmsApi.getAreas(selectedFarm.id);
        setAreas(Array.isArray(data) ? data : []);
      } catch { setAreas([]); }
    };
    fetchAreas();
  }, [selectedFarm]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Farm selector */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <label className="block text-xs font-bold text-slate-700 mb-2">Chọn Nông Trại</label>
        <div className="flex gap-3 flex-wrap">
          {farms.map(f => (
            <button key={f.id} onClick={() => setSelectedFarm(f)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                selectedFarm?.id === f.id
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              🌾 {f.farmName || f.farmCode || 'Nông trại'}
            </button>
          ))}
        </div>
      </div>

      {selectedFarm && (
        <>
          {/* Farm info */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-6 text-white shadow-lg">
            <h3 className="font-hanken text-xl font-bold mb-2">{selectedFarm.farmName || 'Nông Trại'}</h3>
            <div className="flex gap-4 text-sm text-emerald-100">
              {selectedFarm.farmCode && <span>Mã: {selectedFarm.farmCode}</span>}
              {selectedFarm.location && <span>📍 {selectedFarm.location}</span>}
              {selectedFarm.description && <span>{selectedFarm.description}</span>}
            </div>
          </div>

          {/* Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {areas.map(area => (
              <AreaCard key={area.id} area={area} />
            ))}
            {areas.length === 0 && (
              <div className="col-span-full bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">Chưa có khu vực nào.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const AreaCard = ({ area }) => {
  const { showToast } = useToast();
  const [beds, setBeds] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (!expanded) {
      try {
        setLoading(true);
        const data = await farmsApi.getBeds(area.id);
        setBeds(Array.isArray(data) ? data : []);
      } catch { setBeds([]); } finally { setLoading(false); }
    }
    setExpanded(!expanded);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-lg">🗺️</div>
        <div className="flex-1 text-left">
          <h4 className="font-hanken font-bold text-sm text-slate-900">{area.areaName || area.name || 'Khu vực'}</h4>
          <p className="text-[10px] text-slate-400 font-mono">{area.areaCode || area.id}</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {expanded && (
        <div className="px-5 pb-4 space-y-2">
          {loading ? (
            <p className="text-xs text-slate-400 text-center py-2">Đang tải luống...</p>
          ) : beds.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-2">Chưa có luống.</p>
          ) : (
            beds.map(bed => (
              <div key={bed.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl text-xs">
                <span className="text-emerald-500">🌱</span>
                <span className="font-semibold text-slate-700">{bed.bedName || bed.bedCode || bed.name || 'Luống'}</span>
                <span className="ml-auto text-slate-400 font-mono">{bed.bedCode || ''}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TechnicianDashboard;
