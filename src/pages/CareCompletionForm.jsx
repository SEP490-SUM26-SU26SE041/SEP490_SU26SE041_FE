import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { taskReportsApi } from '../api/sharedTaskApi';
import { tasksApi } from '../api/sharedTaskApi';
import { canSubmitReport } from '../utils/taskValidation';
import { authLogoutSync } from '../utils/authLogout';

const CareCompletionForm = () => {
  const { showToast } = useToast();
  const [userRole] = useState(() => {
    const path = window.location.pathname;
    return path.includes('technician') ? 'Technician' : 'Student';
  });

  const [form, setForm] = useState({
    taskId: '',
    reportText: '',
  });

  const [careActions, setCareActions] = useState({
    watering: false, fertilizing: false, pruning: false,
    pestControl: false, weeding: false, inspection: false
  });

  const [resultItems, setResultItems] = useState([{ key: '', value: '' }]);
  const [reports, setReports] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const tasks = await tasksApi.getMy();
        setMyTasks(Array.isArray(tasks) ? tasks : []);
        // Đi qua apiClient để hưởng auth + interceptor thống nhất
        const repData = await taskReportsApi.getAll().catch(() => []);
        setReports(Array.isArray(repData) ? repData.slice(0, 10) : []);
      } catch { /* silent */ } finally { setLoading(false); }
    };
    fetchData();
  }, []);

  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

  const toggleCareAction = (key) => {
    setCareActions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.taskId.trim()) { showToast('Vui lòng chọn hoặc nhập Task ID', 'error'); return; }
    if (!form.reportText.trim()) { showToast('Vui lòng nhập nội dung báo cáo', 'error'); return; }

    // P0-#6: Validate task còn active trước khi gửi report (chặn task Cancelled/Rejected)
    const selectedTask = myTasks.find(t => t.id === form.taskId.trim());
    if (!selectedTask) {
      showToast('Không tìm thấy task — vui lòng chọn lại từ danh sách', 'error');
      return;
    }
    const reportCheck = canSubmitReport(selectedTask);
    if (!reportCheck.allowed) {
      showToast(reportCheck.reason, 'error');
      return;
    }

    const selectedActions = Object.entries(careActions)
      .filter(([_, v]) => v).map(([k]) => k);

    const resultDataObj = {};
    resultItems.forEach(r => { if (r.key.trim()) resultDataObj[r.key.trim()] = r.value; });
    if (selectedActions.length > 0) resultDataObj.careActions = selectedActions;

    try {
      setSaving(true);
      await taskReportsApi.create({ taskId: form.taskId.trim(), reportText: form.reportText.trim(), resultData: resultDataObj });
      showToast('Đã gửi báo cáo hoàn thành chăm sóc!', 'success');
      setForm({ taskId: '', reportText: '' });
      setCareActions({ watering: false, fertilizing: false, pruning: false, pestControl: false, weeding: false, inspection: false });
      setResultItems([{ key: '', value: '' }]);

      // Refresh reports qua apiClient (chống race condition nhiều call đồng thời)
      const repData = await taskReportsApi.getAll().catch(() => []);
      setReports(Array.isArray(repData) ? repData.slice(0, 10) : []);
    } catch (err) {
      showToast(err.message || 'Không thể gửi báo cáo', 'error');
    } finally {
      setSaving(false);
    }
  };

  const CareActionBtn = ({ label, icon, name }) => (
    <button type="button" onClick={() => toggleCareAction(name)}
      className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
        careActions[name]
          ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
      }`}>
      <span>{icon}</span> {label}
    </button>
  );

  const updateResult = (idx, field, val) => {
    setResultItems(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 font-sans text-slate-900 fixed inset-0 z-[1000]">
      <SharedSidebar3 userRole={userRole} />

      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider"> Requirement T18</p>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">Đánh Dấu Hoàn Thành Chăm Sóc</h1>
            <p className="text-sm text-slate-500 mt-1">Ghi nhận và xác nhận các công việc chăm sóc đã thực hiện.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-8 space-y-6">
            {/* Task ID */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Task ID <span className="text-rose-500">*</span></label>
                <div className="flex gap-2">
                  <input type="text" value={form.taskId} onChange={e => setForm(f => ({ ...f, taskId: e.target.value }))}
                    placeholder="VD: task-guid hoặc chọn bên dưới"
                    className="flex-1 w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900" />
                  <button type="button" onClick={() => setShowTaskPicker(!showTaskPicker)}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-sm font-semibold text-slate-600 transition-all">
                    📋 Chọn Task
                  </button>
                </div>
                {showTaskPicker && (
                  <div className="mt-2 max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50">
                    {myTasks.filter(t => t.status === 'Pending' || t.status === 'InProgress').length === 0 ? (
                      <p className="p-3 text-xs text-slate-400 text-center">Không có task đang chờ/xử lý</p>
                    ) : (
                      myTasks.filter(t => t.status === 'Pending' || t.status === 'InProgress').map(t => (
                        <button type="button" key={t.id} onClick={() => { setForm(f => ({ ...f, taskId: t.id })); setShowTaskPicker(false); }}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors">
                          <p className="text-xs font-semibold text-slate-900 truncate">{t.title || '—'}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{t.id}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Ngày Thực Hiện</label>
                <input type="date" value={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900" />
              </div>
            </div>

            {/* Care Actions */}
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-3">Công Việc Chăm Sóc Đã Thực Hiện <span className="text-rose-500">*</span></h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <CareActionBtn label="Tưới nước" icon="💧" name="watering" />
                <CareActionBtn label="Bón phân" icon="🧪" name="fertilizing" />
                <CareActionBtn label="Cắt tỉa" icon="✂️" name="pruning" />
                <CareActionBtn label="Phòng trừ sâu" icon="🐛" name="pestControl" />
                <CareActionBtn label="Nhổ cỏ" icon="🌱" name="weeding" />
                <CareActionBtn label="Kiểm tra" icon="🔍" name="inspection" />
              </div>
            </div>

            {/* Report Text */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nội Dung Báo Cáo <span className="text-rose-500">*</span></label>
              <textarea value={form.reportText} onChange={e => setForm(f => ({ ...f, reportText: e.target.value }))}
                placeholder="Mô tả chi tiết công việc đã thực hiện, kết quả, và các quan sát..."
                rows={5}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 resize-none" />
            </div>

            {/* Result Data */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Dữ Liệu Kết Quả (tùy chọn)</label>
              <div className="space-y-2">
                {resultItems.map((r, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input type="text" value={r.key} placeholder="Trường (VD: lượng nước, thời gian)"
                      onChange={e => updateResult(idx, 'key', e.target.value)}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm" />
                    <input type="text" value={r.value} placeholder="Giá trị (VD: 500 lít, 45 phút)"
                      onChange={e => updateResult(idx, 'value', e.target.value)}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm" />
                    {resultItems.length > 1 && (
                      <button type="button" onClick={() => setResultItems(prev => prev.filter((_, i) => i !== idx))}
                        className="px-3 text-rose-500 hover:text-rose-700 font-bold">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setResultItems(prev => [...prev, { key: '', value: '' }])}
                className="mt-2 text-xs text-blue-600 font-semibold hover:underline">+ Thêm trường dữ liệu</button>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button type="button" onClick={() => {
                setForm({ taskId: '', reportText: '' });
                setCareActions({ watering: false, fertilizing: false, pruning: false, pestControl: false, weeding: false, inspection: false });
                setResultItems([{ key: '', value: '' }]);
              }}
                className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition">
                Xóa Form
              </button>
              <button type="submit" disabled={saving}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50">
                {saving ? 'Đang gửi...' : '✅ Gửi Báo Cáo'}
              </button>
            </div>
          </form>

          {/* Recent reports */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Báo Cáo Gần Đây</h2>
            {loading ? (
              <p className="text-sm text-slate-400 text-center py-4">Đang tải...</p>
            ) : reports.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Chưa có báo cáo nào.</p>
            ) : (
              <div className="space-y-3">
                {reports.map(r => (
                  <div key={r.id} className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-mono text-green-700 font-bold">Task: {r.taskId || r.id}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : '—'}
                      </p>
                    </div>
                    <p className="text-sm text-slate-700">{r.reportText}</p>
                    {r.resultData && Object.keys(r.resultData).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(r.resultData).map(([k, v]) => (
                          <span key={k} className="px-2 py-0.5 bg-green-200 text-green-800 rounded-full text-[10px] font-bold capitalize">
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

const SharedSidebar3 = ({ userRole }) => {
  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };
  const currentPage = window.location.pathname;
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
        <button onClick={() => authLogoutSync()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 text-sm font-medium transition-all">
          <span className="text-base">🚪</span> Đăng Xuất
        </button>
      </div>
    </aside>
  );
};

export default CareCompletionForm;
