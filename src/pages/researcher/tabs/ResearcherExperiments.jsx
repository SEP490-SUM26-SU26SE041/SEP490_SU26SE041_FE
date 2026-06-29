import React, { useEffect, useState, useCallback } from 'react';
import { experimentsApi, tasksApi } from '../../../api/experimentApi';
import { farmsApi, bedsApi } from '../../../api/managerResourcesApi';
import { stagesApi, groupsApi, designApi, measurementsApi, schedulesApi, batchesApi, bedAssignmentsApi, userApi, areasApi } from '../../../api/researcherApi';
import { cropsApi } from '../../../api/cropApi';
import { useToast } from '../../../context/ToastContext';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';

const STATUS_FILTERS = [
  { value: '', label: 'Tất Cả' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Active', label: 'Active' },
  { value: 'Completed', label: 'Completed' },
];

const DETAIL_TABS = [
  { id: 'overview', label: 'Tổng Quan' },
  { id: 'stages', label: 'Giai Đoạn' },
  { id: 'groups', label: 'Nhóm' },
  { id: 'design', label: 'Thiết Kế' },
  { id: 'measurements', label: 'Đo Lường' },
  { id: 'schedules', label: 'Lịch Chăm Sóc' },
  { id: 'batches', label: 'Lô' },
  { id: 'tasks', label: 'Tác Vụ' },
];

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-600',
  Active: 'bg-emerald-100 text-emerald-700',
  Approved: 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-200 text-emerald-800',
  Cancelled: 'bg-rose-100 text-rose-700',
  Pending: 'bg-amber-100 text-amber-700',
  Rejected: 'bg-rose-100 text-rose-700',
};

const STAGE_TYPES = [
  { value: 1, label: 'Ươm cây (Nursery)' },
  { value: 2, label: 'Chăm sóc (Care)' },
  { value: 3, label: 'Sinh trưởng (Growth)' },
  { value: 4, label: 'Thu hoạch (Harvest)' },
  { value: 5, label: 'Đánh giá (Evaluation)' },
  { value: 99, label: 'Khác (Other)' },
];

const GROUP_TYPES = [
  { value: 1, label: 'Đối chứng (Control)' },
  { value: 2, label: 'Xử lý (Treatment)' },
];

const DESIGN_TYPES = [
  { value: 1, label: 'Completely Randomized' },
  { value: 2, label: 'Randomized Complete Block (RCBD)' },
  { value: 3, label: 'Factorial' },
  { value: 4, label: 'Observational' },
  { value: 5, label: 'Other' },
];

const TASK_TYPES = [
  { value: 1, label: 'Trồng (Planting)' },
  { value: 2, label: 'Tưới nước (Watering)' },
  { value: 3, label: 'Bón phân (Fertilizing)' },
  { value: 4, label: 'Quan sát (Observation)' },
  { value: 5, label: 'Kiểm tra (Inspection)' },
  { value: 6, label: 'Thu hoạch (Harvest)' },
  { value: 7, label: 'Khác (Other)' },
];

