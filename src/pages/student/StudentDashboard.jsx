import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { tasksApi, taskReportsApi } from '../../api/sharedTaskApi';
import { farmsApi, cropsApi, experimentsApi } from '../../api/studentTechApi';

const STU_TABS = [
  { id: 'overview', label: 'Tổng Quan', icon: '🏠' },
  { id: 'tasks', label: 'Công Việc', icon: '📋' },
  { id: 'reports', label: 'Báo Cáo', icon: '📝' },
  { id: 'morphology', label: 'Ghi Nhận', icon: '📊' },
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
              {activeTab === 'farms' && 'Thông tin nông trại'}
            </p>
          </div>

          {activeTab === 'overview' && <StudentOverview setActiveTab={setActiveTab} />}
          {activeTab === 'tasks' && <StudentTasksTab />}
          {activeTab === 'reports' && <StudentReportsTab />}
          {activeTab === 'morphology' && <StudentMorphologySection setActiveTab={setActiveTab} />}
          {activeTab === 'farms' && <StudentFarmsTab />}
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

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const data = await taskReportsApi.getByTask(task.id);
        setReports(Array.isArray(data) ? data : []);
      } catch { setReports([]); } finally { setLoading(false); }
    };
    fetchReports();
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
    } catch (err) { showToast(err.message || 'Lỗi gửi báo cáo', 'error'); }
    finally { setSaving(false); }
  };

  const updateResult = (idx, field, value) => {
    setResultData(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const statusColors = STATUS_COLORS[task.status] || 'bg-slate-100 text-slate-600';
  const statusLabel = { Pending: 'Chờ', InProgress: 'Đang Làm', Completed: 'Hoàn Thành', Overdue: 'Quá Hạn' }[task.status] || task.status;

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
              { label: 'Trạng thái', value: statusLabel },
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
            <h4 className="font-bold text-sm text-slate-900 mb-3">📝 Gửi Báo Cáo Học Tập</h4>
            <form onSubmit={handleSubmitReport} className="space-y-3">
              <textarea value={reportText} onChange={e => setReportText(e.target.value)} rows={3}
                placeholder="Mô tả kết quả quan sát và học tập của bạn..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              <div className="space-y-1">
                {resultData.map((r, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input type="text" value={r.key} placeholder="Key (VD: plantsObserved)"
                      onChange={e => updateResult(idx, 'key', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <input type="text" value={r.value} placeholder="Giá trị"
                      onChange={e => updateResult(idx, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    {resultData.length > 1 && (
                      <button type="button" onClick={() => setResultData(prev => prev.filter((_, i) => i !== idx))} className="text-rose-500 font-bold">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setResultData(prev => [...prev, { key: '', value: '' }])} className="text-xs text-blue-600 font-semibold hover:underline">+ Thêm dữ liệu</button>
              <button type="submit" disabled={saving}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50">
                {saving ? 'Đang gửi...' : 'Gửi Báo Cáo'}
              </button>
            </form>
          </div>

          {/* Reports */}
          {reports.length > 0 && (
            <div className="border-t border-slate-200 pt-6">
              <h4 className="font-bold text-sm text-slate-900 mb-3">Báo Cáo Đã Gửi ({reports.length})</h4>
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
        </div>
      </div>
    </div>
  );
};

// ── Student Morphology Section ─────────────────────────────────────────────────

const StudentMorphologySection = ({ setActiveTab }) => (
  <div className="animate-fade-in space-y-6">
    <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-6 text-white shadow-lg">
      <h3 className="font-hanken text-xl font-bold mb-2">Ghi Nhận Dữ Liệu Hình Thái</h3>
      <p className="text-indigo-100 text-sm">Thu thập các chỉ số sinh học định tính của cây trồng mà cảm biến IoT không thể đo được.</p>
    </div>
    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
      <p className="text-slate-500 mb-4">Mở trang T19 để ghi nhận dữ liệu hình thái học.</p>
      <button onClick={() => window.history.pushState(null, '', '/student/morphology-entry')}
        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all">
        📊 Mở Ghi Nhận Hình Thái (T19)
      </button>
    </div>
  </div>
);

// ── Student Reports Tab ────────────────────────────────────────────────────────

const StudentReportsTab = () => {
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
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">Chưa có báo cáo nào.</div>
      ) : (
        reports.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-xs font-mono text-blue-700 font-bold">Task: {r.taskId || '—'}</p>
                {r.taskTitle && <p className="text-xs text-slate-500 mt-0.5">{r.taskTitle}</p>}
              </div>
              <p className="text-[10px] text-slate-400 font-mono">{r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}</p>
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

// ── Student Farms Tab ─────────────────────────────────────────────────────────

const StudentFarmsTab = () => {
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
        if (Array.isArray(data) && data.length > 0) setSelectedFarm(data[0]);
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
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
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
            <div className="flex gap-4 text-sm text-emerald-100 flex-wrap">
              {selectedFarm.farmCode && <span>Mã: {selectedFarm.farmCode}</span>}
              {selectedFarm.location && <span>📍 {selectedFarm.location}</span>}
              {selectedFarm.description && <span>{selectedFarm.description}</span>}
            </div>
          </div>

          {/* Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {areas.map(area => (
              <StudentAreaCard key={area.id} area={area} />
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

const StudentAreaCard = ({ area }) => {
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

export default StudentDashboard;
