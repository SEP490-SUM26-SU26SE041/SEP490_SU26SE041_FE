import React, { useEffect, useState } from 'react';
import { experimentRequestsApi } from '../../../api/experimentApi';
import { farmsApi } from '../../../api/managerResourcesApi';
import { experimentsApi } from '../../../api/experimentApi';
import { useToast } from '../../../context/ToastContext';
import { Modal } from '../../farm-manager/components/ui';

const STATUS_FILTERS = [
  { value: '', label: 'Tất Cả' },
  { value: 'Pending', label: 'Chờ Duyệt' },
  { value: 'Approved', label: 'Đã Duyệt' },
  { value: 'Rejected', label: 'Từ Chối' },
  { value: 'Cancelled', label: 'Đã Hủy' }
];

const ResearcherRequests = () => {
  const { showToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [filterFarm, setFilterFarm] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    farmId: '',
    title: '',
    objective: '',
    expectedStartDate: '',
    expectedEndDate: '',
    monitoringPlan: ''
  });
  const [formErrors, setFormErrors] = useState({});

  const fetchFarms = async () => {
    try {
      const data = await farmsApi.getAll();
      setFarms(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter) params.status = filter;
      const data = await experimentRequestsApi.getAll(params);
      let list = Array.isArray(data) ? data : [];
      if (filterFarm) list = list.filter(r => r.farmId === filterFarm);
      setRequests(list);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách yêu cầu', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFarms(); }, []);
  useEffect(() => { fetchRequests(); }, [filter]);

  const validateForm = () => {
    const errs = {};
    if (!form.farmId) errs.farmId = 'Vui lòng chọn nông trại';
    if (!form.title.trim()) errs.title = 'Tiêu đề không được để trống';
    else if (form.title.trim().length < 5) errs.title = 'Tiêu đề phải có ít nhất 5 ký tự';
    if (!form.objective.trim()) errs.objective = 'Mục tiêu không được để trống';
    else if (form.objective.trim().length < 10) errs.objective = 'Mục tiêu phải có ít nhất 10 ký tự';
    if (form.expectedStartDate && form.expectedEndDate && form.expectedEndDate <= form.expectedStartDate)
      errs.expectedEndDate = 'Ngày kết thúc phải sau ngày bắt đầu';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setCreating(true);
      const payload = { ...form };
      if (!payload.expectedStartDate) delete payload.expectedStartDate;
      if (!payload.expectedEndDate) delete payload.expectedEndDate;
      if (!payload.monitoringPlan) delete payload.monitoringPlan;
      await experimentRequestsApi.create(payload);
      showToast('Đã gửi yêu cầu thí nghiệm thành công!', 'success');
      setShowCreate(false);
      setForm({ farmId: '', title: '', objective: '', expectedStartDate: '', expectedEndDate: '', monitoringPlan: '' });
      setFormErrors({});
      fetchRequests();
    } catch (err) {
      showToast(err.message || 'Không thể tạo yêu cầu', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Hủy yêu cầu này?')) return;
    try {
      await experimentRequestsApi.remove(id);
      showToast('Đã hủy yêu cầu', 'success');
      fetchRequests();
    } catch (err) {
      showToast(err.message || 'Không thể hủy yêu cầu', 'error');
    }
  };

  const handleConvertToExperiment = async (requestId) => {
    if (!window.confirm('Tạo thí nghiệm từ yêu cầu này?')) return;
    try {
      const result = await experimentsApi.createFromRequest(requestId);
      showToast(`Đã tạo thí nghiệm: ${result?.experimentCode || 'thành công'}`, 'success');
      fetchRequests();
    } catch (err) {
      showToast(err.message || 'Không thể tạo thí nghiệm', 'error');
    }
  };

  const statusColors = {
    Pending: 'bg-amber-100 text-amber-700',
    Approved: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-rose-100 text-rose-700',
    Cancelled: 'bg-slate-100 text-slate-600'
  };

  const statusBg = {
    Pending: 'bg-amber-50 border-amber-200',
    Approved: 'bg-emerald-50 border-emerald-200',
    Rejected: 'bg-rose-50 border-rose-200',
    Cancelled: 'bg-slate-50 border-slate-200'
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + Create button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">Yêu cầu thí nghiệm đã gửi</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Gửi Yêu Cầu Mới
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-on-surface-variant mb-1">Trạng Thái</label>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
            {STATUS_FILTERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-on-surface-variant mb-1">Nông Trại</label>
          <select value={filterFarm} onChange={e => setFilterFarm(e.target.value)}
            className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
            <option value="">Tất Cả Nông Trại</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.farmName}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-outline-variant">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tiêu Đề</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Nông Trại</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Trạng Thái</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Bắt Đầu Dự Kiến</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Kết Thúc Dự Kiến</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-sm text-on-surface-variant">Đang tải...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-sm text-on-surface-variant">Chưa có yêu cầu nào.</td></tr>
              ) : (
                requests.map(req => (
                  <tr key={req.id} className={`hover:bg-surface-container/30 transition-colors border-l-4 ${statusBg[req.status] || ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-sm text-on-surface line-clamp-1">{req.title || '—'}</div>
                      {req.objective && <div className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{req.objective}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{req.farmName || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${statusColors[req.status] || 'bg-slate-100 text-slate-600'}`}>
                        {req.status || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">{req.expectedStartDate || '—'}</td>
                    <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">{req.expectedEndDate || '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {req.status === 'Approved' && (
                          <button onClick={() => handleConvertToExperiment(req.id)}
                            className="text-emerald-600 font-bold text-[10px] uppercase hover:underline whitespace-nowrap">
                            Tạo TN
                          </button>
                        )}
                        {req.status === 'Pending' && (
                          <button onClick={() => handleCancel(req.id)}
                            className="text-rose-600 font-bold text-[10px] uppercase hover:underline whitespace-nowrap">
                            Hủy
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setFormErrors({}); }} title="Gửi Yêu Cầu Thí Nghiệm" width="max-w-2xl">
        <form onSubmit={handleCreate} className="space-y-4 p-6">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">Nông Trại <span className="text-rose-500">*</span></label>
            <select value={form.farmId} onChange={e => setForm(f => ({ ...f, farmId: e.target.value }))}
              className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${formErrors.farmId ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`}>
              <option value="">— Chọn nông trại —</option>
              {farms.map(f => <option key={f.id} value={f.id}>{f.farmName}</option>)}
            </select>
            {formErrors.farmId && <p className="text-xs text-rose-600 mt-1">{formErrors.farmId}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">Tiêu Đề Yêu Cầu <span className="text-rose-500">*</span></label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="VD: Thử nghiệm giống lúa ST25 mùa đông"
              className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${formErrors.title ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`} />
            {formErrors.title && <p className="text-xs text-rose-600 mt-1">{formErrors.title}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">Mục Tiêu Thí Nghiệm <span className="text-rose-500">*</span></label>
            <textarea value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
              placeholder="Mô tả mục tiêu cụ thể của thí nghiệm..."
              rows={3}
              className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none ${formErrors.objective ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`} />
            {formErrors.objective && <p className="text-xs text-rose-600 mt-1">{formErrors.objective}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Ngày Bắt Đầu Dự Kiến</label>
              <input type="date" value={form.expectedStartDate} onChange={e => setForm(f => ({ ...f, expectedStartDate: e.target.value }))}
                className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Ngày Kết Thúc Dự Kiến</label>
              <input type="date" value={form.expectedEndDate} onChange={e => setForm(f => ({ ...f, expectedEndDate: e.target.value }))}
                className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${formErrors.expectedEndDate ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`} />
              {formErrors.expectedEndDate && <p className="text-xs text-rose-600 mt-1">{formErrors.expectedEndDate}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">Kế Hoạch Theo Dõi</label>
            <textarea value={form.monitoringPlan} onChange={e => setForm(f => ({ ...f, monitoringPlan: e.target.value }))}
              placeholder="VD: Đo chiều cao cây, số bông, năng suất/ha..."
              rows={2}
              className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowCreate(false); setFormErrors({}); }}
              className="px-5 py-2.5 border border-outline-variant rounded-xl text-sm font-medium hover:bg-surface-container/50 transition-all">
              Hủy
            </button>
            <button type="submit" disabled={creating}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50">
              {creating ? 'Đang gửi...' : 'Gửi Yêu Cầu'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ResearcherRequests;