// ── Researcher Experiments List ───────────────────────────────────────────────────

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
      showToast(err.message || 'Không thể tải danh sách thí nghiệm', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFarms(); fetchCropVarieties(); }, []);
  useEffect(() => { fetchExperiments(); }, [filterFarm, filterStatus]);

  // Xử lý prefill từ trang Requests
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
      showToast(`Đã tải dữ liệu từ yêu cầu. Mã thí nghiệm gợi ý: ${expCode}`, 'info');
      if (onPrefillConsumed) onPrefillConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillData]);

  const handleCreateExp = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!createForm.farmId) errs.farmId = 'Vui lòng chọn nông trại';
    if (!createForm.title.trim()) errs.title = 'Tiêu đề không được trống';
    if (!createForm.objective.trim()) errs.objective = 'Mục tiêu không được trống';
    if (createForm.startDate && createForm.endDate && createForm.endDate <= createForm.startDate)
      errs.endDate = 'Ngày kết thúc phải sau ngày bắt đầu';
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
      showToast('Đã tạo thí nghiệm mới!', 'success');
      setShowCreateExp(false);
      setCreateForm({ farmId: '', cropVarietyId: '', experimentCode: '', title: '', objective: '', hypothesis: '', startDate: '', endDate: '' });
      setCreateErrors({});
      fetchExperiments();
    } catch (err) { showToast(err.message || 'Lỗi tạo thí nghiệm', 'error'); }
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
          <label className="block text-xs font-bold text-on-surface-variant mb-1">Tìm Kiếm</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="text" placeholder="Tên, mã thí nghiệm..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-on-surface-variant mb-1">Trạng Thái</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
            {STATUS_FILTERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-on-surface-variant mb-1">Nông Trại</label>
          <select value={filterFarm} onChange={e => setFilterFarm(e.target.value)}
            className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="">Tất Cả Nông Trại</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.farmName}</option>)}
          </select>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          {filtered.length} thí nghiệm
        </p>
        <p className="text-xs text-on-surface-variant italic">Tạo thí nghiệm từ trang Yêu Cầu</p>
      </div>
      <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low/50 border-b border-outline-variant">
                {['Mã', 'Tiêu Đề', 'Trạng Thái', 'Nông Trại', 'Bắt Đầu', 'Kết Thúc', 'Thao tác'].map(h => (
                  <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {loading ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-sm text-on-surface-variant">Đang tải...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="7" className="px-6 py-8 text-center text-sm text-on-surface-variant">Không tìm thấy thí nghiệm nào.</td></tr>
              ) : (
                filtered.map(exp => (
                  <tr key={exp.id} className="hover:bg-surface-container/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-[12px] text-primary font-bold">{exp.experimentCode || '—'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-on-surface line-clamp-1">{exp.title || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[exp.status] || 'bg-slate-100 text-slate-600'}`}>
                        {exp.status || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{exp.farmName || '—'}</td>
                    <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">{exp.startDate || '—'}</td>
                    <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">{exp.endDate || '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openDetail(exp)} className="text-primary font-bold text-[10px] uppercase hover:underline">Chi tiết</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailOpen && activeExp && (
        <ExperimentDetailModal
          experiment={activeExp}
          onClose={() => setDetailOpen(false)}
          onExperimentUpdated={(updated) => {
            setActiveExp(updated);
            fetchExperiments();
          }}
        />
      )}

      {/* Create Experiment Modal */}
      <CreateExpModal
        open={showCreateExp}
        onClose={() => { setShowCreateExp(false); setCreateErrors({}); }}
        farms={farms}
        cropVarieties={cropVarieties}
        form={createForm}
        setForm={setCreateForm}
        errors={createErrors}
        onSubmit={handleCreateExp}
        loading={creatingExp}
      />
    </div>
  );
};

// ── Experiment Detail Modal ───────────────────────────────────────────────────────

const ExperimentDetailModal = ({ experiment, onClose, onExperimentUpdated }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [expDetail, setExpDetail] = useState(experiment);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);

  // Helper to open confirm dialog
  const openConfirm = (title, message, onConfirm) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
  };

  // Tab data
  const [stages, setStages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [design, setDesign] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [batches, setBatches] = useState([]);
  const [bedAssignments, setBedAssignments] = useState([]);
  const [tasks, setTasks] = useState([]);

  // Available beds
  const [availableBeds, setAvailableBeds] = useState([]);
  const [areas, setAreas] = useState([]);

  // Task users
  const [users, setUsers] = useState([]);
  const [skillMatches, setSkillMatches] = useState([]);
  const [selectedTaskForAssign, setSelectedTaskForAssign] = useState(null);

  // Edit state
  const [editExp, setEditExp] = useState(null);
  const [showEditExp, setShowEditExp] = useState(false);
  const [savingExp, setSavingExp] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Cache fetched tabs - only fetch once per tab
  const [fetchedTabs, setFetchedTabs] = useState(new Set());

  // Forms
  const [stageForm, setStageForm] = useState({ stageName: '', stageOrder: 1, stageType: 1, objective: '', startDate: '', endDate: '' });
  const [groupForm, setGroupForm] = useState({ groupName: '', groupType: 1, treatmentDescription: '' });
  const [designForm, setDesignForm] = useState({ designType: 2, replicationCount: 3, randomizationMethod: '', designParameters: '' });

  // Populate designForm when design data loads
  useEffect(() => {
    if (design) {
      setDesignForm({
        designType: design.designType || 2,
        replicationCount: design.replicationCount || 3,
        randomizationMethod: design.randomizationMethod || '',
        designParameters: typeof design.designParameters === 'string' ? design.designParameters : JSON.stringify(design.designParameters || {}),
      });
    }
  }, [design]);

  const [measurementForm, setMeasurementForm] = useState({ groupId: '', metricName: '', unit: '', targetValue: '', description: '' });
  const [scheduleForm, setScheduleForm] = useState({ experimentStageId: '', batchId: '', title: '', instruction: '', frequencyDays: 1, taskType: 1, startDate: '', endDate: '' });
  const [batchForm, setBatchForm] = useState({ experimentBedAssignmentId: '', groupId: '', batchCode: '', plantingDate: '', expectedHarvestDate: '', plantCount: '', notes: '' });
  const [bedForm, setBedForm] = useState({ areaId: '', bedId: '' });
  const [taskForm, setTaskForm] = useState({ experimentStageId: '', batchId: '', careScheduleId: '', taskType: 2, title: '', description: '', requiredSkillDescription: '', dueDate: '' });
  const [assignForm, setAssignForm] = useState({ assigneeId: '', reason: '' });

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      // Check localStorage first
      const cached = localStorage.getItem(`exp_detail_${experiment.id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setExpDetail(parsed);
        setEditExp(parsed);
        setLoading(false);
        return;
      }
      const data = await experimentsApi.getById(experiment.id);
      const exp = data || experiment;
      setExpDetail(exp);
      setEditExp(exp);
      // Cache to localStorage
      localStorage.setItem(`exp_detail_${experiment.id}`, JSON.stringify(exp));
    } catch (err) {
      showToast(err.message || 'Không thể tải chi tiết', 'error');
    } finally { setLoading(false); }
  }, [experiment.id]);

  // Fetch tab data based on selected tab only
  const fetchTabData = useCallback(async (tab) => {
    try {
      setTabLoading(true);
      
      if (tab === 'tasks') {
        const data = await tasksApi.getByExperiment(experiment.id);
        setTasks(Array.isArray(data) ? data : []);
      } else if (tab === 'stages') {
        const data = await stagesApi.getByExperiment(experiment.id);
        setStages(Array.isArray(data) ? data : []);
      } else if (tab === 'groups') {
        const data = await groupsApi.getByExperiment(experiment.id);
        setGroups(Array.isArray(data) ? data : []);
      } else if (tab === 'design') {
        const data = await designApi.getByExperiment(experiment.id);
        setDesign(data || null);
      } else if (tab === 'measurements') {
        const data = await measurementsApi.getByExperiment(experiment.id);
        setMeasurements(Array.isArray(data) ? data : []);
      } else if (tab === 'schedules') {
        const data = await schedulesApi.getByExperiment(experiment.id);
        setSchedules(Array.isArray(data) ? data : []);
      } else if (tab === 'batches') {
        const data = await batchesApi.getByExperiment(experiment.id);
        setBatches(Array.isArray(data) ? data : []);
        const ba = await bedAssignmentsApi.getByExperiment(experiment.id);
        setBedAssignments(Array.isArray(ba) ? ba : []);
      } else if (tab === 'beds') {
        const ba = await bedAssignmentsApi.getByExperiment(experiment.id);
        setBedAssignments(Array.isArray(ba) ? ba : []);
      }
      // overview tab doesn't need data fetch
    } catch (err) {
      showToast(err.message || 'Lỗi tải dữ liệu tab', 'error');
    } finally { setTabLoading(false); }
  }, [experiment.id]);

  const fetchUsers = async () => {
    try {
      const data = await userApi.getUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch { setUsers([]); }
  };

  const fetchBeds = async (farmId) => {
    try {
      const areaData = await areasApi.getByFarm(farmId);
      setAreas(Array.isArray(areaData) ? areaData : []);
      const bedData = await bedsApi.getAvailableByFarm(farmId);
      setAvailableBeds(Array.isArray(bedData) ? bedData : []);
    } catch { setAreas([]); setAvailableBeds([]); }
  };

  useEffect(() => {
    fetchDetail();
    // Only fetch tab data if not already cached
    if (!fetchedTabs.has(activeTab)) {
      fetchTabData(activeTab);
      setFetchedTabs(prev => new Set([...prev, activeTab]));
    }
    if (activeTab === 'tasks' || activeTab === 'beds') {
      fetchUsers();
      fetchBeds(expDetail?.farmId);
    }
  }, [activeTab, experiment.id]);

  // Update exp status
  const handleStatusChange = async (newStatus) => {
    try {
      await experimentsApi.updateStatus(experiment.id, newStatus);
      showToast('Đã cập nhật trạng thái thí nghiệm', 'success');
      const updated = await experimentsApi.getById(experiment.id);
      setExpDetail(updated);
      if (onExperimentUpdated) onExperimentUpdated(updated);
    } catch (err) { showToast(err.message || 'Lỗi cập nhật trạng thái', 'error'); }
  };

  // Update exp details
  const handleUpdateExp = async () => {
    if (!editExp?.title?.trim()) { showToast('Tiêu đề không được trống', 'error'); return; }
    try {
      setSavingExp(true);
      await experimentsApi.update(experiment.id, {
        title: editExp.title,
        objective: editExp.objective,
        hypothesis: editExp.hypothesis,
        startDate: editExp.startDate,
        endDate: editExp.endDate,
      });
      showToast('Đã cập nhật thí nghiệm', 'success');
      setShowEditExp(false);
      const updated = await experimentsApi.getById(experiment.id);
      setExpDetail(updated);
      if (onExperimentUpdated) onExperimentUpdated(updated);
    } catch (err) { showToast(err.message || 'Lỗi cập nhật', 'error'); }
    finally { setSavingExp(false); }
  };

  // Stage CRUD
  const handleCreateStage = async () => {
    if (!stageForm.stageName.trim()) { showToast('Tên giai đoạn không được trống', 'error'); return; }
    try {
      await stagesApi.create(experiment.id, { ...stageForm, stageOrder: parseInt(stageForm.stageOrder), expectedDurationDays: stageForm.expectedDurationDays ? parseInt(stageForm.expectedDurationDays) : undefined });
      showToast('Đã tạo giai đoạn', 'success');
      setStageForm({ stageName: '', stageOrder: 1, stageType: 1, objective: '', startDate: '', endDate: '' });
      fetchTabData('stages');
    } catch (err) { showToast(err.message || 'Lỗi tạo giai đoạn', 'error'); }
  };
  const handleDeleteStage = async (id) => { openConfirm('Xóa Giai Đoạn', 'Bạn có chắc muốn xóa giai đoạn này?', async () => { try { await stagesApi.remove(id); showToast('Đã xóa giai đoạn', 'success'); fetchTabData('stages'); } catch (err) { showToast(err.message, 'error'); } }); };

  // Group CRUD
  const handleCreateGroup = async () => {
    if (!groupForm.groupName.trim()) { showToast('Tên nhóm không được trống', 'error'); return; }
    try {
      await groupsApi.create(experiment.id, { ...groupForm, groupType: parseInt(groupForm.groupType) });
      showToast('Đã tạo nhóm', 'success');
      setGroupForm({ groupName: '', groupType: 1, treatmentDescription: '' });
      fetchTabData('groups');
    } catch (err) { showToast(err.message || 'Lỗi tạo nhóm', 'error'); }
  };
  const handleDeleteGroup = async (id) => { openConfirm('Xóa Nhóm', 'Bạn có chắc muốn xóa nhóm này?', async () => { try { await groupsApi.remove(id); showToast('Đã xóa nhóm', 'success'); fetchTabData('groups'); } catch (err) { showToast(err.message, 'error'); } }); };

  // Design CRUD
  const handleSaveDesign = async () => {
    try {
      if (design) {
        await designApi.update(experiment.id, { designType: parseInt(designForm.designType), replicationCount: parseInt(designForm.replicationCount), randomizationMethod: designForm.randomizationMethod, designParameters: designForm.designParameters });
      } else {
        await designApi.create(experiment.id, { designType: parseInt(designForm.designType), replicationCount: parseInt(designForm.replicationCount), randomizationMethod: designForm.randomizationMethod, designParameters: designForm.designParameters });
      }
      showToast('Đã lưu thiết kế', 'success');
      fetchTabData('design');
    } catch (err) { showToast(err.message || 'Lỗi lưu thiết kế', 'error'); }
  };
  const handleDeleteDesign = async () => { openConfirm('Xóa Thiết Kế', 'Bạn có chắc muốn xóa thiết kế?', async () => { try { await designApi.remove(experiment.id); showToast('Đã xóa thiết kế', 'success'); fetchTabData('design'); } catch (err) { showToast(err.message, 'error'); } }); };

  // Measurement CRUD
  const handleCreateMeasurement = async () => {
    if (!measurementForm.groupId || !measurementForm.metricName.trim()) { showToast('Cần chọn nhóm và tên chỉ số', 'error'); return; }
    try {
      await measurementsApi.create(experiment.id, { ...measurementForm, targetValue: measurementForm.targetValue ? parseFloat(measurementForm.targetValue) : undefined });
      showToast('Đã tạo đo lường', 'success');
      setMeasurementForm({ groupId: '', metricName: '', unit: '', targetValue: '', description: '' });
      fetchTabData('measurements');
    } catch (err) { showToast(err.message || 'Lỗi tạo đo lường', 'error'); }
  };
  const handleDeleteMeasurement = async (id) => { openConfirm('Xóa Đo Lường', 'Bạn có chắc muốn xóa đo lường này?', async () => { try { await measurementsApi.remove(id); showToast('Đã xóa đo lường', 'success'); fetchTabData('measurements'); } catch (err) { showToast(err.message, 'error'); } }); };

  // Schedule CRUD
  const handleCreateSchedule = async () => {
    if (!scheduleForm.title.trim()) { showToast('Tiêu đề lịch không được trống', 'error'); return; }
    try {
      await schedulesApi.create(experiment.id, { ...scheduleForm, frequencyDays: parseInt(scheduleForm.frequencyDays) });
      showToast('Đã tạo lịch chăm sóc', 'success');
      setScheduleForm({ experimentStageId: '', batchId: '', title: '', instruction: '', frequencyDays: 1, taskType: 1, startDate: '', endDate: '' });
      fetchTabData('schedules');
    } catch (err) { showToast(err.message || 'Lỗi tạo lịch', 'error'); }
  };
  const handleDeleteSchedule = async (id) => { openConfirm('Xóa Lịch', 'Bạn có chắc muốn xóa lịch chăm sóc này?', async () => { try { await schedulesApi.remove(id); showToast('Đã xóa lịch', 'success'); fetchTabData('schedules'); } catch (err) { showToast(err.message, 'error'); } }); };

  // Batch CRUD
  const handleCreateBatch = async () => {
    if (!batchForm.batchCode.trim()) { showToast('Mã lô không được trống', 'error'); return; }
    if (!batchForm.experimentBedAssignmentId) { showToast('Vui lòng chọn luống đã gán', 'error'); return; }
    try {
      await batchesApi.create({ experimentId: experiment.id, ...batchForm, plantCount: batchForm.plantCount ? parseInt(batchForm.plantCount) : undefined });
      showToast('Đã tạo lô', 'success');
      setBatchForm({ experimentBedAssignmentId: '', groupId: '', batchCode: '', plantingDate: '', expectedHarvestDate: '', plantCount: '', notes: '' });
      fetchTabData('batches');
    } catch (err) { showToast(err.message || 'Lỗi tạo lô', 'error'); }
  };
  const handleDeleteBatch = async (id) => { openConfirm('Xóa Lô', 'Bạn có chắc muốn xóa lô này?', async () => { try { await batchesApi.remove(id); showToast('Đã xóa lô', 'success'); fetchTabData('batches'); } catch (err) { showToast(err.message, 'error'); } }); };

  // Bed assignment CRUD
  const handleAssignBed = async () => {
    if (!bedForm.bedId) { showToast('Vui lòng chọn luống', 'error'); return; }
    try {
      await bedAssignmentsApi.create({ experimentId: experiment.id, bedId: bedForm.bedId, areaId: bedForm.areaId || undefined });
      showToast('Đã gán luống', 'success');
      setBedForm({ areaId: '', bedId: '' });
      fetchTabData('beds');
    } catch (err) { showToast(err.message || 'Lỗi gán luống', 'error'); }
  };
  const handleDeleteBedAssignment = async (id) => { openConfirm('Xóa Gán Luống', 'Bạn có chắc muốn xóa gán luống này?', async () => { try { await bedAssignmentsApi.remove(id); showToast('Đã xóa gán luống', 'success'); fetchTabData('beds'); } catch (err) { showToast(err.message, 'error'); } }); };

  // Task generation
  const handleGenerateTasks = async (type) => {
    try {
      if (type === 'experiment') {
        await tasksApi.generateByExperiment(experiment.id);
      }
      showToast('Đã tạo tác vụ tự động', 'success');
      fetchTabData('tasks');
    } catch (err) { showToast(err.message || 'Lỗi tạo tác vụ', 'error'); }
  };

  // Task CRUD
  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) { showToast('Tiêu đề tác vụ không được trống', 'error'); return; }
    try {
      await tasksApi.create({ experimentId: experiment.id, ...taskForm });
      showToast('Đã tạo tác vụ', 'success');
      setTaskForm({ experimentStageId: '', batchId: '', careScheduleId: '', taskType: 2, title: '', description: '', requiredSkillDescription: '', dueDate: '' });
      fetchTabData('tasks');
    } catch (err) { showToast(err.message || 'Lỗi tạo tác vụ', 'error'); }
  };
  const handleDeleteTask = async (id) => { openConfirm('Xóa Tác Vụ', 'Bạn có chắc muốn xóa tác vụ này?', async () => { try { await tasksApi.remove(id); showToast('Đã xóa tác vụ', 'success'); fetchTabData('tasks'); } catch (err) { showToast(err.message, 'error'); } }); };

  // Skill match
  const handleSkillMatch = async (taskId) => {
    try {
      const matches = await tasksApi.getSkillMatches(taskId);
      setSkillMatches(Array.isArray(matches) ? matches : []);
      setSelectedTaskForAssign(taskId);
    } catch (err) { showToast(err.message || 'Lỗi tìm người phù hợp', 'error'); }
  };

  // Assign task
  const handleAssignTask = async (taskId) => {
    if (!assignForm.assigneeId) { showToast('Vui lòng chọn người được giao', 'error'); return; }
    try {
      await tasksApi.assign({ taskId, assigneeId: assignForm.assigneeId, reason: assignForm.reason });
      showToast('Đã gán tác vụ', 'success');
      setAssignForm({ assigneeId: '', reason: '' });
      setSelectedTaskForAssign(null);
      fetchTabData('tasks');
    } catch (err) { showToast(err.message || 'Lỗi gán tác vụ', 'error'); }
  };

  // Reassign
  const handleReassign = async (taskId) => {
    const newId = prompt('Nhập ID người dùng mới để chuyển giao:');
    if (!newId) return;
    const reason = prompt('Lý do chuyển giao:') || '';
    try {
      await tasksApi.reassign({ taskId, newAssigneeId: newId, reason });
      showToast('Đã chuyển giao tác vụ', 'success');
      fetchTabData('tasks');
    } catch (err) { showToast(err.message || 'Lỗi chuyển giao', 'error'); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center shrink-0 bg-indigo-50 min-h-[72px]">
          <div>
            <h3 className="font-hanken font-bold text-lg text-primary">
              {expDetail?.experimentCode || 'Chi Tiết Thí Nghiệm'}
            </h3>
            <p className="text-xs text-on-surface-variant">{expDetail?.title || '—'}</p>
          </div>
          <div className="flex items-center gap-3">
            {expDetail?.status === 'Draft' && (
              <button onClick={() => handleStatusChange('Active')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg">
                ▶ Kích Hoạt (Draft → Active)
              </button>
            )}
            {expDetail?.status === 'Active' && (
              <button onClick={() => handleStatusChange('Completed')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg">
                ✅ Kết Thúc (Active → Completed)
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 border-b border-outline-variant flex gap-1 overflow-x-auto shrink-0 bg-white min-h-[48px]">
          {DETAIL_TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-on-surface-variant hover:text-indigo-500'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6 min-h-[500px]">
          {loading ? (
            <div className="text-center py-12 text-on-surface-variant">Đang tải...</div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab exp={expDetail} editExp={editExp} setEditExp={setEditExp} showEditExp={showEditExp} setShowEditExp={setShowEditExp} onSave={handleUpdateExp} saving={savingExp} />
              )}
              {activeTab === 'stages' && (
                <StagesTab stages={stages} form={stageForm} setForm={setStageForm} onCreate={handleCreateStage} onDelete={handleDeleteStage} loading={tabLoading} />
              )}
              {activeTab === 'groups' && (
                <GroupsTab groups={groups} form={groupForm} setForm={setGroupForm} onCreate={handleCreateGroup} onDelete={handleDeleteGroup} loading={tabLoading} />
              )}
              {activeTab === 'design' && (
                <DesignTab design={design} form={designForm} setForm={setDesignForm} onSave={handleSaveDesign} onDelete={handleDeleteDesign} loading={tabLoading} />
              )}
              {activeTab === 'measurements' && (
                <MeasurementsTab measurements={measurements} groups={groups} form={measurementForm} setForm={setMeasurementForm} onCreate={handleCreateMeasurement} onDelete={handleDeleteMeasurement} loading={tabLoading} />
              )}
              {activeTab === 'schedules' && (
                <SchedulesTab schedules={schedules} stages={stages} batches={batches} form={scheduleForm} setForm={setScheduleForm} onCreate={handleCreateSchedule} onDelete={handleDeleteSchedule} loading={tabLoading} />
              )}
              {activeTab === 'batches' && (
                <BatchesTab batches={batches} bedAssignments={bedAssignments} groups={groups} form={batchForm} setForm={setBatchForm} onCreate={handleCreateBatch} onDelete={handleDeleteBatch} loading={tabLoading} />
              )}
              {activeTab === 'tasks' && (
                <TasksTab
                  tasks={tasks} stages={stages} batches={batches}
                  form={taskForm} setForm={setTaskForm}
                  users={users} assignForm={assignForm} setAssignForm={setAssignForm}
                  skillMatches={skillMatches} selectedTaskForAssign={selectedTaskForAssign}
                  onCreate={handleCreateTask} onDelete={handleDeleteTask}
                  onGenerate={(type) => handleGenerateTasks(type)}
                  onSkillMatch={handleSkillMatch} onAssign={handleAssignTask} onReassign={handleReassign}
                  loading={tabLoading}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={() => { confirmDialog.onConfirm?.(); setConfirmDialog({ ...confirmDialog, isOpen: false }); }}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
};

// ── Overview Tab ────────────────────────────────────────────────────────────────

const OverviewTab = ({ exp, editExp, setEditExp, showEditExp, setShowEditExp, onSave, saving }) => (
  <div className="space-y-4">
    <div className="flex justify-end">
      <button onClick={() => setShowEditExp(!showEditExp)} className="text-xs font-bold text-indigo-600 hover:underline">
        {showEditExp ? 'Đóng chỉnh sửa' : '✏️ Chỉnh sửa'}
      </button>
    </div>
    {showEditExp && editExp ? (
      <div className="bg-indigo-50 rounded-xl p-4 space-y-3 border border-indigo-100">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-on-surface-variant">Tiêu Đề</label>
            <input value={editExp.title || ''} onChange={e => setEditExp({ ...editExp, title: e.target.value })}
              className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-on-surface-variant">Ngày Bắt Đầu</label>
            <input type="date" value={editExp.startDate || ''} onChange={e => setEditExp({ ...editExp, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-on-surface-variant">Ngày Kết Thúc</label>
            <input type="date" value={editExp.endDate || ''} onChange={e => setEditExp({ ...editExp, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white" />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant">Mục Tiêu</label>
          <textarea value={editExp.objective || ''} onChange={e => setEditExp({ ...editExp, objective: e.target.value })}
            rows={3} className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white resize-none" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant">Giả Thuyết</label>
          <input value={editExp.hypothesis || ''} onChange={e => setEditExp({ ...editExp, hypothesis: e.target.value })}
            className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white" />
        </div>
        <button onClick={onSave} disabled={saving}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
          {saving ? 'Đang lưu...' : '💾 Lưu Thay Đổi'}
        </button>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-3 text-xs">
        {[
          { label: 'Mã TN', value: exp?.experimentCode },
          { label: 'Trạng Thái', value: <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[exp?.status] || 'bg-slate-100 text-slate-600'}`}>{exp?.status}</span> },
          { label: 'Nông Trại', value: exp?.farmName || '—' },
          { label: 'Nghiên Cứu Viên', value: exp?.researcherName || '—' },
          { label: 'Giống Cây', value: exp?.cropVarietyName || '—' },
          { label: 'Ngày Bắt Đầu', value: exp?.startDate || '—' },
          { label: 'Ngày Kết Thúc', value: exp?.endDate || '—' },
        ].map(item => (
          <div key={item.label} className="p-3 bg-surface-container-low/30 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">{item.label}</span>
            <span className="font-semibold text-sm">{item.value}</span>
          </div>
        ))}
        {exp?.objective && (
          <div className="col-span-2 p-3 bg-surface-container-low/30 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Mục Tiêu</span>
            <p className="text-sm whitespace-pre-line">{exp.objective}</p>
          </div>
        )}
        {exp?.hypothesis && (
          <div className="col-span-2 p-3 bg-surface-container-low/30 rounded-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1">Giả Thuyết</span>
            <p className="text-sm">{exp.hypothesis}</p>
          </div>
        )}
      </div>
    )}
  </div>
);

