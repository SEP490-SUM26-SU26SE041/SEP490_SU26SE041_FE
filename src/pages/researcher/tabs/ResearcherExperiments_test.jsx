import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { experimentsApi, tasksApi, experimentRequestsApi } from '../../../api/experimentApi';
import { farmsApi, bedsApi } from '../../../api/managerResourcesApi';
import { stagesApi, groupsApi, designApi, measurementsApi, schedulesApi, batchesApi, bedAssignmentsApi, userApi, areasApi } from '../../../api/researcherApi';
import { cropsApi } from '../../../api/cropApi';
import { useToast } from '../../../context/ToastContext';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

// â”€â”€ Portal helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const Portal = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

const STATUS_FILTERS = [
  { value: '', label: 'Táº¥t Cáº£' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Active', label: 'Active' },
  { value: 'Completed', label: 'Completed' },
];

const DETAIL_TABS = [
  { id: 'overview', label: 'Tá»•ng Quan' },
  { id: 'stages', label: 'Giai Äoáº¡n' },
  { id: 'groups', label: 'NhÃ³m' },
  { id: 'design', label: 'Thiáº¿t Káº¿' },
  { id: 'measurements', label: 'Äo LÆ°á»ng' },
  { id: 'schedules', label: 'Lá»‹ch ChÄƒm SÃ³c' },
  { id: 'batches', label: 'LÃ´' },
  { id: 'tasks', label: 'TÃ¡c Vá»¥' },
];

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-600',
  Active: 'bg-emerald-100 text-emerald-700',
  Paused: 'bg-amber-100 text-amber-700',
  Approved: 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-200 text-emerald-800',
  Cancelled: 'bg-rose-100 text-rose-700',
  Pending: 'bg-amber-100 text-amber-700',
  Rejected: 'bg-rose-100 text-rose-700'
};

// ExperimentStageType enum má»›i (BE cáº­p nháº­t): Preparation | Planting | Growing | Harvesting | PostHarvest | Other
const STAGE_TYPES = [
  { value: 'Preparation', label: 'Chuáº©n bá»‹ (Preparation)' },
  { value: 'Planting', label: 'Gieo trá»“ng (Planting)' },
  { value: 'Growing', label: 'Sinh trÆ°á»Ÿng (Growing)' },
  { value: 'Harvesting', label: 'Thu hoáº¡ch (Harvesting)' },
  { value: 'PostHarvest', label: 'Sau thu hoáº¡ch (PostHarvest)' },
  { value: 'Other', label: 'KhÃ¡c (Other)' }
];

// GroupType giá»¯ nguyÃªn enum string: Control | Treatment
const GROUP_TYPES = [
  { value: 'Control', label: 'Äá»‘i chá»©ng (Control)' },
  { value: 'Treatment', label: 'Xá»­ lÃ½ (Treatment)' }
];

// DesignType enum má»›i (BE cáº­p nháº­t): CRD | RCBD | LSD | Factorial | SplitPlot | Other
const DESIGN_TYPES = [
  { value: 'CRD', label: 'CRD - Completely Randomized' },
  { value: 'RCBD', label: 'RCBD - Randomized Complete Block' },
  { value: 'LSD', label: 'LSD - Latin Square Design' },
  { value: 'Factorial', label: 'Factorial Design' },
  { value: 'SplitPlot', label: 'Split-Plot Design' },
  { value: 'Other', label: 'KhÃ¡c (Other)' }
];

// TaskType giá»¯ nguyÃªn string enum (BE khÃ´ng Ä‘á»•i)
const TASK_TYPES = [
  { value: 'Planting', label: 'Trá»“ng (Planting)' },
  { value: 'Watering', label: 'TÆ°á»›i nÆ°á»›c (Watering)' },
  { value: 'Fertilizing', label: 'BÃ³n phÃ¢n (Fertilizing)' },
  { value: 'Observation', label: 'Quan sÃ¡t (Observation)' },
  { value: 'Inspection', label: 'Kiá»ƒm tra (Inspection)' },
  { value: 'Harvest', label: 'Thu hoáº¡ch (Harvest)' },
  { value: 'Other', label: 'KhÃ¡c (Other)' }
];

