import React, { useEffect, useState } from 'react';
import { experimentRequestsApi } from '../../../api/experimentApi';
import { farmsApi } from '../../../api/managerResourcesApi';
import { experimentsApi } from '../../../api/experimentApi';
import { cropsApi } from '../../../api/cropApi';
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
  const [detailReq, setDetailReq] = useState(null); // chi tiết yêu cầu
  const [detailLoading, setDetailLoading] = useState(false);
  // Modal tạo Experiment từ Request (đã được Approved)
  const [createExperiment, setCreateExperiment] = useState({ open: false, request: null, reservedBeds: [], loading: false, submitting: false, error: null });

  // Modal tạo Experiment thủ công (từ request Approved - tạo qua POST /experiments)
  const [manualCreate, setManualCreate] = useState({ open: false, request: null, submitting: false, error: null });
  const [manualForm, setManualForm] = useState({
    title: '', experimentCode: '', farmId: '', cropVarietyId: '', objective: '', hypothesis: '', startDate: '', endDate: ''
  });
  const [manualFormErrors, setManualFormErrors] = useState({});
  const [cropVarieties, setCropVarieties] = useState([]);
  // Dropdowns: Crops / Varieties / ProcedureTemplates (theo spec line 188-197)
  const [crops, setCrops] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loadingCrops, setLoadingCrops] = useState(false);
  const [loadingVarieties, setLoadingVarieties] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [quickCreating, setQuickCreating] = useState(false);
  const [form, setForm] = useState({
    farmId: '',
    cropId: '',
    cropVarietyId: '',
    procedureTemplateId: '',
    title: '',
    objective: '',
    expectedStartDate: '',
    expectedEndDate: '',
    monitoringPlan: {
      designType: 'RandomizedCompleteBlock',
      replicationCount: 3,
      randomizationMethod: 'Fisher-Yates',
      treatments: [
        { name: 'Control', description: 'Không bón phân', groupType: 'Control' },
        { name: 'Treatment 1', description: '', groupType: 'Treatment' }
      ]
    }
  });
  const [formErrors, setFormErrors] = useState({});

  const fetchFarms = async () => {
    try {
      const data = await farmsApi.getAll();
      setFarms(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  };

  // Load danh sách crops (1 lần)
  const fetchCrops = async () => {
    try {
      setLoadingCrops(true);
      const data = await cropsApi.getAll();
      setCrops(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setLoadingCrops(false); }
  };

  // Load varieties khi chọn cropId
  const fetchVarieties = async (cropId) => {
    if (!cropId) { setVarieties([]); return; }
    try {
      setLoadingVarieties(true);
      const data = await cropsApi.getVarieties(cropId);
      setVarieties(Array.isArray(data) ? data : []);
    } catch { showToast('Không thể tải giống cây', 'error'); setVarieties([]); }
    finally { setLoadingVarieties(false); }
  };

  // Load procedure templates khi chọn cropVarietyId (filter theo variety)
  const fetchTemplates = async (cropVarietyId) => {
    if (!cropVarietyId) { setTemplates([]); return; }
    try {
      setLoadingTemplates(true);
      const params = { cropVarietyId };
      const data = await experimentsApi.getProcedureTemplates(params);
      setTemplates(Array.isArray(data) ? data : []);
    } catch { showToast('Không thể tải quy trình', 'error'); setTemplates([]); }
    finally { setLoadingTemplates(false); }
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

  useEffect(() => { fetchFarms(); fetchCrops(); }, []);
  useEffect(() => { fetchRequests(); }, [filter]);

  const validateForm = () => {
    const errs = {};
    if (!form.farmId || form.farmId.length !== 36) errs.farmId = 'Vui lòng chọn nông trại';
    if (!form.cropId) errs.cropId = 'Vui lòng chọn loại cây trồng';
    if (!form.cropVarietyId) errs.cropVarietyId = 'Vui lòng chọn giống cây';
    if (!form.procedureTemplateId) errs.procedureTemplateId = 'Vui lòng chọn quy trình';
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
        cropVarietyId: form.cropVarietyId,
        procedureTemplateId: form.procedureTemplateId,
        title: form.title.trim(),
        objective: form.objective.trim()
      };
      if (form.expectedStartDate) payload.expectedStartDate = form.expectedStartDate;
      if (form.expectedEndDate) payload.expectedEndDate = form.expectedEndDate;

      const mp = form.monitoringPlan;
      // Normalize treatments: bỏ treatment rỗng, chuẩn hoá groupType về string 'Control'/'Treatment'
      // Chấp nhận cả: số 1/2, string 'Control'/'Treatment', '1'/'2'
      const normalizeGroupType = (gt) => {
        if (gt === 1 || gt === '1' || gt === 'Control') return 'Control';
        return 'Treatment';
      };
      const cleanTreatments = (mp.treatments || [])
        .filter(t => t.name && t.name.trim())
        .map(t => ({
          name: t.name.trim(),
          description: (t.description || '').trim(),
          groupType: normalizeGroupType(t.groupType)
        }));
      // Validation: replicationCount >= 2, cần ít nhất 1 treatment
      const repCount = Number(mp.replicationCount) || 0;
      if (repCount < 2) {
        showToast('Số lần lặp phải >= 2', 'error');
        return;
      }
      if (cleanTreatments.length === 0) {
        showToast('Cần ít nhất 1 treatment', 'error');
        return;
      }
      payload.monitoringPlan = JSON.stringify({
        designType: mp.designType || 'CompletelyRandomized',
        replicationCount: repCount,
        randomizationMethod: (mp.randomizationMethod || '').trim() || 'CompletelyRandomized',
        treatments: cleanTreatments
      });

      await experimentRequestsApi.create(payload);
      showToast('Đã gửi yêu cầu thí nghiệm thành công!', 'success');
      setShowCreate(false);
      setForm({ farmId: '', cropId: '', cropVarietyId: '', procedureTemplateId: '', title: '', objective: '', expectedStartDate: '', expectedEndDate: '', monitoringPlan: { designType: 'RandomizedCompleteBlock', replicationCount: 3, randomizationMethod: 'Fisher-Yates', treatments: [{ name: 'Control', description: 'Không bón phân', groupType: 'Control' }, { name: 'Treatment 1', description: '', groupType: 'Treatment' }] } });
      setVarieties([]);
      setTemplates([]);
      setFormErrors({});
      fetchRequests();
    } catch (err) {
      showToast(err.message || 'Không thể tạo yêu cầu', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Parse monitoringPlan từ JSON string
  const parseMonitoringPlan = (mp) => {
    if (!mp) return null;
    if (typeof mp === 'object') return mp;
    try { return JSON.parse(mp); } catch { return null; }
  };

  // Mở chi tiết request - load đầy đủ reviews[]
  const openDetail = async (req) => {
    setDetailReq({ ...req, loadingReviews: true });
    try {
      const full = await experimentRequestsApi.getById(req.id);
      setDetailReq({ ...full, loadingReviews: false });
    } catch (err) {
      setDetailReq({ ...req, loadingReviews: false });
    }
  };

  // Tạo nhanh Experiment từ Request (gọi thẳng POST /experiments/from-request/:id)
  const handleQuickConvert = async (request) => {
    if (!request?.id) return;
    try {
      setQuickCreating(true);
      showToast(`Đang tạo thí nghiệm từ yêu cầu ${request.id.slice(0, 8)}...`, 'info');
      const result = await experimentsApi.createFromRequest(request.id);
      const code = result?.experimentCode || result?.data?.experimentCode || 'thành công';
      showToast(`Đã tạo thực nghiệm: ${code}`, 'success');
      fetchRequests();
    } catch (err) {
      showToast(err.message || 'Không thể tạo thực nghiệm', 'error');
    } finally {
      setQuickCreating(false);
    }
  };

  const handleConvertToExperiment = (request) => {
    if (onConvertToExperiment) {
      onConvertToExperiment(request);
      return;
    }
    // Mở modal review thông tin + reserved beds trước khi tạo Experiment
    setCreateExperiment({ open: true, request, reservedBeds: [], loading: true, submitting: false, error: null });
    // Load song song: full request detail + reserved beds
    Promise.allSettled([
      experimentRequestsApi.getById(request.id).catch(() => request),
      experimentRequestsApi.getReservedBeds(request.id).catch(() => [])
    ]).then(([reqRes, bedsRes]) => {
      const fullReq = reqRes.status === 'fulfilled' ? reqRes.value : request;
      const beds = bedsRes.status === 'fulfilled' ? (Array.isArray(bedsRes.value) ? bedsRes.value : (bedsRes.value?.reservedBeds || [])) : [];
      setCreateExperiment(prev => ({ ...prev, request: fullReq, reservedBeds: beds, loading: false }));
    });
  };

  const closeCreateExperiment = () => {
    if (createExperiment.submitting) return;
    setCreateExperiment({ open: false, request: null, reservedBeds: [], loading: false, submitting: false, error: null });
  };

  const submitCreateExperiment = async () => {
    const { request } = createExperiment;
    if (!request?.id) return;
    try {
      setCreateExperiment(prev => ({ ...prev, submitting: true, error: null }));
      const result = await experimentsApi.createFromRequest(request.id);
      const code = result?.experimentCode || result?.data?.experimentCode || 'thành công';
      showToast(`Đã tạo thực nghiệm: ${code}`, 'success');
      setCreateExperiment({ open: false, request: null, reservedBeds: [], loading: false, submitting: false, error: null });
      fetchRequests();
    } catch (err) {
      setCreateExperiment(prev => ({ ...prev, submitting: false, error: err.message || 'Không thể tạo thực nghiệm' }));
      showToast(err.message || 'Không thể tạo thực nghiệm', 'error');
    }
  };

  // ── Manual Create Experiment (POST /experiments) ────────────────────────────
  const fetchCropVarieties = async () => {
    try {
      const data = await cropsApi.getAll();
      setCropVarieties(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  };

  const openManualCreate = async (request) => {
    // Prefill từ request
    setManualForm({
      title: request.title || '',
      experimentCode: `EXP-${Date.now().toString().slice(-6)}`,
      farmId: request.farmId || '',
      cropVarietyId: '',
      objective: request.objective || '',
      hypothesis: '',
      startDate: request.expectedStartDate || '',
      endDate: request.expectedEndDate || ''
    });
    setManualFormErrors({});
    setManualCreate({ open: true, request, submitting: false, error: null });
    if (cropVarieties.length === 0) fetchCropVarieties();
  };

  const closeManualCreate = () => {
    if (manualCreate.submitting) return;
    setManualCreate({ open: false, request: null, submitting: false, error: null });
  };

  const submitManualCreate = async (e) => {
    if (e) e.preventDefault();
    const errs = {};
    if (!manualForm.farmId) errs.farmId = 'Vui lòng chọn nông trại';
    if (!manualForm.title.trim() || manualForm.title.trim().length < 5) errs.title = 'Tiêu đề phải có ít nhất 5 ký tự';
    if (!manualForm.objective.trim() || manualForm.objective.trim().length < 10) errs.objective = 'Mục tiêu phải có ít nhất 10 ký tự';
    if (Object.keys(errs).length > 0) {
      setManualFormErrors(errs);
      return;
    }
    setManualFormErrors({});
    try {
      setManualCreate(prev => ({ ...prev, submitting: true, error: null }));
      const payload = {
        farmId: manualForm.farmId,
        cropVarietyId: manualForm.cropVarietyId || null,
        title: manualForm.title,
        experimentCode: manualForm.experimentCode || undefined,
        objective: manualForm.objective,
        hypothesis: manualForm.hypothesis || null,
        startDate: manualForm.startDate || null,
        endDate: manualForm.endDate || null
      };
      const result = await experimentsApi.create(payload);
      const code = result?.experimentCode || result?.data?.experimentCode || 'thành công';
      showToast(`Đã tạo thực nghiệm: ${code}`, 'success');
      setManualCreate({ open: false, request: null, submitting: false, error: null });
      fetchRequests();
    } catch (err) {
      setManualCreate(prev => ({ ...prev, submitting: false, error: err.message || 'Không thể tạo thực nghiệm' }));
      showToast(err.message || 'Không thể tạo thực nghiệm', 'error');
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
                  <tr key={req.id} onClick={() => openDetail(req)} className={`cursor-pointer hover:bg-surface-container/30 transition-colors border-l-4 ${statusBg[req.status] || ''}`}>
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
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={(e) => { e.stopPropagation(); openManualCreate(req); }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold uppercase shadow-sm transition-all whitespace-nowrap"
                              title="Tạo thí nghiệm thủ công (POST /experiments)">
                              <span>＋</span> Tạo TN
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleQuickConvert(req); }} disabled={quickCreating}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase shadow-sm transition-all whitespace-nowrap disabled:opacity-50"
                              title="Tạo nhanh từ yêu cầu (POST /experiments/from-request/:id)">
                              <span>⚡</span> {quickCreating ? 'Đang tạo...' : 'Tạo TN Nhanh'}
                            </button>
                          </div>
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

      {/* Manual Create Experiment Modal (POST /experiments) */}
      <Modal open={manualCreate.open} onClose={closeManualCreate} title="＋ Tạo Thí Nghiệm Thủ Công" width="max-w-2xl">
        <form onSubmit={submitManualCreate} className="space-y-4">
          {manualCreate.request && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-700">
              <p className="font-bold mb-1">📋 Từ yêu cầu #{manualCreate.request.id.slice(0, 8)}</p>
              <p>Các trường đã được điền sẵn từ yêu cầu. Bạn có thể chỉnh sửa trước khi tạo.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Nông Trại <span className="text-rose-500">*</span></label>
              <select value={manualForm.farmId} onChange={e => setManualForm({ ...manualForm, farmId: e.target.value })}
                className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${manualFormErrors.farmId ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`}>
                <option value="">— Chọn nông trại —</option>
                {farms.map(f => <option key={f.id} value={f.id}>{f.farmName}</option>)}
              </select>
              {manualFormErrors.farmId && <p className="text-xs text-rose-600 mt-1">{manualFormErrors.farmId}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Mã Thí Nghiệm</label>
              <input type="text" value={manualForm.experimentCode} onChange={e => setManualForm({ ...manualForm, experimentCode: e.target.value })}
                placeholder="Tự động nếu trống"
                className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">Tiêu đề <span className="text-rose-500">*</span></label>
            <input type="text" value={manualForm.title} onChange={e => setManualForm({ ...manualForm, title: e.target.value })}
              placeholder="VD: Thí nghiệm giống lúa ST25 mùa đông"
              className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${manualFormErrors.title ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`} />
            {manualFormErrors.title && <p className="text-xs text-rose-600 mt-1">{manualFormErrors.title}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">Giống Cây Trồng</label>
            <select value={manualForm.cropVarietyId} onChange={e => setManualForm({ ...manualForm, cropVarietyId: e.target.value })}
              className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              <option value="">— Chọn giống cây (tùy chọn) —</option>
              {cropVarieties.map(c => (
                <optgroup key={c.id} label={c.cropName}>
                  {(c.varieties || []).map(v => <option key={v.id} value={v.id}>{v.varietyName}</option>)}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">Mục Tiêu <span className="text-rose-500">*</span></label>
            <textarea value={manualForm.objective} onChange={e => setManualForm({ ...manualForm, objective: e.target.value })}
              placeholder="Mô tả mục tiêu cụ thể của thí nghiệm..."
              rows={3}
              className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none ${manualFormErrors.objective ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`} />
            {manualFormErrors.objective && <p className="text-xs text-rose-600 mt-1">{manualFormErrors.objective}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">Giả Thuyết</label>
            <input type="text" value={manualForm.hypothesis} onChange={e => setManualForm({ ...manualForm, hypothesis: e.target.value })}
              placeholder="VD: Giống lúa ST25 cho năng suất cao hơn 20%"
              className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Ngày Bắt Đầu</label>
              <input type="date" value={manualForm.startDate} onChange={e => setManualForm({ ...manualForm, startDate: e.target.value })}
                className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Ngày Kết Thúc</label>
              <input type="date" value={manualForm.endDate} onChange={e => setManualForm({ ...manualForm, endDate: e.target.value })}
                className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>

          {manualCreate.error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700">
              ⚠️ {manualCreate.error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline-variant">
            <button type="button" onClick={closeManualCreate} disabled={manualCreate.submitting}
              className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-bold hover:bg-surface-container/40 disabled:opacity-50">
              Hủy
            </button>
            <button type="submit" disabled={manualCreate.submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all">
              {manualCreate.submitting ? 'Đang tạo...' : (<><span>＋</span> Tạo Thí Nghiệm</>)}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailReq} onClose={() => setDetailReq(null)} title="Chi Tiết Yêu Cầu" width="max-w-3xl">
        {detailReq && (
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {/* Header info */}
            <div className="space-y-2">
              <h3 className="font-hanken font-bold text-lg text-on-surface">{detailReq.title || '—'}</h3>
              {detailReq.objective && <p className="text-sm text-on-surface-variant whitespace-pre-line">{detailReq.objective}</p>}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${statusColors[detailReq.status] || 'bg-slate-100 text-slate-600'}`}>
                  {detailReq.status || '—'}
                </span>
                {detailReq.farmName && <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">🌾 {detailReq.farmName}</span>}
                {detailReq.cropVarietyName && <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">🌱 {detailReq.cropVarietyName}</span>}
                {detailReq.procedureTemplateName && <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700">📋 {detailReq.procedureTemplateName}</span>}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-surface-container-low/30 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-on-surface-variant block mb-0.5">Ngày Bắt Đầu</span>
                  <span className="text-xs font-mono">{detailReq.expectedStartDate || '—'}</span>
                </div>
                <div className="p-3 bg-surface-container-low/30 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-on-surface-variant block mb-0.5">Ngày Kết Thúc</span>
                  <span className="text-xs font-mono">{detailReq.expectedEndDate || '—'}</span>
                </div>
                <div className="p-3 bg-surface-container-low/30 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-on-surface-variant block mb-0.5">Người Tạo</span>
                  <span className="text-xs">{detailReq.researcherName || '—'}</span>
                </div>
              </div>
            </div>

            {/* MonitoringPlan parsed */}
            {(() => {
              const mp = parseMonitoringPlan(detailReq.monitoringPlan);
              if (!mp) return null;
              return (
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <h4 className="text-xs font-bold text-purple-700 mb-3">📐 Monitoring Plan</h4>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-purple-700">Design Type</span>
                      <p className="text-sm font-bold">{mp.designType || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-purple-700">Replication</span>
                      <p className="text-sm font-bold">{mp.replicationCount || '—'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-purple-700">Random Method</span>
                      <p className="text-sm font-bold">{mp.randomizationMethod || '—'}</p>
                    </div>
                  </div>
                  {mp.treatments && mp.treatments.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold uppercase text-purple-700 block mb-1.5">Treatments ({mp.treatments.length})</span>
                      <div className="space-y-1.5">
                        {mp.treatments.map((t, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-purple-100">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${(Number(t.groupType) === 1 || t.groupType === 'Control') ? 'bg-slate-100 text-slate-700' : 'bg-indigo-100 text-indigo-700'}`}>
                              {(Number(t.groupType) === 1 || t.groupType === 'Control') ? 'Control' : (t.groupType === 'Treatment' ? 'Treatment' : 'Treatment')}
                            </span>
                            <span className="text-sm font-semibold">{t.name}</span>
                            {t.description && <span className="text-xs text-on-surface-variant">— {t.description}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Reviews */}
            <div>
              <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">📝 Lịch Sử Review ({detailReq.reviews?.length || 0})</h4>
              {detailReq.loadingReviews ? (
                <p className="text-xs text-on-surface-variant italic">Đang tải...</p>
              ) : detailReq.reviews && detailReq.reviews.length > 0 ? (
                <div className="space-y-2">
                  {detailReq.reviews.map((rv, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${rv.result === 'Approved' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold">{rv.reviewer?.fullName || '—'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rv.result === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {rv.result}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant">{rv.reviewer?.email || ''}</p>
                      {rv.comment && <p className="text-sm text-on-surface mt-1.5">💬 {rv.comment}</p>}
                      {rv.reviewedAt && <p className="text-[10px] text-on-surface-variant mt-1">📅 {new Date(rv.reviewedAt).toLocaleString('vi-VN')}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant italic">Chưa có review nào.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

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

          {/* Loại cây trồng + Giống cây (cascade) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">🌾 Loại Cây Trồng <span className="text-rose-500">*</span></label>
              <select value={form.cropId} onChange={e => {
                const cropId = e.target.value;
                setForm(f => ({ ...f, cropId, cropVarietyId: '', procedureTemplateId: '' }));
                setVarieties([]);
                setTemplates([]);
                fetchVarieties(cropId);
              }}
                disabled={loadingCrops}
                className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 ${formErrors.cropId ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`}>
                <option value="">{loadingCrops ? 'Đang tải...' : '— Chọn loại cây trồng —'}</option>
                {crops.map(c => <option key={c.id} value={c.id}>{c.cropName}{c.scientificName ? ` (${c.scientificName})` : ''}</option>)}
              </select>
              {formErrors.cropId && <p className="text-xs text-rose-600 mt-1">{formErrors.cropId}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">🌱 Giống Cây <span className="text-rose-500">*</span></label>
              <select value={form.cropVarietyId} onChange={e => {
                const cropVarietyId = e.target.value;
                setForm(f => ({ ...f, cropVarietyId, procedureTemplateId: '' }));
                setTemplates([]);
                fetchTemplates(cropVarietyId);
              }}
                disabled={!form.cropId || loadingVarieties}
                className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-400 ${formErrors.cropVarietyId ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`}>
                <option value="">
                  {!form.cropId ? '— Chọn loại cây trồng trước —' :
                   loadingVarieties ? 'Đang tải giống...' :
                   varieties.length === 0 ? '— Không có giống nào —' : '— Chọn giống cây —'}
                </option>
                {varieties.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.varietyName}{v.origin ? ` — ${v.origin}` : ''}{v.growthDurationDays ? ` (${v.growthDurationDays} ngày)` : ''}
                  </option>
                ))}
              </select>
              {formErrors.cropVarietyId && <p className="text-xs text-rose-600 mt-1">{formErrors.cropVarietyId}</p>}
            </div>
          </div>

          {/* Quy trình (Procedure Template) - phụ thuộc vào variety */}
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">📋 Quy Trình Thực Hiện <span className="text-rose-500">*</span></label>
            <select value={form.procedureTemplateId} onChange={e => setForm(f => ({ ...f, procedureTemplateId: e.target.value }))}
              disabled={!form.cropVarietyId || loadingTemplates}
              className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-400 ${formErrors.procedureTemplateId ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`}>
              <option value="">
                {!form.cropVarietyId ? '— Chọn giống cây trước —' :
                 loadingTemplates ? 'Đang tải quy trình...' :
                 templates.length === 0 ? '— Chưa có quy trình cho giống này —' : '— Chọn quy trình —'}
              </option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.templateName}{t.objective ? ` — ${t.objective.slice(0, 50)}${t.objective.length > 50 ? '...' : ''}` : ''}
                </option>
              ))}
            </select>
            {formErrors.procedureTemplateId && <p className="text-xs text-rose-600 mt-1">{formErrors.procedureTemplateId}</p>}
            {form.cropVarietyId && !loadingTemplates && templates.length === 0 && (
              <p className="text-[10px] text-amber-700 mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full">
                ⚠️ Giống cây này chưa có quy trình — vui lòng liên hệ Admin tạo <code className="px-1">Procedure Template</code> trước
              </p>
            )}
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">🔬 Loại Thiết Kế</label>
                  <select
                    value={form.monitoringPlan.designType}
                    onChange={e => setForm(f => ({ ...f, monitoringPlan: { ...f.monitoringPlan, designType: e.target.value } }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white">
                    <option value="CompletelyRandomized">Completely Randomized</option>
                    <option value="RandomizedCompleteBlock">Randomized Complete Block</option>
                    <option value="Factorial">Factorial</option>
                    <option value="Observational">Observational</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">🔁 Số Lần Lặp (Replication) <span className="text-rose-500">*</span></label>
                  <input type="number" min="2" value={form.monitoringPlan.replicationCount}
                    onChange={e => setForm(f => ({ ...f, monitoringPlan: { ...f.monitoringPlan, replicationCount: e.target.value } }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
                    placeholder="VD: 3 (tối thiểu 2)" />
                  {form.monitoringPlan.replicationCount && Number(form.monitoringPlan.replicationCount) < 2 && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1">⚠️ Phải &gt;= 2</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">🎲 Phương Pháp Random</label>
                  <input type="text" value={form.monitoringPlan.randomizationMethod}
                    onChange={e => setForm(f => ({ ...f, monitoringPlan: { ...f.monitoringPlan, randomizationMethod: e.target.value } }))}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
                    placeholder="VD: Fisher-Yates" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600">🧪 Các Treatment <span className="text-rose-500">*</span></label>
                  <button type="button" onClick={() => setForm(f => ({ ...f, monitoringPlan: { ...f.monitoringPlan, treatments: [...f.monitoringPlan.treatments, { name: '', description: '', groupType: 'Treatment' }] } }))}
                    className="px-2.5 py-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-all">
                    + Thêm Treatment
                  </button>
                </div>
                <div className="space-y-2">
                  {form.monitoringPlan.treatments.map((t, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2.5 bg-white border border-slate-200 rounded-xl">
                      <div className="w-7 h-7 mt-1 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold shrink-0">#{idx + 1}</div>
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2">
                        <input
                          type="text" value={t.name} placeholder="Tên treatment (VD: Phân NPK)"
                          onChange={e => setForm(f => ({ ...f, monitoringPlan: { ...f.monitoringPlan, treatments: f.monitoringPlan.treatments.map((x, i) => i === idx ? { ...x, name: e.target.value } : x) } }))}
                          className="md:col-span-4 px-2.5 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
                        />
                        <input
                          type="text" value={t.description} placeholder="Mô tả (tuỳ chọn)"
                          onChange={e => setForm(f => ({ ...f, monitoringPlan: { ...f.monitoringPlan, treatments: f.monitoringPlan.treatments.map((x, i) => i === idx ? { ...x, description: e.target.value } : x) } }))}
                          className="md:col-span-5 px-2.5 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
                        />
                        <select
                          value={t.groupType}
                          onChange={e => setForm(f => ({ ...f, monitoringPlan: { ...f.monitoringPlan, treatments: f.monitoringPlan.treatments.map((x, i) => i === idx ? { ...x, groupType: e.target.value } : x) } }))}
                          className="md:col-span-2 px-2 py-2 border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
                        >
                          <option value="Control">Control</option>
                          <option value="Treatment">Treatment</option>
                        </select>
                        <button
                          type="button" onClick={() => setForm(f => ({ ...f, monitoringPlan: { ...f.monitoringPlan, treatments: f.monitoringPlan.treatments.filter((_, i) => i !== idx) } }))}
                          className="md:col-span-1 px-2 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold transition-all"
                          disabled={form.monitoringPlan.treatments.length <= 1}
                          title={form.monitoringPlan.treatments.length <= 1 ? 'Phải có ít nhất 1 treatment' : 'Xóa treatment'}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  💡 Tổng số luống cần dự kiến: <strong className="text-indigo-700">{Math.max(0, Number(form.monitoringPlan.replicationCount) || 0) * form.monitoringPlan.treatments.length}</strong> luống (= replication × treatments)
                </p>
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

      {/* Modal: Tạo Thực Nghiệm từ Request Đã Approved */}
      <Modal open={createExperiment.open} onClose={closeCreateExperiment} title={
        <div className="flex items-center gap-3">
          <span className="text-2xl">🧭</span>
          <span>Tạo Thực Nghiệm Từ Yêu Cầu</span>
        </div>
      } width="max-w-3xl">
        {createExperiment.loading ? (
          <div className="p-12 text-center">
            <div className="inline-block w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm text-on-surface-variant mt-3">Đang tải thông tin...</p>
          </div>
        ) : createExperiment.request ? (
          <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            {/* Header info từ request */}
            <div className={`p-4 rounded-xl border bg-gradient-to-br from-indigo-50 via-white to-purple-50 border-indigo-100`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-hanken font-bold text-lg text-on-surface">{createExperiment.request.title || "—"}</h3>
                  {createExperiment.request.objective && (
                    <p className="text-xs text-on-surface-variant mt-1 whitespace-pre-line line-clamp-3">{createExperiment.request.objective}</p>
                  )}
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                  ✅ Approved
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {createExperiment.request.farmName && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">🌾 {createExperiment.request.farmName}</span>
                )}
                {createExperiment.request.cropVarietyName && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">🌱 {createExperiment.request.cropVarietyName}</span>
                )}
                {createExperiment.request.procedureTemplateName && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">📋 {createExperiment.request.procedureTemplateName}</span>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-surface-container-low/30 border border-outline-variant rounded-xl">
                <div className="text-[10px] font-bold uppercase text-on-surface-variant">Ngày Bắt Đầu</div>
                <div className="font-mono text-sm mt-1">{createExperiment.request.expectedStartDate || "—"}</div>
              </div>
              <div className="p-3 bg-surface-container-low/30 border border-outline-variant rounded-xl">
                <div className="text-[10px] font-bold uppercase text-on-surface-variant">Ngày Kết Thúc</div>
                <div className="font-mono text-sm mt-1">{createExperiment.request.expectedEndDate || "—"}</div>
              </div>
            </div>

            {/* MonitoringPlan summary */}
            {(() => {
              const mpRaw = createExperiment.request.monitoringPlan;
              if (!mpRaw) return null;
              const mp = typeof mpRaw === "object" ? mpRaw : (() => { try { return JSON.parse(mpRaw); } catch { return null; } })();
              if (!mp) return null;
              return (
                <div className="p-4 rounded-xl border bg-purple-50/50 border-purple-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700 mb-2">📐 Kế Hoạch Thí Nghiệm</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-purple-700 font-bold">Design</span>
                      <p className="font-semibold">{mp.designType || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-purple-700 font-bold">Replication</span>
                      <p className="font-semibold">{mp.replicationCount || "—"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-purple-700 font-bold">Treatments</span>
                      <p className="font-semibold">{Array.isArray(mp.treatments) ? mp.treatments.length : "—"}</p>
                    </div>
                  </div>
                  {Array.isArray(mp.treatments) && mp.treatments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {mp.treatments.map((t, i) => (
                        <span key={i} className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.groupType === "Control" ? "bg-slate-100 text-slate-700" : "bg-indigo-100 text-indigo-700"}`}>{t.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Reserved Beds */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                  <span>🌿</span> Luống Đã Được Manager Reserve
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{createExperiment.reservedBeds.length} luống</span>
              </div>
              <p className="text-[11px] text-on-surface-variant mb-2">
                Sau khi bấm <strong>Tạo</strong>, những luống này sẽ được chuyển từ <code className="px-1 bg-amber-50 text-amber-700 rounded">Reserved</code> » <code className="px-1 bg-emerald-50 text-emerald-700 rounded">Assigned</code> và gắn vào Experiment mới.
              </p>
              {createExperiment.reservedBeds.length === 0 ? (
                <div className="p-6 border-2 border-dashed border-rose-200 bg-rose-50/40 rounded-xl text-center">
                  <div className="text-3xl mb-1">⚠️</div>
                  <p className="text-xs font-bold text-rose-700">Chưa có luống nào được reserve</p>
                  <p className="text-[10px] text-rose-600 mt-1">Manager cần duyệt request với đủ é đé để BE tự reserve bed trước khi tạo experiment.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {createExperiment.reservedBeds.map((bed, i) => (
                    <div key={bed.id || i} className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-colors">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-on-surface">🌿 {bed.bedCode}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200">{bed.allocationStatus || "Reserved"}</span>
                      </div>
                      {bed.areaName && <div className="text-[10px] text-on-surface-variant mt-0.5 truncate">📍 {bed.areaName}</div>}
                      {bed.farmName && <div className="text-[10px] text-on-surface-variant truncate">🌾 {bed.farmName}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {createExperiment.error && (
              <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-700">
                <strong>Lỗi:</strong> {createExperiment.error}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant">
              <button type="button" onClick={closeCreateExperiment} disabled={createExperiment.submitting}
                className="px-5 py-2.5 border border-outline-variant rounded-xl text-sm font-medium hover:bg-surface-container/50 transition-all disabled:opacity-50">
                Hủy
              </button>
              <button type="button" onClick={submitCreateExperiment}
                disabled={createExperiment.submitting || createExperiment.reservedBeds.length === 0}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                <span>{createExperiment.submitting ? "⏳" : "✅"}</span>
                {createExperiment.submitting ? "Đang tạo..." : "Tạo Thực Nghiệm"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-rose-600">Không có dữ liệu yêu cầu.</div>
        )}
      </Modal>
    </div>
  );
};

export default ResearcherRequests;