// ── Stages Tab ─────────────────────────────────────────────────────────────────

const StagesTab = ({ stages, form, setForm, onCreate, onDelete, loading }) => (
  <div className="space-y-4">
    {/* Create form */}
    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
      <h4 className="text-xs font-bold text-blue-700 mb-3">+ Thêm Giai Đoạn Mới</h4>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input placeholder="Tên giai đoạn *" value={form.stageName} onChange={e => setForm({ ...form, stageName: e.target.value })}
          className="px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white" />
        <input type="number" placeholder="Thứ tự" value={form.stageOrder} onChange={e => setForm({ ...form, stageOrder: e.target.value })}
          className="px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white" />
        <select value={form.stageType} onChange={e => setForm({ ...form, stageType: parseInt(e.target.value) })}
          className="px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white">
          {STAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
          className="px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white" />
        <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
          className="px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white" />
      </div>
      <textarea placeholder="Mục tiêu giai đoạn" value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })}
        rows={2} className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white mb-3 resize-none" />
      <button onClick={onCreate} disabled={loading}
        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
        + Tạo Giai Đoạn
      </button>
    </div>

    {/* List */}
    {loading ? <p className="text-center text-sm text-on-surface-variant py-4">Đang tải...</p> :
      stages.length === 0 ? <p className="text-center text-sm text-on-surface-variant py-4">Chưa có giai đoạn nào.</p> :
      <div className="space-y-2">
        {stages.map(s => (
          <div key={s.id} className="flex items-center gap-3 p-3 bg-white border border-outline-variant rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">{s.stageOrder}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">{s.stageName || '—'}</p>
              <p className="text-[10px] text-on-surface-variant">{STAGE_TYPES.find(t => t.value === s.stageType)?.label || '—'} · {s.startDate || '—'} → {s.endDate || '—'}</p>
            </div>
            <button onClick={() => onDelete(s.id)} className="text-rose-400 hover:text-rose-600 text-xs font-bold shrink-0">✕ Xóa</button>
          </div>
        ))}
      </div>
    }
  </div>
);