// â”€â”€ Researcher Experiments List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ResearcherExperiments = ({ prefillData, onPrefillConsumed }) => {
  const { showToast } = useToast();
  const [experiments, setExperiments] = useState([]);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFarm, setFilterFarm] = useState('');
  const [search, setSearch] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeExp, setActiveExp] = useState(null);
  const [showCreateExp, setShowCreateExp] = useState(false);
  const [creatingExp, setCreatingExp] = useState(false);
  const [createForm, setCreateForm] = useState({
    farmId: '', cropVarietyId: '', experimentCode: '', title: '', objective: '', hypothesis: '', startDate: '', endDate: ''
  });
  const [createErrors, setCreateErrors] = useState({});
  const [cropVarieties, setCropVarieties] = useState([]);

  // Quick create from approved request
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickRequests, setQuickRequests] = useState([]);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);

  // Dropdown menu 'Tao TN' (chon: Thu cong hoac Nhanh tu request)
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = React.useRef(null);

  const openQuickCreate = async () => {
    setShowQuickCreate(true);
    setSelectedRequestId(null);
    setQuickLoading(true);
    try {
      // Láº¥y táº¥t cáº£ yÃªu cáº§u, lá»c Approved chÆ°a Ä‘Æ°á»£c dÃ¹ng (chÆ°a cÃ³ experimentId)
      const data = await experimentRequestsApi.getAll({ status: 'Approved' });
      const list = (Array.isArray(data) ? data : []).filter(r => !r.experimentId);
      setQuickRequests(list);
    } catch (err) {
      showToast(err.message || 'KhÃ´ng thá»ƒ táº£i danh sÃ¡ch yÃªu cáº§u', 'error');
      setQuickRequests([]);
    } finally {
      setQuickLoading(false);
    }
  };

  const closeQuickCreate = () => {
    setShowQuickCreate(false);
    setSelectedRequestId(null);
    setQuickRequests([]);
  };

  const handleQuickCreate = async () => {
    if (!selectedRequestId) {
      showToast('Vui lÃ²ng chá»n 1 yÃªu cáº§u', 'warning');
      return;
    }
    try {
      setQuickSubmitting(true);
      const exp = await experimentsApi.createFromRequest(selectedRequestId);
      const newId = exp?.id || exp?.data?.id;
      showToast('ÄÃ£ táº¡o thÃ­ nghiá»‡m nhanh tá»« yÃªu cáº§u!', 'success');
      closeQuickCreate();
      fetchExperiments();
      // Má»Ÿ tháº³ng detail experiment má»›i táº¡o
      if (newId) {
        const found = (await experimentsApi.getAll()).find(e => e.id === newId);
        if (found) openDetail(found);
      }
    } catch (err) {
      showToast(err.message || 'Lá»—i táº¡o thÃ­ nghiá»‡m nhanh', 'error');
    } finally {
      setQuickSubmitting(false);
    }
  };

  const fetchFarms = async () => {
    try {
      const data = await farmsApi.getMyFarms();
      setFarms(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  };

  const fetchCropVarieties = async () => {
    try {
      const data = await cropsApi.getAll();
      setCropVarieties(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  };

  const fetchExperiments = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterFarm) params.farmId = filterFarm;
      if (filterStatus) params.status = filterStatus;
      const data = await experimentsApi.getAll(params);
      setExperiments(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'KhÃ´ng thá»ƒ táº£i danh sÃ¡ch thÃ­ nghiá»‡m', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFarms(); fetchCropVarieties(); }, []);
  useEffect(() => { fetchExperiments(); }, [filterFarm, filterStatus]);

  // Xá»­ lÃ½ prefill tá»« trang Requests
  useEffect(() => {
    if (prefillData) {
      const expCode = `EXP-${Date.now().toString().slice(-6)}`;
      setCreateForm({
        farmId: prefillData.farmId || '',
        cropVarietyId: '',
        experimentCode: expCode,
        title: prefillData.title || '',
        objective: prefillData.objective || '',
        hypothesis: '',
        startDate: prefillData.expectedStartDate || '',
        endDate: prefillData.expectedEndDate || ''
      });
      setCreateErrors({});
      setShowCreateExp(true);
      showToast(`ÄÃ£ táº£i dá»¯ liá»‡u tá»« yÃªu cáº§u. MÃ£ thÃ­ nghiá»‡m gá»£i Ã½: ${expCode}`, 'info');
      if (onPrefillConsumed) onPrefillConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillData]);

  const handleCreateExp = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!createForm.farmId) errs.farmId = 'Vui lÃ²ng chá»n nÃ´ng tráº¡i';
    if (!createForm.title.trim()) errs.title = 'TiÃªu Ä‘á» khÃ´ng Ä‘Æ°á»£c trá»‘ng';
    if (!createForm.objective.trim()) errs.objective = 'Má»¥c tiÃªu khÃ´ng Ä‘Æ°á»£c trá»‘ng';
    if (createForm.startDate) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const start = new Date(createForm.startDate); start.setHours(0, 0, 0, 0);
      if (start < today) errs.startDate = 'NgÃ y báº¯t Ä‘áº§u pháº£i lÃ  hÃ´m nay hoáº·c trong tÆ°Æ¡ng lai';
    }
    if (createForm.startDate && createForm.endDate && createForm.endDate <= createForm.startDate)
      errs.endDate = 'NgÃ y káº¿t thÃºc pháº£i sau ngÃ y báº¯t Ä‘áº§u';
    if (Object.keys(errs).length > 0) { setCreateErrors(errs); return; }
    try {
      setCreatingExp(true);
      const payload = { ...createForm };
      if (!payload.cropVarietyId) delete payload.cropVarietyId;
      if (!payload.experimentCode) delete payload.experimentCode;
      if (!payload.hypothesis) delete payload.hypothesis;
      if (!payload.startDate) delete payload.startDate;
      if (!payload.endDate) delete payload.endDate;
      await experimentsApi.create(payload);
      showToast('ÄÃ£ táº¡o thÃ­ nghiá»‡m má»›i!', 'success');
      setShowCreateExp(false);
      setCreateForm({ farmId: '', cropVarietyId: '', experimentCode: '', title: '', objective: '', hypothesis: '', startDate: '', endDate: '' });
      setCreateErrors({});
      fetchExperiments();
    } catch (err) { showToast(err.message || 'Lá»—i táº¡o thÃ­ nghiá»‡m', 'error'); }
    finally { setCreatingExp(false); }
  };

  const openDetail = async (exp) => {
    setActiveExp(exp);
    setDetailOpen(true);
  };

  const filtered = experiments.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (e.title || '').toLowerCase().includes(q) ||
      (e.experimentCode || '').toLowerCase().includes(q) ||
      (e.farmName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-on-surface-variant mb-1">TÃ¬m Kiáº¿m</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" placeholder="TÃªn, mÃ£ thÃ­ nghiá»‡m..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-on-surface-variant mb-1">Tráº¡ng ThÃ¡i</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
            {STATUS_FILTERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-on-surface-variant mb-1">NÃ´ng Tráº¡i</label>
          <select value={filterFarm} onChange={e => setFilterFarm(e.target.value)}
            className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="">Táº¥t Cáº£ NÃ´ng Tráº¡i</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.farmName}</option>)}
          </select>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          {filtered.length} thÃ­ nghiá»‡m
        </p>
      </div>

      {/* Experiments Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">MÃ£ TN</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">TiÃªu Ä‘á»</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">NÃ´ng tráº¡i</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tráº¡ng thÃ¡i</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Báº¯t Ä‘áº§u</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Káº¿t thÃºc</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Thao tÃ¡c</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-on-surface-variant">Äang táº£i...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center">
                  <div className="text-4xl mb-2">ðŸŒ±</div>
                  <p className="text-sm font-bold text-on-surface">ChÆ°a cÃ³ thÃ­ nghiá»‡m nÃ o</p>
                  <p className="text-xs text-on-surface-variant mt-1">Nháº¥n "Táº¡o TN" Ä‘á»ƒ táº¡o má»›i, hoáº·c "Táº¡o nhanh tá»« yÃªu cáº§u" Ä‘á»ƒ táº¡o tá»« request Ä‘Ã£ duyá»‡t.</p>
                </td></tr>
              ) : (
                filtered.map(exp => (
                  <tr key={exp.id} className="border-b border-outline-variant hover:bg-surface-container-low/40 transition-colors">
                    <td className="px-6 py-4 text-xs font-mono font-bold text-on-surface">{exp.experimentCode || 'â€”'}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-on-surface line-clamp-1">{exp.title || '(KhÃ´ng cÃ³ tiÃªu Ä‘á»)'}</p>
                      {exp.objective && <p className="text-[11px] text-on-surface-variant line-clamp-1 mt-0.5">{exp.objective}</p>}
                    </td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant">{exp.farmName || 'â€”'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        exp.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                        exp.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                        exp.status === 'Planning' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{exp.status || 'â€”'}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">{exp.startDate || 'â€”'}</td>
                    <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">{exp.endDate || 'â€”'}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openDetail(exp)}
                        className="text-indigo-600 font-bold text-[10px] uppercase hover:underline whitespace-nowrap">
                        Chi tiáº¿t
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Táº¡o TN nhanh tá»« Approved Request */}
      {showQuickCreate && (
        <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-emerald-50/50 shrink-0">
                <div>
                  <h3 className="font-hanken font-bold text-lg text-emerald-700">âš¡ Táº¡o ThÃ­ Nghiá»‡m Nhanh</h3>
                  <p className="text-xs text-emerald-700/70 mt-0.5">Chá»n 1 yÃªu cáº§u Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t â€” há»‡ thá»‘ng tá»± Ä‘á»™ng táº¡o Experiment + Groups + Batches tá»« MonitoringPlan.</p>
                </div>
                <button onClick={closeQuickCreate} className="text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {quickLoading ? (
                  <div className="py-12 text-center text-sm text-on-surface-variant">Äang táº£i danh sÃ¡ch yÃªu cáº§u...</div>
                ) : quickRequests.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-4xl mb-2">ðŸ“­</div>
                    <p className="text-sm font-bold text-on-surface">KhÃ´ng cÃ³ yÃªu cáº§u nÃ o Ä‘Ã£ Ä‘Æ°á»£c duyá»‡t</p>
                    <p className="text-xs text-on-surface-variant mt-1">Vui lÃ²ng duyá»‡t yÃªu cáº§u trÆ°á»›c, hoáº·c dÃ¹ng "Táº¡o TN" Ä‘á»ƒ táº¡o thá»§ cÃ´ng.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                      {quickRequests.length} yÃªu cáº§u kháº£ dá»¥ng
                    </p>
                    {quickRequests.map(r => {
                      const selected = selectedRequestId === r.id;
                      return (
                        <label key={r.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-outline-variant bg-white hover:border-emerald-300 hover:bg-emerald-50/40'}`}>
                          <input type="radio" name="quickRequest" checked={selected}
                            onChange={() => setSelectedRequestId(r.id)}
                            className="mt-1 w-4 h-4 text-emerald-600 focus:ring-emerald-500" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-on-surface line-clamp-1">{r.title || '(KhÃ´ng cÃ³ tiÃªu Ä‘á»)'}</span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                Approved
                              </span>
                            </div>
                            <div className="text-xs text-on-surface-variant mt-1 flex items-center gap-3 flex-wrap">
                              <span>ðŸ  {r.farmName || 'â€”'}</span>
                              <span>ðŸ“… {r.expectedStartDate || 'â€”'} â†’ {r.expectedEndDate || 'â€”'}</span>
                            </div>
                            {r.objective && <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{r.objective}</p>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-2 shrink-0 bg-surface-container-low/30">
                <button onClick={closeQuickCreate} type="button"
                  className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-bold hover:bg-surface-container/40">
                  Há»§y
                </button>
                <button onClick={handleQuickCreate} disabled={!selectedRequestId || quickSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all">
                  {quickSubmitting ? 'Äang táº¡o...' : (<><span>âš¡</span> Táº¡o TN nhanh</>)}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Experiment Detail Modal */}
      {detailOpen && activeExp && (
        <ExperimentDetailModal
          experiment={activeExp}
          onClose={() => { setDetailOpen(false); setActiveExp(null); }}
          onExperimentUpdated={(updated) => {
            if (updated) {
              setActiveExp(updated);
              setExperiments(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
            }
            fetchExperiments();
          }}
        />
      )}

