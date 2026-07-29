import React, { useEffect, useState } from 'react';
import { experimentRequestsApi } from '../../../api/experimentApi';
import { farmsApi } from '../../../api/managerResourcesApi';
import { experimentsApi } from '../../../api/experimentApi';
import { useToast } from '../../../context/ToastContext';
import { Modal } from '../../farm-manager/components/ui';
import { useConfirm, ConfirmDialog } from '../../../components/common/ConfirmDialog';

const STATUS_FILTERS = [
  { value: '', label: 'Tất Cả' },
  { value: 'Pending', label: 'Chờ Duyệt' },
  { value: 'Approved', label: 'Đã Duyệt' },
  { value: 'Rejected', label: 'Từ Chối' },
  { value: 'Cancelled', label: 'Đã Hủy' }
];

const ResearcherRequests = ({ onConvertToExperiment }) => {
  const { showToast } = useToast();
  const { ask: askConfirm, state: confirmState, handleClose: closeConfirm } = useConfirm();
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
    monitoringPlan: {
      groups: '',
      expectedBeds: '',
      replications: '',
      expectedPlants: '',
      monitoring: {
        temperature: { min: '', max: '' },
        humidity: { min: '', max: '' },
        soilMoisture: { min: '', max: '' }
      }
    }
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
    if (!form.farmId || form.farmId.length !== 36) errs.farmId = 'Vui lòng chọn nông trại';
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
      const payload = {
        farmId: form.farmId,
        title: form.title.trim(),
        objective: form.objective.trim()
      };
      if (form.expectedStartDate) payload.expectedStartDate = form.expectedStartDate;
      if (form.expectedEndDate) payload.expectedEndDate = form.expectedEndDate;

      const mp = form.monitoringPlan;
      const hasMonData = mp.groups || mp.expectedBeds || mp.replications || mp.expectedPlants ||
        mp.monitoring.temperature.min || mp.monitoring.temperature.max ||
        mp.monitoring.humidity.min || mp.monitoring.humidity.max ||
        mp.monitoring.soilMoisture.min || mp.monitoring.soilMoisture.max;
      if (hasMonData) {
        payload.monitoringPlan = JSON.stringify({
          groups: mp.groups ? Number(mp.groups) : undefined,
          expectedBeds: mp.expectedBeds ? Number(mp.expectedBeds) : undefined,
          replications: mp.replications ? Number(mp.replications) : undefined,
          expectedPlants: mp.expectedPlants ? Number(mp.expectedPlants) : undefined,
          monitoring: {
            temperature: {
              min: mp.monitoring.temperature.min ? Number(mp.monitoring.temperature.min) : undefined,
              max: mp.monitoring.temperature.max ? Number(mp.monitoring.temperature.max) : undefined
            },
            humidity: {
              min: mp.monitoring.humidity.min ? Number(mp.monitoring.humidity.min) : undefined,
              max: mp.monitoring.humidity.max ? Number(mp.monitoring.humidity.max) : undefined
            },
            soilMoisture: {
              min: mp.monitoring.soilMoisture.min ? Number(mp.monitoring.soilMoisture.min) : undefined,
              max: mp.monitoring.soilMoisture.max ? Number(mp.monitoring.soilMoisture.max) : undefined
            }
          }
        });
      }

      await experimentRequestsApi.create(payload);
      showToast('Đã gửi yêu cầu thí nghiệm thành công!', 'success');
      setShowCreate(false);
      setForm({ farmId: '', title: '', objective: '', expectedStartDate: '', expectedEndDate: '', monitoringPlan: { groups: '', expectedBeds: '', replications: '', expectedPlants: '', monitoring: { temperature: { min: '', max: '' }, humidity: { min: '', max: '' }, soilMoisture: { min: '', max: '' } } } });
      setFormErrors({});
      fetchRequests();
    } catch (err) {
      showToast(err.message || 'Không thể tạo yêu cầu', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleConvertToExperiment = (request) => {
    if (onConvertToExperiment) {
      onConvertToExperiment(request);
    } else {
      // Fallback: gọi trực tiếp API nếu không có callback
      const run = async () => {
        const ok = await askConfirm({ title: 'Tạo thí nghiệm', message: 'Tạo thí nghiệm từ yêu cầu này?', confirmText: 'Tạo thí nghiệm', variant: 'primary' });
        if (!ok) return;
        try {
          const result = await experimentsApi.createFromRequest(request.id);
          showToast(`Đã tạo thí nghiệm: ${result?.experimentCode || 'thành công'}`, 'success');
          fetchRequests();
        } catch (err) {
          showToast(err.message || 'Không thể tạo thí nghiệm', 'error');
        }
      };
      run();
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
                          <button onClick={() => handleConvertToExperiment(req)}
                            className="text-emerald-600 font-bold text-[10px] uppercase hover:underline whitespace-nowrap">
                            Tạo TN
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

      <ConfirmDialog state={confirmState} onClose={closeConfirm} />

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
          {/* Kế hoạch thực hiện */}
          <div className="border border-indigo-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            {/* Header with icon + summary */}
            <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl">
                  📋
                </div>
                <div>
                  <p className="text-sm font-bold">Kế Hoạch Thực Hiện</p>
                  <p className="text-[10px] opacity-80">Quy mô thí nghiệm & ngưỡng giám sát môi trường</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full">
                Tùy chọn
              </span>
            </div>

            {/* Section 1: Quy mô thí nghiệm */}
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                  1
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Quy Mô Thí Nghiệm</p>
                  <p className="text-[10px] text-slate-500">Số lượng nhóm, luống, lần lặp và cây dự kiến</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'groups', label: 'Số Nhóm', icon: '🔢', placeholder: 'VD: 1', unit: 'nhóm' },
                  { key: 'expectedBeds', label: 'Số Luống', icon: '🛏️', placeholder: 'VD: 1', unit: 'luống' },
                  { key: 'replications', label: 'Lần Lặp', icon: '🔁', placeholder: 'VD: 1', unit: 'lần' },
                  { key: 'expectedPlants', label: 'Cây Dự Kiến', icon: '🌱', placeholder: 'VD: 180', unit: 'cây' },
                ].map(f => (
                  <div key={f.key} className="relative">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1">
                      <span>{f.icon}</span> {f.label}
                    </label>
                    <div className="relative">
                      <input type="number" min="1" value={form.monitoringPlan[f.key]} onChange={e => setForm(fr => ({ ...fr, monitoringPlan: { ...fr.monitoringPlan, [f.key]: e.target.value } }))}
                        placeholder={f.placeholder}
                        className="w-full pl-3 pr-12 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white transition-all" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">{f.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Ngưỡng giám sát */}
            <div className="p-5 bg-slate-50/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                  2
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Ngưỡng Giám Sát Môi Trường</p>
                  <p className="text-[10px] text-slate-500">Khoảng cho phép của các chỉ số môi trường</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { key: 'temperature', label: 'Nhiệt Độ', icon: '🌡️', color: 'rose', unit: '°C', path: 'monitoring.temperature' },
                  { key: 'humidity', label: 'Độ Ẩm Không Khí', icon: '💧', color: 'sky', unit: '%', path: 'monitoring.humidity' },
                  { key: 'soilMoisture', label: 'Độ Ẩm Đất', icon: '🪴', color: 'amber', unit: '%', path: 'monitoring.soilMoisture' },
                ].map(item => {
                  const [parent, child] = item.path.split('.');
                  const minVal = form.monitoringPlan[parent][child].min;
                  const maxVal = form.monitoringPlan[parent][child].max;
                  const colorMap = {
                    rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', pill: 'bg-rose-100 text-rose-700' },
                    sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', pill: 'bg-sky-100 text-sky-700' },
                    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', pill: 'bg-amber-100 text-amber-700' },
                  };
                  const c = colorMap[item.color];
                  return (
                    <div key={item.key} className={`${c.bg} border ${c.border} rounded-xl p-3.5 transition-all hover:shadow-sm`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{item.icon}</span>
                          <div>
                            <p className={`text-xs font-bold ${c.text}`}>{item.label}</p>
                            <p className="text-[9px] text-slate-500 font-mono">{item.key}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.pill}`}>{item.unit}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Tối thiểu</label>
                          <input type="number" value={minVal} onChange={e => {
                            setForm(f => ({ ...f, monitoringPlan: { ...f.monitoringPlan, [parent]: { ...f.monitoringPlan[parent], [child]: { ...f.monitoringPlan[parent][child], min: e.target.value } } } }));
                          }}
                            placeholder="Min"
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white" />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Tối đa</label>
                          <input type="number" value={maxVal} onChange={e => {
                            setForm(f => ({ ...f, monitoringPlan: { ...f.monitoringPlan, [parent]: { ...f.monitoringPlan[parent], [child]: { ...f.monitoringPlan[parent][child], max: e.target.value } } } }));
                          }}
                            placeholder="Max"
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white" />
                        </div>
                      </div>
                      {minVal && maxVal && Number(minVal) >= Number(maxVal) && (
                        <p className="text-[9px] text-rose-600 font-bold mt-1.5 flex items-center gap-1">
                          <span>⚠️</span> Min phải nhỏ hơn Max
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
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