// ── Groups Tab ─────────────────────────────────────────────────────────────────

const GroupsTab = ({ groups, form, setForm, onCreate, onDelete, loading }) => (
  <div className="space-y-4">
    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
      <h4 className="text-xs font-bold text-emerald-700 mb-3">+ Thêm Nhóm Mới</h4>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input placeholder="Tên nhóm *" value={form.groupName} onChange={e => setForm({ ...form, groupName: e.target.value })}
          className="px-3 py-2 border border-emerald-200 rounded-lg text-sm bg-white" />
        <select value={form.groupType} onChange={e => setForm({ ...form, groupType: parseInt(e.target.value) })}
          className="px-3 py-2 border border-emerald-200 rounded-lg text-sm bg-white">
          {GROUP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <div className="col-span-2">
          <textarea placeholder="Mô tả xử lý" value={form.treatmentDescription} onChange={e => setForm({ ...form, treatmentDescription: e.target.value })}
            rows={2} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm bg-white resize-none" />
        </div>
      </div>
      <button onClick={onCreate} disabled={loading}
        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
        + Tạo Nhóm
      </button>
    </div>

    {loading ? <p className="text-center text-sm text-on-surface-variant py-4">Đang tải...</p> :
      groups.length === 0 ? <p className="text-center text-sm text-on-surface-variant py-4">Chưa có nhóm nào.</p> :
      <div className="space-y-2">
        {groups.map(g => (
          <div key={g.id} className="flex items-center gap-3 p-3 bg-white border border-outline-variant rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">
              {GROUP_TYPES.find(t => t.value === g.groupType)?.label?.split(' ')[0] || 'N'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">{g.groupName || '—'}</p>
              <p className="text-[10px] text-on-surface-variant">{GROUP_TYPES.find(t => t.value === g.groupType)?.label || '—'}</p>
              {g.treatmentDescription && <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">{g.treatmentDescription}</p>}
            </div>
            <button onClick={() => onDelete(g.id)} className="text-rose-400 hover:text-rose-600 text-xs font-bold shrink-0">✕ Xóa</button>
          </div>
        ))}
      </div>
    }
  </div>
);

// ── Design Tab ────────────────────────────────────────────────────────────────

// Parse designParameters từ JSON string/object
const parseDesignParams = (params) => {
  if (!params) return {};
  if (typeof params === 'string') {
    try { return JSON.parse(params); } catch { return {}; }
  }
  return params;
};

// Section card component
const SectionCard = ({ title, icon, children, color = 'purple' }) => {
  const colorMap = {
    purple: 'bg-purple-50 border-purple-100',
    blue: 'bg-blue-50 border-blue-100',
    green: 'bg-green-50 border-green-100',
    amber: 'bg-amber-50 border-amber-100',
  };
  const iconColor = {
    purple: 'text-purple-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
    amber: 'text-amber-600',
  };
  return (
    <div className={`rounded-xl p-4 border ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-lg ${iconColor[color]}`}>{icon}</span>
        <h4 className={`text-xs font-bold ${color === 'purple' ? 'text-purple-700' : color === 'blue' ? 'text-blue-700' : color === 'green' ? 'text-green-700' : 'text-amber-700'}`}>{title}</h4>
      </div>
      {children}
    </div>
  );
};

// Input field component
const DesignField = ({ label, value, onChange, type = 'text', unit, step, placeholder, readOnly }) => (
  <div>
    <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">{label}</label>
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        step={step}
        className="w-full px-3 py-2 border border-white/50 rounded-lg text-sm bg-white/70 focus:bg-white focus:border-purple-400 transition-colors" />
      {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{unit}</span>}
    </div>
  </div>
);

const DesignTab = ({ design, form, setForm, onSave, onDelete, loading }) => {
  const params = parseDesignParams(form.designParameters);

  const updateParam = (key, value) => {
    const newParams = { ...params, [key]: value };
    setForm({ ...form, designParameters: JSON.stringify(newParams) });
  };

  const generateSeed = () => {
    updateParam('randomSeed', Math.floor(Math.random() * 999999) + 1);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
        <h4 className="text-xs font-bold text-purple-700 mb-3">
          {design ? '🔧 Chỉnh Sửa Thiết Kế Thí Nghiệm' : '📐 Tạo Thiết Kế Thí Nghiệm'}
        </h4>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Loại Thiết Kế</label>
            <select value={form.designType} onChange={e => setForm({ ...form, designType: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-white">
              {DESIGN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Số Lần Lặp</label>
            <input type="number" value={form.replicationCount} onChange={e => setForm({ ...form, replicationCount: parseInt(e.target.value) || 1 })}
              min="1" max="10" className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Số Nhóm Xử Lý</label>
            <input type="number" value={params.treatments || ''} onChange={e => updateParam('treatments', parseInt(e.target.value) || 0)}
              min="1" placeholder="VD: 4" className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-white" />
          </div>
        </div>
      </div>

      {/* 1. Experimental Layout */}
      <SectionCard title="1. Experimental Layout" icon="📏" color="purple">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <DesignField label="Row Spacing" value={params.spacing?.row || ''} onChange={e => updateParam('spacing', { ...params.spacing, row: e.target.value })} unit="cm" placeholder="50" />
          <DesignField label="Plant Spacing" value={params.spacing?.plant || ''} onChange={e => updateParam('spacing', { ...params.spacing, plant: e.target.value })} unit="cm" placeholder="30" />
          <DesignField label="Plants per Plot" value={params.plantsPerPlot || ''} onChange={e => updateParam('plantsPerPlot', parseInt(e.target.value) || 0)} placeholder="25" />
          <DesignField label="Rows per Plot" value={params.rowsPerPlot || ''} onChange={e => updateParam('rowsPerPlot', parseInt(e.target.value) || 0)} placeholder="5" />
          <DesignField label="Beds Required" value={params.bedsRequired || ''} onChange={e => updateParam('bedsRequired', parseInt(e.target.value) || 0)} placeholder="Auto" readOnly />
          <DesignField label="Layout Type" value={params.layout || ''} onChange={e => updateParam('layout', e.target.value)} placeholder="RCBD" />
        </div>
      </SectionCard>

      {/* 2. Plot Configuration */}
      <SectionCard title="2. Plot Configuration" icon="📐" color="blue">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <DesignField label="Plot Length" value={params.plotLength || ''} onChange={e => updateParam('plotLength', parseFloat(e.target.value) || 0)} unit="m" step="0.1" placeholder="5" />
          <DesignField label="Plot Width" value={params.plotWidth || ''} onChange={e => updateParam('plotWidth', parseFloat(e.target.value) || 0)} unit="m" step="0.1" placeholder="2" />
          <DesignField label="Plot Area" value={params.plotArea ? `${params.plotArea} m²` : ''} onChange={e => updateParam('plotArea', parseFloat(e.target.value) || 0)} unit="m²" step="0.1" placeholder="10" />
          <DesignField label="Buffer Zone" value={params.bufferZone || ''} onChange={e => updateParam('bufferZone', e.target.value)} unit="m" placeholder="1" />
          <DesignField label="Buffer Distance" value={params.bufferDistance || ''} onChange={e => updateParam('bufferDistance', parseInt(e.target.value) || 0)} unit="cm" placeholder="50" />
          <DesignField label="Border Rows" value={params.borderRows || ''} onChange={e => updateParam('borderRows', parseInt(e.target.value) || 0)} placeholder="1" />
          <DesignField label="Block Count" value={params.blockCount || ''} onChange={e => updateParam('blockCount', parseInt(e.target.value) || 0)} placeholder="3" />
          <DesignField label="Total Plots" value={params.totalPlots || ''} onChange={e => updateParam('totalPlots', parseInt(e.target.value) || 0)} placeholder="Auto" readOnly />
        </div>
      </SectionCard>

      {/* 3. Randomization */}
      <SectionCard title="3. Randomization" icon="🎲" color="green">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DesignField label="Random Seed" value={params.randomSeed || ''} onChange={e => updateParam('randomSeed', parseInt(e.target.value) || 0)} placeholder="2026" />
          <div>
            <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Randomization Method</label>
            <select value={form.randomizationMethod} onChange={e => setForm({ ...form, randomizationMethod: e.target.value })}
              className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm bg-white">
              <option value="CRD">CRD - Completely Randomized Design</option>
              <option value="RCBD">RCBD - Randomized Complete Block Design</option>
              <option value="RBCD">RBCD - Randomized Block Complete Design</option>
              <option value="LSD">LSD - Latin Square Design</option>
              <option value="Factorial">Factorial Design</option>
              <option value="SplitPlot">Split-Plot Design</option>
            </select>
          </div>
          <DesignField label="Blocking Variable" value={params.blockingVariable || ''} onChange={e => updateParam('blockingVariable', e.target.value)} placeholder="Light, Soil, etc." />
        </div>
        <div className="mt-3">
          <button onClick={generateSeed} type="button"
            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors">
            🎲 Generate Random Seed
          </button>
        </div>
      </SectionCard>

      {/* 4. Environmental Conditions */}
      <SectionCard title="4. Environmental Conditions" icon="🌡️" color="amber">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Target Temperature</label>
            <div className="flex items-center gap-1">
              <input type="number" value={params.envConditions?.temperatureMin || ''} onChange={e => updateParam('envConditions', { ...params.envConditions, temperatureMin: parseFloat(e.target.value) || 0 })}
                placeholder="20" className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white/70" />
              <span className="text-gray-400">-</span>
              <input type="number" value={params.envConditions?.temperatureMax || ''} onChange={e => updateParam('envConditions', { ...params.envConditions, temperatureMax: parseFloat(e.target.value) || 0 })}
                placeholder="30" className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white/70" />
              <span className="text-xs text-gray-400">°C</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Target Humidity</label>
            <div className="flex items-center gap-1">
              <input type="number" value={params.envConditions?.humidityMin || ''} onChange={e => updateParam('envConditions', { ...params.envConditions, humidityMin: parseFloat(e.target.value) || 0 })}
                placeholder="60" className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white/70" />
              <span className="text-gray-400">-</span>
              <input type="number" value={params.envConditions?.humidityMax || ''} onChange={e => updateParam('envConditions', { ...params.envConditions, humidityMax: parseFloat(e.target.value) || 0 })}
                placeholder="80" className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white/70" />
              <span className="text-xs text-gray-400">%</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Target pH</label>
            <div className="flex items-center gap-1">
              <input type="number" value={params.envConditions?.phMin || ''} onChange={e => updateParam('envConditions', { ...params.envConditions, phMin: parseFloat(e.target.value) || 0 })}
                placeholder="6.0" step="0.1" className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white/70" />
              <span className="text-gray-400">-</span>
              <input type="number" value={params.envConditions?.phMax || ''} onChange={e => updateParam('envConditions', { ...params.envConditions, phMax: parseFloat(e.target.value) || 0 })}
                placeholder="6.5" step="0.1" className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white/70" />
            </div>
          </div>
          <DesignField label="Target Light" value={params.envConditions?.light || ''} onChange={e => updateParam('envConditions', { ...params.envConditions, light: e.target.value })} unit="Lux" placeholder="10000" />
        </div>
      </SectionCard>

      {/* Notes */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Ghi Chú Thiết Kế</label>
        <textarea value={params.notes || ''} onChange={e => updateParam('notes', e.target.value)}
          placeholder="Mô tả chi tiết về thiết kế thí nghiệm..."
          rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white resize-none" />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onSave} disabled={loading}
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors shadow-lg shadow-purple-200">
          💾 {design ? 'Cập Nhật Thiết Kế' : 'Tạo Thiết Kế'}
        </button>
        {design && (
          <button onClick={onDelete}
            className="px-6 py-2.5 border border-rose-300 text-rose-500 hover:bg-rose-50 rounded-xl text-sm font-bold transition-colors">
            ✕ Xóa Thiết Kế
          </button>
        )}
      </div>
    </div>
  );
};

// ── Measurements Tab ─────────────────────────────────────────────────────────────

const MeasurementsTab = ({ measurements, groups, form, setForm, onCreate, onDelete, loading }) => (
  <div className="space-y-4">
    <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
      <h4 className="text-xs font-bold text-teal-700 mb-3">+ Thêm Chỉ Số Đo Lường</h4>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Nhóm *</label>
          <select value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value })}
            className="w-full px-3 py-2 border border-teal-200 rounded-lg text-sm bg-white">
            <option value="">— Chọn nhóm —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.groupName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Tên Chỉ Số *</label>
          <input value={form.metricName} onChange={e => setForm({ ...form, metricName: e.target.value })}
            placeholder="VD: Chiều cao cây"
            className="w-full px-3 py-2 border border-teal-200 rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Đơn Vị</label>
          <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
            placeholder="VD: cm, kg"
            className="w-full px-3 py-2 border border-teal-200 rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Giá Trị Mục Tiêu</label>
          <input type="number" step="0.1" value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.target.value })}
            className="w-full px-3 py-2 border border-teal-200 rounded-lg text-sm bg-white" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Mô Tả</label>
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Mô tả phương pháp đo"
            className="w-full px-3 py-2 border border-teal-200 rounded-lg text-sm bg-white" />
        </div>
      </div>
      <button onClick={onCreate} disabled={loading}
        className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
        + Tạo Chỉ Số
      </button>
    </div>

    {loading ? <p className="text-center text-sm text-on-surface-variant py-4">Đang tải...</p> :
      measurements.length === 0 ? <p className="text-center text-sm text-on-surface-variant py-4">Chưa có chỉ số nào.</p> :
      <div className="overflow-x-auto bg-white border border-outline-variant rounded-xl">
        <table className="w-full text-xs">
          <thead className="bg-teal-50 border-b border-teal-100">
            <tr>
              {['Nhóm', 'Chỉ Số', 'Đơn Vị', 'Mục Tiêu', 'Mô Tả', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left font-bold text-teal-700 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {measurements.map(m => (
              <tr key={m.id} className="hover:bg-surface-container/20">
                <td className="px-4 py-3 font-semibold">{groups.find(g => g.id === m.groupId)?.groupName || m.groupId || '—'}</td>
                <td className="px-4 py-3 font-semibold">{m.metricName || '—'}</td>
                <td className="px-4 py-3 text-on-surface-variant">{m.unit || '—'}</td>
                <td className="px-4 py-3 text-emerald-700 font-bold">{m.targetValue !== null && m.targetValue !== undefined ? m.targetValue : '—'}</td>
                <td className="px-4 py-3 text-on-surface-variant max-w-[150px] truncate">{m.description || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onDelete(m.id)} className="text-rose-400 hover:text-rose-600 font-bold">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    }
  </div>
);

// ── Schedules Tab ───────────────────────────────────────────────────────────────

const SchedulesTab = ({ schedules, stages, batches, form, setForm, onCreate, onDelete, loading }) => (
  <div className="space-y-4">
    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
      <h4 className="text-xs font-bold text-amber-700 mb-3">+ Thêm Lịch Chăm Sóc</h4>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Giai Đoạn</label>
          <select value={form.experimentStageId} onChange={e => setForm({ ...form, experimentStageId: e.target.value })}
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white">
            <option value="">— Chọn giai đoạn —</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.stageName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Lô</label>
          <select value={form.batchId} onChange={e => setForm({ ...form, batchId: e.target.value })}
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white">
            <option value="">— Chọn lô —</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.batchCode}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Loại Tác Vụ</label>
          <select value={form.taskType} onChange={e => setForm({ ...form, taskType: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white">
            {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Tiêu Đề Lịch *</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="VD: Tưới nước buổi sáng"
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Hướng Dẫn</label>
          <textarea value={form.instruction} onChange={e => setForm({ ...form, instruction: e.target.value })}
            rows={2} placeholder="Mô tả chi tiết công việc..."
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white resize-none" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Tần Suất (ngày)</label>
          <input type="number" value={form.frequencyDays} onChange={e => setForm({ ...form, frequencyDays: e.target.value })}
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Ngày Bắt Đầu</label>
          <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Ngày Kết Thúc</label>
          <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white" />
        </div>
      </div>
      <button onClick={onCreate} disabled={loading}
        className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
        + Tạo Lịch Chăm Sóc
      </button>
    </div>

    {loading ? <p className="text-center text-sm text-on-surface-variant py-4">Đang tải...</p> :
      schedules.length === 0 ? <p className="text-center text-sm text-on-surface-variant py-4">Chưa có lịch nào.</p> :
      <div className="space-y-2">
        {schedules.map(sc => (
          <div key={sc.id} className="flex items-center gap-3 p-3 bg-white border border-outline-variant rounded-xl">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">{sc.title || '—'}</p>
              <p className="text-[10px] text-on-surface-variant">
                {sc.frequencyDays ? `${sc.frequencyDays} ngày/lần · ` : ''}
                {sc.startDate || '—'} → {sc.endDate || '—'}
              </p>
              {sc.instruction && <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">{sc.instruction}</p>}
            </div>
            <button onClick={() => onDelete(sc.id)} className="text-rose-400 hover:text-rose-600 text-xs font-bold shrink-0">✕ Xóa</button>
          </div>
        ))}
      </div>
    }
  </div>
);

// ── Batches Tab ───────────────────────────────────────────────────────────────

const BatchesTab = ({ batches, bedAssignments, groups, form, setForm, onCreate, onDelete, loading }) => (
  <div className="space-y-4">
    {/* Info banner if no beds assigned */}
    {bedAssignments.length === 0 && (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        ⚠️ Chưa có luống nào được gán cho thí nghiệm này. Vui lòng liên hệ Manager để gán luống trước khi tạo lô.
      </div>
    )}
    <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
      <h4 className="text-xs font-bold text-rose-700 mb-3">+ Thêm Lô Mới</h4>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Mã Lô *</label>
          <input value={form.batchCode} onChange={e => setForm({ ...form, batchCode: e.target.value })}
            placeholder="VD: BATCH001"
            className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Luống Đã Gán *</label>
          <select value={form.experimentBedAssignmentId} onChange={e => setForm({ ...form, experimentBedAssignmentId: e.target.value })}
            className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm bg-white">
            <option value="">— Chọn luống —</option>
            {bedAssignments.map(ba => (
              <option key={ba.id} value={ba.id}>
                {ba.bedName || ba.bedCode || 'Luống'} {ba.areaName ? `(${ba.areaName})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Nhóm</label>
          <select value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value })}
            className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm bg-white">
            <option value="">— Chọn nhóm —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.groupName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Ngày Trồng</label>
          <input type="date" value={form.plantingDate} onChange={e => setForm({ ...form, plantingDate: e.target.value })}
            className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Ngày Dự Kiến Thu Hoạch</label>
          <input type="date" value={form.expectedHarvestDate} onChange={e => setForm({ ...form, expectedHarvestDate: e.target.value })}
            className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Số Cây</label>
          <input type="number" value={form.plantCount} onChange={e => setForm({ ...form, plantCount: e.target.value })}
            className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm bg-white" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Ghi Chú</label>
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            className="w-full px-3 py-2 border border-rose-200 rounded-lg text-sm bg-white" />
        </div>
      </div>
      <button onClick={onCreate} disabled={loading}
        className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
        + Tạo Lô
      </button>
    </div>

    {loading ? <p className="text-center text-sm text-on-surface-variant py-4">Đang tải...</p> :
      batches.length === 0 ? <p className="text-center text-sm text-on-surface-variant py-4">Chưa có lô nào.</p> :
      <div className="overflow-x-auto bg-white border border-outline-variant rounded-xl">
        <table className="w-full text-xs">
          <thead className="bg-rose-50 border-b border-rose-100">
            <tr>{['Mã Lô', 'Luống', 'Nhóm', 'Ngày Trồng', 'Dự Kiến Thu Hoạch', 'Số Cây', ''].map(h => (
              <th key={h} className="px-4 py-3 text-left font-bold text-rose-700 uppercase">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {batches.map(b => (
              <tr key={b.id} className="hover:bg-surface-container/20">
                <td className="px-4 py-3 font-bold font-mono">{b.batchCode || '—'}</td>
                <td className="px-4 py-3">{b.bedName || b.bedCode || bedAssignments.find(ba => ba.id === b.experimentBedAssignmentId)?.bedName || '—'}</td>
                <td className="px-4 py-3">{groups.find(g => g.id === b.groupId)?.groupName || '—'}</td>
                <td className="px-4 py-3 font-mono">{b.plantingDate || '—'}</td>
                <td className="px-4 py-3 font-mono">{b.expectedHarvestDate || '—'}</td>
                <td className="px-4 py-3 font-bold">{b.plantCount || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onDelete(b.id)} className="text-rose-400 hover:text-rose-600 font-bold">✕ Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    }
  </div>
);

// ── Beds Tab ─────────────────────────────────────────────────────────────────

const BedsTab = ({ bedAssignments, availableBeds, areas, form, setForm, onAssign, onDelete, loading }) => (
  <div className="space-y-4">
    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
      <h4 className="text-xs font-bold text-green-700 mb-3">+ Gán Luống Vào Thí Nghiệm</h4>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Khu Vực</label>
          <select value={form.areaId} onChange={e => setForm({ ...form, areaId: e.target.value })}
            className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm bg-white">
            <option value="">— Chọn khu vực —</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.areaName || a.name || a.id}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Luống Trống</label>
          <select value={form.bedId} onChange={e => setForm({ ...form, bedId: e.target.value })}
            className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm bg-white">
            <option value="">— Chọn luống —</option>
            {availableBeds.map(b => <option key={b.id} value={b.id}>{b.bedName || b.bedCode || b.name || b.id}</option>)}
          </select>
        </div>
      </div>
      <button onClick={onAssign} disabled={loading}
        className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
        + Gán Luống
      </button>
    </div>

    {loading ? <p className="text-center text-sm text-on-surface-variant py-4">Đang tải...</p> :
      bedAssignments.length === 0 ? <p className="text-center text-sm text-on-surface-variant py-4">Chưa gán luống nào.</p> :
      <div className="space-y-2">
        {bedAssignments.map(ba => (
          <div key={ba.id} className="flex items-center gap-3 p-3 bg-white border border-outline-variant rounded-xl">
            <span className="text-lg">🌱</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">{ba.bedName || ba.bedCode || ba.id || '—'}</p>
              <p className="text-[10px] text-on-surface-variant">{ba.areaName ? `Khu vực: ${ba.areaName}` : ''}</p>
            </div>
            <button onClick={() => onDelete(ba.id)} className="text-rose-400 hover:text-rose-600 text-xs font-bold shrink-0">✕ Xóa</button>
          </div>
        ))}
      </div>
    }
  </div>
);

// ── Tasks Tab ────────────────────────────────────────────────────────────────

const TasksTab = ({
  tasks, stages, batches, form, setForm,
  users, assignForm, setAssignForm, skillMatches, selectedTaskForAssign,
  onCreate, onDelete, onGenerate, onSkillMatch, onAssign, onReassign, loading
}) => (
  <div className="space-y-4">
    {/* Generate + Create */}
    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
      <h4 className="text-xs font-bold text-indigo-700 mb-3">Tạo Tác Vụ</h4>
      <div className="flex gap-2 mb-3 flex-wrap">
        <button onClick={() => onGenerate('experiment')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg">
          ⚡ Tạo Tự Động Tất Cả
        </button>
        <button onClick={() => onGenerate('stage')}
          className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200">
          🔄 Tạo Theo Giai Đoạn
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Giai Đoạn</label>
          <select value={form.experimentStageId} onChange={e => setForm({ ...form, experimentStageId: e.target.value })}
            className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white">
            <option value="">— Chọn giai đoạn —</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.stageName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Lô</label>
          <select value={form.batchId} onChange={e => setForm({ ...form, batchId: e.target.value })}
            className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white">
            <option value="">— Chọn lô —</option>
            {batches.map(b => <option key={b.id} value={b.id}>{b.batchCode}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Loại Tác Vụ</label>
          <select value={form.taskType} onChange={e => setForm({ ...form, taskType: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white">
            {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Hạn Chót</label>
          <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
            className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Tiêu Đề Tác Vụ *</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="VD: Tưới nước ngày 01/07"
            className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Mô Tả</label>
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Mô tả chi tiết tác vụ"
            className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Yêu Cầu Kỹ Năng</label>
          <input value={form.requiredSkillDescription} onChange={e => setForm({ ...form, requiredSkillDescription: e.target.value })}
            placeholder="VD: Vận hành hệ thống tưới tự động"
            className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white" />
        </div>
      </div>
      <button onClick={onCreate} disabled={loading}
        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
        + Tạo Tác Vụ Thủ Công
      </button>
    </div>

    {/* Skill match panel */}
    {selectedTaskForAssign && (
      <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
        <h4 className="text-xs font-bold text-yellow-700 mb-3">🔍 Người Phù Hợp với Tác Vụ</h4>
        {skillMatches.length === 0 ? (
          <p className="text-xs text-on-surface-variant">Đang tìm...</p>
        ) : (
          <div className="space-y-2 mb-3">
            {skillMatches.map(m => (
              <div key={m.userId} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-yellow-100">
                <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-xs font-bold text-yellow-700">{(m.fullName || '?')[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{m.fullName || m.userId}</p>
                  <p className="text-[10px] text-on-surface-variant">{m.roleName} · Match: {m.matchScore || 'N/A'}%</p>
                </div>
                <button onClick={() => onAssign(selectedTaskForAssign)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shrink-0">
                  Gán
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-yellow-200">
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Hoặc chọn người dùng</label>
          <div className="flex gap-2">
            <select value={assignForm.assigneeId} onChange={e => setAssignForm({ ...assignForm, assigneeId: e.target.value })}
              className="flex-1 px-3 py-2 border border-yellow-200 rounded-lg text-sm bg-white">
              <option value="">— Chọn người dùng —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.fullName || u.email}</option>)}
            </select>
            <button onClick={() => onAssign(selectedTaskForAssign)} disabled={!assignForm.assigneeId}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl text-xs font-bold disabled:opacity-50">
              Gán Tác Vụ
            </button>
          </div>
        </div>
        <button onClick={() => { setSelectedTaskForAssign(null); setSkillMatches([]); }}
          className="mt-2 text-xs text-slate-500 hover:underline">Đóng</button>
      </div>
    )}

    {/* Task list */}
    {loading ? <p className="text-center text-sm text-on-surface-variant py-4">Đang tải...</p> :
      tasks.length === 0 ? <p className="text-center text-sm text-on-surface-variant py-4">Chưa có tác vụ nào.</p> :
      <div className="space-y-2">
        {tasks.map(t => (
          <div key={t.id} className="flex items-center gap-3 p-3 bg-white border border-outline-variant rounded-xl">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-sm font-semibold text-on-surface truncate">{t.title || '—'}</p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[t.status] || 'bg-slate-100 text-slate-600'}`}>
                  {t.status || '—'}
                </span>
                {t.taskType && <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-600">{t.taskType}</span>}
              </div>
              <p className="text-[10px] text-on-surface-variant">
                {t.experimentStageName || t.batchCode || t.experimentTitle ? `${t.experimentStageName || ''} ${t.batchCode || ''} ${t.experimentTitle || ''}` : ''} · {t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : '—'}
              </p>
              {t.assignedToName && <p className="text-[10px] text-emerald-600 font-semibold">👤 {t.assignedToName}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0 flex-wrap">
              <button onClick={() => onSkillMatch(t.id)}
                className="px-2 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg text-[10px] font-bold">
                🎯 Match
              </button>
              <button onClick={() => onReassign(t.id)}
                className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-[10px] font-bold">
                🔄 Reassign
              </button>
              <button onClick={() => onDelete(t.id)} className="px-2 py-1 text-rose-400 hover:text-rose-600 text-[10px] font-bold">✕</button>
            </div>
          </div>
        ))}
      </div>
    }
  </div>
);

// ── Create Experiment Modal ─────────────────────────────────────────────────────────

const CreateExpModal = ({ open, onClose, farms, cropVarieties, form, setForm, errors, onSubmit, loading }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center shrink-0 bg-indigo-50">
          <h3 className="font-hanken font-bold text-lg text-primary">+ Tạo Thí Nghiệm Mới</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Nông Trại <span className="text-rose-500">*</span></label>
              <select value={form.farmId} onChange={e => setForm({ ...form, farmId: e.target.value })}
                className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${errors.farmId ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`}>
                <option value="">— Chọn nông trại —</option>
                {farms.map(f => <option key={f.id} value={f.id}>{f.farmName}</option>)}
              </select>
              {errors.farmId && <p className="text-xs text-rose-600 mt-1">{errors.farmId}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Tiêu Đề <span className="text-rose-500">*</span></label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="VD: Thí nghiệm giống lúa ST25 mùa đông"
                  className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${errors.title ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`} />
                {errors.title && <p className="text-xs text-rose-600 mt-1">{errors.title}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Mã Thí Nghiệm</label>
                <input type="text" value={form.experimentCode} onChange={e => setForm({ ...form, experimentCode: e.target.value })}
                  placeholder="VD: EXP001 (tự động nếu trống)"
                  className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Giống Cây Trồng</label>
              <select value={form.cropVarietyId} onChange={e => setForm({ ...form, cropVarietyId: e.target.value })}
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
              <textarea value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })}
                placeholder="Mô tả mục tiêu cụ thể của thí nghiệm..."
                rows={3}
                className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none ${errors.objective ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`} />
              {errors.objective && <p className="text-xs text-rose-600 mt-1">{errors.objective}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Giả Thuyết</label>
              <input type="text" value={form.hypothesis} onChange={e => setForm({ ...form, hypothesis: e.target.value })}
                placeholder="VD: Giống lúa ST25 cho năng suất cao hơn 20%"
                className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Ngày Bắt Đầu</label>
                <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                  className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Ngày Kết Thúc</label>
                <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                  className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${errors.endDate ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`} />
                {errors.endDate && <p className="text-xs text-rose-600 mt-1">{errors.endDate}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="px-5 py-2.5 border border-outline-variant rounded-xl text-sm font-medium hover:bg-surface-container/50 transition-all">
                Hủy
              </button>
              <button type="submit" disabled={loading}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50">
                {loading ? 'Đang tạo...' : 'Tạo Thí Nghiệm'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResearcherExperiments;
