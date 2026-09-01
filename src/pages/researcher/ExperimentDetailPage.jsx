import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { experimentsApi, measurementRecordsApi, taskReportsApi } from '../../api/experimentApi';
import { stagesApi, groupsApi, measurementsApi, batchesApi, schedulesApi, tasksApi } from '../../api/researcherApi';
import { bedAssignmentsApi } from '../../api/managerResourcesApi';
import { userApi } from '../../api/researcherApi';
import { aggregatePlantCountFromReports } from '../../utils/measurement';
import { autoFillAllFields, autoFillFromDynamicSchema, computeResultsByGroup, isPerGroupStage, getAutoFillFieldKeys, buildGrowthResultSchema } from '../../utils/stageResultCompute';
import { useToast } from '../../context/ToastContext';
import ExperimentOverviewSummary from '../../components/researcher/ExperimentOverviewSummary';
import StatisticsDashboard from '../../components/researcher/StatisticsDashboard';

const Portal = ({ children }) => {
  return children;
};

// ── Stage Type Definitions ──────────────────────────────────────────────────
const STAGE_TYPES = [
  { value: 'Preparation', label: 'Chuẩn bị', icon: '🛠️', color: 'amber' },
  { value: 'Planting', label: 'Gieo trồng', icon: '🌱', color: 'emerald' },
  { value: 'Nursery', label: 'Ươm cây', icon: '🪴', color: 'emerald' },
  { value: 'Care', label: 'Chăm sóc', icon: '💧', color: 'blue' },
  { value: 'Growing', label: 'Sinh trưởng', icon: '📈', color: 'teal' },
  { value: 'Growth', label: 'Theo dõi sinh trưởng', icon: '📊', color: 'teal' },
  { value: 'Evaluation', label: 'Đánh giá', icon: '✅', color: 'amber' },
  { value: 'Harvesting', label: 'Thu hoạch', icon: '🌾', color: 'amber' },
  { value: 'Harvest', label: 'Thu hoạch', icon: '🌾', color: 'amber' },
  { value: 'PostHarvest', label: 'Sau thu hoạch', icon: '📦', color: 'slate' },
  { value: 'Other', label: 'Khác', icon: '📌', color: 'slate' }
];

const RESULT_DATA_SCHEMA = {
  Nursery: [
    { key: 'soLuong', label: 'Số lượng cây giống', type: 'number', unit: 'cây', min: 0 },
    { key: 'tiLeNayMam', label: 'Tỷ lệ nảy mầm', type: 'number', unit: '%', min: 0, max: 100 },
    { key: 'chatLuongCayGiong', label: 'Chất lượng', type: 'select', options: [{ value: 'tot', label: 'Tốt' }, { value: 'dat', label: 'Đạt' }, { value: 'kem', label: 'Kém' }] },
    { key: 'ghiChu', label: 'Ghi chú', type: 'text' }
  ],
  Planting: [
    { key: 'dienTichGieo', label: 'Diện tích gieo', type: 'number', unit: 'm²', min: 0 },
    { key: 'matDoGieo', label: 'Mật độ gieo', type: 'number', unit: 'cây/m²', min: 0 },
    { key: 'soLuongHatGiong', label: 'Số lượng hạt giống', type: 'number', unit: 'hạt', min: 0 },
    { key: 'tiLeNayMam', label: 'Tỷ lệ nảy mầm', type: 'number', unit: '%', min: 0, max: 100 }
  ],
  Care: [
    { key: 'soLanTuoi', label: 'Số lần tưới', type: 'number', unit: 'lần', min: 0 },
    { key: 'luongNuocTong', label: 'Tổng lượng nước', type: 'number', unit: 'lít', min: 0 },
    { key: 'soLanBonPhan', label: 'Số lần bón phân', type: 'number', unit: 'lần', min: 0 },
    { key: 'soLanPhunThuoc', label: 'Số lần phun thuốc BVTV', type: 'number', unit: 'lần', min: 0 },
    { key: 'ghiChu', label: 'Ghi chú', type: 'text' }
  ],
  Growing: [
    { key: 'chieuCaoCm', label: 'Chiều cao TB', type: 'number', unit: 'cm', min: 0 },
    { key: 'soLaTrungBinh', label: 'Số lá TB', type: 'number', unit: 'lá', min: 0 },
    { key: 'tiLeSong', label: 'Tỷ lệ sống', type: 'number', unit: '%', min: 0, max: 100 },
    { key: 'tocDoSinhTruong', label: 'Tốc độ sinh trưởng', type: 'number', unit: 'cm/ngày', min: 0 }
  ],
  Growth: [
    { key: 'chieuCaoCm', label: 'Chiều cao TB', type: 'number', unit: 'cm', min: 0 },
    { key: 'soLaTrungBinh', label: 'Số lá TB', type: 'number', unit: 'lá', min: 0 },
    { key: 'tiLeSong', label: 'Tỷ lệ sống', type: 'number', unit: '%', min: 0, max: 100 },
    { key: 'tocDoSinhTruong', label: 'Tốc độ sinh trưởng', type: 'number', unit: 'cm/ngày', min: 0 },
    { key: 'ghiChu', label: 'Ghi chú', type: 'text' }
  ],
  Evaluation: [
    { key: 'tiLeDauQua', label: 'Tỷ lệ đậu quả', type: 'number', unit: '%', min: 0, max: 100 },
    { key: 'tiLeSong', label: 'Tỷ lệ sống', type: 'number', unit: '%', min: 0, max: 100 },
    { key: 'danhGia', label: 'Đánh giá tổng thể', type: 'select', options: [{ value: 'xuat_sac', label: 'Xuất sắc' }, { value: 'tot', label: 'Tốt' }, { value: 'dat', label: 'Đạt' }, { value: 'kem', label: 'Kém' }] },
    { key: 'ghiChu', label: 'Ghi chú', type: 'text' }
  ],
  Harvest: [
    { key: 'sanLuongKg', label: 'Sản lượng', type: 'number', unit: 'kg', min: 0 },
    { key: 'chatLuong', label: 'Phân loại chất lượng', type: 'select', options: [{ value: 'A', label: 'Loại A' }, { value: 'B', label: 'Loại B' }, { value: 'C', label: 'Loại C' }] },
    { key: 'donGia', label: 'Đơn giá', type: 'number', unit: 'VNĐ/kg', min: 0 },
    { key: 'ghiChu', label: 'Ghi chú', type: 'text' }
  ],
  Harvesting: [
    { key: 'sanLuongKg', label: 'Sản lượng', type: 'number', unit: 'kg', min: 0 },
    { key: 'chatLuong', label: 'Phân loại chất lượng', type: 'select', options: [{ value: 'A', label: 'Loại A' }, { value: 'B', label: 'Loại B' }, { value: 'C', label: 'Loại C' }] },
    { key: 'donGia', label: 'Đơn giá', type: 'number', unit: 'VNĐ/kg', min: 0 }
  ],
  PostHarvest: [
    { key: 'khoiLuongBaoQuan', label: 'Khối lượng bảo quản', type: 'number', unit: 'kg', min: 0 },
    { key: 'tyLeHaoHut', label: 'Tỷ lệ hao hụt', type: 'number', unit: '%', min: 0, max: 100 },
    { key: 'nhietDoBaoQuan', label: 'Nhiệt độ bảo quản', type: 'number', unit: '°C', min: 0 }
  ],
  Preparation: [
    { key: 'dienTichChuanBi', label: 'Diện tích chuẩn bị', type: 'number', unit: 'm²', min: 0 },
    { key: 'thietBiSuDung', label: 'Thiết bị sử dụng', type: 'text' },
    { key: 'nhanCong', label: 'Số nhân công', type: 'number', unit: 'người', min: 0 }
  ],
  Other: [{ key: 'ghiChu', label: 'Ghi chú', type: 'text' }]
};

const getSchemaForStage = (stageType) => RESULT_DATA_SCHEMA[stageType] || RESULT_DATA_SCHEMA.Other;
const getStageStyle = (stageType) => STAGE_TYPES.find(s => s.value === stageType) || { icon: '📌', color: 'slate', label: stageType };
const safeParseJSON = (str, fallback = null) => {
  try { return str ? (typeof str === 'string' ? JSON.parse(str) : str) : fallback; }
  catch { return fallback; }
};

// ── Loading Skeleton ──────────────────────────────────────────────────────
const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />
);

// ── Error Boundary ────────────────────────────────────────────────────────
class SafeBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) {
    console.error('[SafeBoundary crashed]', error, info);
    console.error('Component stack:', info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          <p className="font-bold">⚠️ Section này gặp lỗi</p>
          <p className="text-xs mt-1 opacity-70">{String(this.state.error?.message || this.state.error)}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const SectionSkeleton = () => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
    <Skeleton className="h-6 w-48" />
    <div className="grid grid-cols-3 gap-4">
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  </div>
);

// ── Error State ───────────────────────────────────────────────────────────
const ErrorState = ({ message, onRetry }) => (
  <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center">
    <div className="text-5xl mb-4">⚠️</div>
    <p className="text-slate-700 font-semibold mb-2">Đã xảy ra lỗi</p>
    <p className="text-slate-500 text-sm mb-4">{message || 'Không thể tải dữ liệu'}</p>
    {onRetry && (
      <button onClick={onRetry}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold">
        🔄 Thử lại
      </button>
    )}
  </div>
);

// ── Empty State ───────────────────────────────────────────────────────────
const EmptyState = ({ icon = '📋', title = 'Chưa có dữ liệu', description = '' }) => (
  <div className="bg-slate-50 rounded-xl p-8 text-center border border-dashed border-slate-300">
    <div className="text-4xl mb-3 opacity-50">{icon}</div>
    <p className="text-slate-600 font-semibold">{title}</p>
    {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────
const ExperimentDetailPage = ({ experimentId }) => {
  const { showToast } = useToast();
  const [experiment, setExperiment] = useState(null);
  const [drawerTask, setDrawerTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const contentRef = useRef(null);

  // Data layers
  const [stages, setStages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [batches, setBatches] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [measurementRecords, setMeasurementRecords] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [bedAssignments, setBedAssignments] = useState([]);
  const [availableBeds, setAvailableBeds] = useState([]);
  const [areas, setAreas] = useState([]);
  const [taskReportsByBatch, setTaskReportsByBatch] = useState({});

  // UI state
  const [activeSection, setActiveSection] = useState('overview');
  const [saving, setSaving] = useState({ measurement: false, schedule: false, batch: false, stage: false });
  const [stageForm, setStageForm] = useState({ stageName: '', stageOrder: 1, stageType: 'Preparation', startDate: '', endDate: '', objective: '' });

  // Forms
  const [measurementForm, setMeasurementForm] = useState({ groupId: '', metricName: '', unit: '', targetValue: '', description: '' });
  const [scheduleForm, setScheduleForm] = useState({ experimentStageId: '', batchId: '', title: '', instruction: '', frequencyDays: 1, taskType: 'Watering', startDate: '', endDate: '' });
  const [batchForm, setBatchForm] = useState({ experimentBedAssignmentId: '', groupId: '', batchCode: '', plantingDate: '', expectedHarvestDate: '', plantCount: '', notes: '' });

  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

  // ── Load tất cả dữ liệu ────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!experimentId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const exp = await experimentsApi.getById(experimentId);
      setExperiment(exp);

      // Load experiment data (chỉ những endpoint chắc chắn tồn tại)
      const results = await Promise.allSettled([
        stagesApi.getByExperiment(experimentId),
        groupsApi.getByExperiment(experimentId),
        measurementsApi.getByExperiment(experimentId),
        batchesApi.getByExperiment(experimentId),
        measurementRecordsApi.getByExperiment(experimentId),
        schedulesApi.getByExperiment(experimentId),
        tasksApi.getByExperiment(experimentId),
        bedAssignmentsApi.getByExperiment(experimentId)
      ]);

      const get = (r) => {
        if (r.status !== 'fulfilled') return [];
        const v = r.value;
        // unwrap { data: [...] } or { items: [...] } or { data: { items: [...] } }
        if (Array.isArray(v)) return v;
        if (v && typeof v === 'object') {
          if (Array.isArray(v.data)) return v.data;
          if (Array.isArray(v.items)) return v.items;
          if (v.data && Array.isArray(v.data.items)) return v.data.items;
          if (Array.isArray(v.result)) return v.result;
          // unwrap object with numeric keys (array-like)
          const keys = Object.keys(v);
          if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
            return keys.sort((a, b) => Number(a) - Number(b)).map(k => v[k]);
          }
          return Object.keys(v).length > 0 ? [v] : [];
        }
        return [];
      };
      const fail = (i) => { const r = results[i]; if (r.status === 'rejected') console.warn('API failed:', r.reason?.message || r.reason); };

      console.log('[ExperimentDetail] loadAll results:', {
        stages: results[0].status === 'fulfilled' ? (Array.isArray(results[0].value) ? `array(${results[0].value.length})` : typeof results[0].value) : results[0].status,
        groups: results[1].status === 'fulfilled' ? (Array.isArray(results[1].value) ? `array(${results[1].value.length})` : typeof results[1].value) : results[1].status,
        measurements: results[2].status === 'fulfilled' ? (Array.isArray(results[2].value) ? `array(${results[2].value.length})` : typeof results[2].value) : results[2].status,
        batches: results[3].status === 'fulfilled' ? (Array.isArray(results[3].value) ? `array(${results[3].value.length})` : (results[3].value?.data ? `obj.data(${results[3].value.data.length})` : typeof results[3].value)) : results[3].status,
        measurementRecords: results[4].status === 'fulfilled' ? (Array.isArray(results[4].value) ? `array(${results[4].value.length})` : typeof results[4].value) : results[4].status,
        schedules: results[5].status === 'fulfilled' ? (Array.isArray(results[5].value) ? `array(${results[5].value.length})` : typeof results[5].value) : results[5].status,
        tasks: results[6].status === 'fulfilled' ? (Array.isArray(results[6].value) ? `array(${results[6].value.length})` : (results[6].value?.items ? `obj.items(${results[6].value.items.length})` : (results[6].value?.data ? `obj.data(${results[6].value.data.length})` : JSON.stringify(results[6].value).slice(0, 200)))) : results[6].status,
        bedAssignments: results[7].status === 'fulfilled' ? (Array.isArray(results[7].value) ? `array(${results[7].value.length})` : typeof results[7].value) : results[7].status,
      });
      setStages(get(results[0])); setGroups(get(results[1])); setMeasurements(get(results[2])); setBatches(get(results[3]));
      setMeasurementRecords(get(results[4])); setSchedules(get(results[5])); setTasks(get(results[6])); setBedAssignments(get(results[7]));
      setAvailableBeds([]); setAreas([]);

      // Load task reports cho từng batch
      const batchList = get(results[3]);
      if (batchList.length > 0) {
        const reports = await Promise.allSettled(batchList.map(b => taskReportsApi.getByBatch(b.id)));
        const map = {};
        batchList.forEach((b, i) => { map[b.id] = reports[i].status === 'fulfilled' ? (Array.isArray(reports[i].value) ? reports[i].value : []) : []; });
        setTaskReportsByBatch(map);
      }
    } catch (err) {
      console.error('Load error:', err);
      setLoadError(err.message || 'Không thể tải chi tiết thí nghiệm');
      showToast(err.message || 'Lỗi tải dữ liệu', 'error');
    } finally {
      setLoading(false);
    }
  }, [experimentId, showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Index data ────────────────────────────────────────────────────────────
  const measurementById = useMemo(() => { const m = new Map(); measurements.forEach(d => m.set(d.id, d)); return m; }, [measurements]);

  const recordsByBatch = useMemo(() => {
    const m = new Map();
    measurementRecords.forEach(rec => {
      if (!rec.batchId) return;
      const def = measurementById.get(rec.measurementDefinitionId);
      if (!m.has(rec.batchId)) m.set(rec.batchId, []);
      m.get(rec.batchId).push({ ...rec, _def: def });
    });
    for (const list of m.values()) {
      list.sort((a, b) => {
        const nameA = a._def?.metricName || ''; const nameB = b._def?.metricName || '';
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        return new Date(a.measuredAt || 0) - new Date(b.measuredAt || 0);
      });
    }
    return m;
  }, [measurementRecords, measurementById]);

  const batchesByGroup = useMemo(() => {
    const m = new Map();
    batches.forEach(b => {
      const gid = b.groupId || '_unassigned';
      if (!m.has(gid)) m.set(gid, []);
      m.get(gid).push(b);
    });
    return m;
  }, [batches]);

  const decisionSummary = useMemo(() => {
    return measurements
      .filter(def => def.targetValue !== null && def.targetValue !== undefined && def.targetValue !== '')
      .map(def => {
        const target = Number(def.targetValue);
        if (Number.isNaN(target)) return null;
        const values = measurementRecords.filter(r => r.measurementDefinitionId === def.id).map(r => Number(r.value)).filter(v => !Number.isNaN(v));
        if (values.length === 0) return null;
        const mean = values.reduce((s, v) => s + v, 0) / values.length;
        let status = 'Continue', color = 'emerald', icon = '✅';
        if (mean < target * 0.5) { status = 'Dừng'; color = 'rose'; icon = '🚨'; }
        else if (mean < target * 0.8) { status = 'Rủi ro'; color = 'amber'; icon = '⚠️'; }
        return { definitionId: def.id, metricName: def.metricName, unit: def.unit, target, mean: Number(mean.toFixed(2)), sampleSize: values.length, status, color, icon };
      })
      .filter(Boolean);
  }, [measurements, measurementRecords]);

  const taskStats = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === 'Pending').length;
    const inProgress = tasks.filter(t => ['Assigned', 'InProgress'].includes(t.status)).length;
    const completed = tasks.filter(t => ['Completed', 'Approved'].includes(t.status)).length;
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !['Completed', 'Cancelled', 'Approved'].includes(t.status)).length;
    return { total, pending, inProgress, completed, overdue };
  }, [tasks]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCreateStage = async () => {
    if (!stageForm.stageName.trim()) { showToast('Tên giai đoạn không được trống', 'error'); return; }
    setSaving(s => ({ ...s, stage: true }));
    try {
      await stagesApi.create(experiment.id, { ...stageForm, stageOrder: parseInt(stageForm.stageOrder) || 1 });
      showToast('Đã tạo giai đoạn', 'success');
      setStageForm({ stageName: '', stageOrder: stages.length + 1, stageType: 'Preparation', startDate: '', endDate: '', objective: '' });
      const data = await stagesApi.getByExperiment(experiment.id);
      setStages(Array.isArray(data) ? data : []);
    } catch (err) { showToast(err.message || 'Lỗi tạo giai đoạn', 'error'); }
    finally { setSaving(s => ({ ...s, stage: false })); }
  };

  const handleUpdateStage = async (stageId, payload) => {
    try { await stagesApi.update(stageId, payload); const data = await stagesApi.getByExperiment(experiment.id); setStages(Array.isArray(data) ? data : []); }
    catch (err) { throw err; }
  };

  const handleDeleteStage = async (id) => {
    if (!window.confirm('Xóa giai đoạn này?')) return;
    try { await stagesApi.remove(id); showToast('Đã xóa', 'success'); setStages(prev => prev.filter(s => s.id !== id)); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleCreateMeasurement = async () => {
    if (!measurementForm.groupId || !measurementForm.metricName.trim()) { showToast('Cần chọn nhóm và tên chỉ số', 'error'); return; }
    setSaving(s => ({ ...s, measurement: true }));
    try {
      await measurementsApi.create(experiment.id, { ...measurementForm, targetValue: measurementForm.targetValue ? parseFloat(measurementForm.targetValue) : undefined });
      showToast('Đã tạo chỉ số', 'success');
      setMeasurementForm({ groupId: measurementForm.groupId, metricName: '', unit: '', targetValue: '', description: '' });
      const data = await measurementsApi.getByExperiment(experiment.id);
      setMeasurements(Array.isArray(data) ? data : []);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(s => ({ ...s, measurement: false })); }
  };

  const handleDeleteMeasurement = async (id) => {
    if (!window.confirm('Xóa chỉ số này?')) return;
    try { await measurementsApi.remove(id); showToast('Đã xóa', 'success'); setMeasurements(prev => prev.filter(m => m.id !== id)); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleUpdateTaskGroup = async (taskId, newGroupId) => {
    try {
      await tasksApi.update(taskId, { groupId: newGroupId || null });
      showToast(newGroupId ? 'Đã gán tác vụ vào nhóm' : 'Đã bỏ phân nhóm', 'success');
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, groupId: newGroupId } : t));
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật', 'error');
      throw err;
    }
  };

  const handleAssignTask = async (taskId, assigneeId, reason) => {
    try {
      await tasksApi.assign({ taskId, assigneeId, reason: reason || null });
      // Reload tasks để lấy assignee mới
      const updated = await tasksApi.getByExperiment(experimentId);
      setTasks(Array.isArray(updated) ? updated : []);
    } catch (err) { throw err; }
  };

  const handleReassignTask = async (taskId, newAssigneeId, reason) => {
    try {
      await tasksApi.reassign({ taskId, newAssigneeId, reason: reason || null });
      const updated = await tasksApi.getByExperiment(experimentId);
      setTasks(Array.isArray(updated) ? updated : []);
    } catch (err) { throw err; }
  };

  const handleCreateSchedule = async () => {
    if (!scheduleForm.title.trim()) { showToast('Tiêu đề lịch không được trống', 'error'); return; }
    setSaving(s => ({ ...s, schedule: true }));
    try {
      await schedulesApi.create(experiment.id, { ...scheduleForm, frequencyDays: parseInt(scheduleForm.frequencyDays) || 1 });
      showToast('Đã tạo lịch', 'success');
      setScheduleForm({ experimentStageId: scheduleForm.experimentStageId, batchId: '', title: '', instruction: '', frequencyDays: 1, taskType: 'Watering', startDate: '', endDate: '' });
      const data = await schedulesApi.getByExperiment(experiment.id);
      setSchedules(Array.isArray(data) ? data : []);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(s => ({ ...s, schedule: false })); }
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('Xóa lịch này?')) return;
    try { await schedulesApi.remove(id); showToast('Đã xóa', 'success'); setSchedules(prev => prev.filter(s => s.id !== id)); }
    catch (err) { showToast(err.message, 'error'); }
  };

  const handleCreateBatch = async () => {
    if (!batchForm.groupId || !batchForm.batchCode.trim()) { showToast('Cần nhóm và mã lô', 'error'); return; }
    setSaving(s => ({ ...s, batch: true }));
    try {
      await batchesApi.create({ experimentId: experiment.id, ...batchForm, plantCount: batchForm.plantCount ? parseInt(batchForm.plantCount) : undefined });
      showToast('Đã tạo lô', 'success');
      setBatchForm({ experimentBedAssignmentId: '', groupId: batchForm.groupId, batchCode: '', plantingDate: '', expectedHarvestDate: '', plantCount: '', notes: '' });
      const data = await batchesApi.getByExperiment(experiment.id);
      setBatches(Array.isArray(data) ? data : []);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setSaving(s => ({ ...s, batch: false })); }
  };

  const handleDeleteBatch = async (id) => {
    if (!window.confirm('Xóa lô này?')) return;
    try { await batchesApi.remove(id); showToast('Đã xóa', 'success'); setBatches(prev => prev.filter(b => b.id !== id)); }
    catch (err) { showToast(err.message, 'error'); }
  };

  // ── Scroll tracking ───────────────────────────────────────────────────
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onScroll = () => {
      const sections = ['overview', 'criteria', 'stages', 'hierarchy', 'tasks', 'schedules', 'measurements', 'batches', 'design', 'beds', 'stats'];
      let found = 'overview';
      for (const id of sections) {
        const sec = document.getElementById(`section-${id}`);
        if (sec && sec.offsetTop - 120 <= el.scrollTop) found = id;
      }
      setActiveSection(found);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id) => {
    setActiveSection(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Loading state
  if (loading && !experiment) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Đang tải chi tiết thí nghiệm...</p>
          <p className="text-slate-400 text-sm mt-1">Vui lòng chờ trong giây lát</p>
        </div>
      </div>
    );
  }

  // Error state (chỉ khi đã có experiment fail)
  if (loadError && !experiment) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <ErrorState message={loadError} onRetry={loadAll} />
      </div>
    );
  }

  // Debug helper
  console.log('[ExperimentDetail] render', { loading, loadError, hasExperiment: !!experiment, experimentId });

  if (!experiment) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center max-w-md p-6">
          <div className="text-6xl mb-4">🧪</div>
          <p className="text-slate-700 font-semibold text-lg mb-2">{loading ? 'Đang tải...' : 'Không tìm thấy thí nghiệm'}</p>
          {loadError && <p className="text-rose-600 text-sm mb-4">{loadError}</p>}
          {loading && <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto my-4" />}
          <button onClick={() => navigateTo('/researcher')} className="mt-4 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700">
            ← Quay lại Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Progress bar for loading sections
  const progress = ((stages.length + groups.length + measurements.length + batches.length) > 0) ? 100 : 0;

  return (
    <Portal>
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 overflow-hidden">

        {/* ── Sticky Header ─────────────────────────────────────────── */}
        <header className="bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm shrink-0 z-50">
          {/* Breadcrumb */}
          <div className="max-w-7xl mx-auto px-6 pt-3">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <button onClick={() => navigateTo('/researcher')} className="hover:text-indigo-600 transition-colors font-medium">Dashboard</button>
              <span>/</span>
              <span className="text-indigo-600 font-semibold">Chi tiết thí nghiệm</span>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-6 pb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-200">🧪</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{experiment.experimentCode || experiment.code || 'EXP'}</span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${
                    experiment.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                    experiment.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                    experiment.status === 'Cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                  }`}>{experiment.status || 'Draft'}</span>
                </div>
                <h1 className="text-lg font-bold text-slate-900 truncate mt-0.5">{experiment.title || '—'}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={loadAll}
                className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 transition-colors"
                title="Làm mới dữ liệu">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                Làm mới
              </button>
            </div>
          </div>

          {/* Section nav - scrollable */}
          <div className="max-w-7xl mx-auto px-6 border-t border-slate-100">
            <div className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-hide">
              {[
                { id: 'overview', label: 'Tổng Quan', icon: '📋' },
                { id: 'criteria', label: 'Tiêu Chí', icon: '🎯' },
                { id: 'stages', label: 'Giai Đoạn', icon: '🪜', badge: stages.length },
                { id: 'hierarchy', label: 'Cấu Trúc', icon: '🌳' },
                { id: 'tasks', label: 'Tác Vụ', icon: '📌', badge: tasks.length },
                { id: 'schedules', label: 'Lịch', icon: '📅', badge: schedules.length },
                { id: 'measurements', label: 'Đo Lường', icon: '📊', badge: measurements.length },
                { id: 'batches', label: 'Lô', icon: '📦', badge: batches.length },
                { id: 'design', label: 'Thiết Kế', icon: '📐' },
                { id: 'beds', label: 'Luống', icon: '🌱', badge: bedAssignments.length },
                { id: 'stats', label: 'Thống Kê', icon: '📈' },
              ].map(tab => (
                <button key={tab.id} onClick={() => scrollTo(tab.id)}
                  className={`px-4 py-2 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                    activeSection === tab.id
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}>
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.badge > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      activeSection === tab.id ? 'bg-white/20' : 'bg-slate-200 text-slate-600'
                    }`}>{tab.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ── Scrollable Content ─────────────────────────────────── */}
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          <main className="max-w-7xl mx-auto px-6 lg:px-10 py-6 space-y-6">

            {/* ── 1. Tổng quan ─────────────────────────────────── */}
            <section id="section-overview">
              <SafeBoundary>
                <ExperimentOverviewSummary
                  experiment={experiment} groups={groups} batches={batches}
                  measurements={measurements} measurementRecords={measurementRecords}
                  stages={stages} decisionSummary={decisionSummary} tasks={tasks} schedules={schedules}
                />
              </SafeBoundary>
            </section>

            {/* ── 2. Tiêu chí ────────────────────────────────── */}
            {decisionSummary.length > 0 && (
              <section id="section-criteria">
                <SafeBoundary><DecisionCriteriaPanel decisionSummary={decisionSummary} /></SafeBoundary>
              </section>
            )}

            {/* ── 3. Giai đoạn ─────────────────────────────── */}
            <section id="section-stages">
              <SafeBoundary>
                <StagesSection
                  stages={stages} groups={groups} batches={batches}
                  measurements={measurements} measurementRecords={measurementRecords}
                  taskReportsByBatch={taskReportsByBatch}
                  taskReports={Object.values(taskReportsByBatch || {}).flat()}
                  schedules={schedules} tasks={tasks}
                  stageForm={stageForm} setStageForm={setStageForm}
                  onCreateStage={handleCreateStage} onUpdateStage={handleUpdateStage}
                  onDeleteStage={handleDeleteStage}
                  saving={saving.stage} showToast={showToast}
                />
              </SafeBoundary>
            </section>

            {/* ── 4. Cấu trúc ──────────────────────────────── */}
            <section id="section-hierarchy">
              <SafeBoundary>
                <ExperimentHierarchyViewLazy
                  experiment={experiment} groups={groups} batchesByGroup={batchesByGroup}
                  stages={stages} measurements={measurements} recordsByBatch={recordsByBatch}
                />
              </SafeBoundary>
            </section>

            {/* ── 5. Tác vụ ───────────────────────────────── */}
            <section id="section-tasks">
              <SafeBoundary>
                <TasksSection
                  tasks={tasks} groups={groups} batches={batches} taskStats={taskStats}
                  taskReportsByBatch={taskReportsByBatch}
                  onOpenTaskDetail={(t) => setDrawerTask(t)}
                />
              </SafeBoundary>
            </section>

            {/* ── 6. Lịch ──────────────────────────────────── */}
            <section id="section-schedules">
              <SafeBoundary>
                <SchedulesSection
                  schedules={schedules} groups={groups} batches={batches} stages={stages}
                  form={scheduleForm} setForm={setScheduleForm}
                  onCreate={handleCreateSchedule} onDelete={handleDeleteSchedule} saving={saving.schedule}
                />
              </SafeBoundary>
            </section>

            {/* ── 7. Đo lường ─────────────────────────────── */}
            <section id="section-measurements">
              <SafeBoundary>
                <MeasurementsSection
                  measurements={measurements} groups={groups}
                  form={measurementForm} setForm={setMeasurementForm}
                  onCreate={handleCreateMeasurement} onDelete={handleDeleteMeasurement} saving={saving.measurement}
                />
              </SafeBoundary>
            </section>

            {/* ── 8. Lô ───────────────────────────────────── */}
            <section id="section-batches">
              <SafeBoundary>
                <BatchesSection
                  batches={batches} groups={groups} bedAssignments={bedAssignments}
                  form={batchForm} setForm={setBatchForm}
                  onCreate={handleCreateBatch} onDelete={handleDeleteBatch} saving={saving.batch}
                  taskReportsByBatch={taskReportsByBatch}
                />
              </SafeBoundary>
            </section>

            {/* ── 9. Thiết kế ─────────────────────────────── */}
            <section id="section-design">
              <SafeBoundary><DesignSection experiment={experiment} /></SafeBoundary>
            </section>

            {/* ── 10. Luống ────────────────────────────────── */}
            <section id="section-beds">
              <SafeBoundary>
                <BedsSection
                  bedAssignments={bedAssignments} availableBeds={availableBeds}
                  areas={areas} batches={batches}
                />
              </SafeBoundary>
            </section>

            {/* ── 11. Thống kê ─────────────────────────────── */}
            <section id="section-stats">
              <SafeBoundary>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">📈 Thống kê chi tiết</h2>
                  <StatisticsDashboard experimentId={experiment.id} stages={stages} />
                </div>
              </SafeBoundary>
            </section>

          </main>
        </div>

        {/* Drawer chi tiết task */}
        <TaskDetailDrawer
          task={drawerTask}
          onClose={() => setDrawerTask(null)}
          stages={stages}
          batches={batches}
          groups={groups}
          taskReports={Object.values(taskReportsByBatch || {}).flat()}
          onAssign={handleAssignTask}
          onReassign={handleReassignTask}
          showToast={showToast}
        />
      </div>
    </Portal>
  );
};

// ── Decision Criteria Panel ───────────────────────────────────────────────────
const DecisionCriteriaPanel = ({ decisionSummary }) => {
  const overall = useMemo(() => {
    if (decisionSummary.length === 0) return { label: 'Chưa có dữ liệu', color: 'slate', icon: '⏳' };
    const stop = decisionSummary.filter(d => d.status === 'Dừng').length;
    const risk = decisionSummary.filter(d => d.status === 'Rủi ro').length;
    if (stop > 0) return { label: 'Cần xem xét dừng', color: 'rose', icon: '🚨' };
    if (risk > 0) return { label: 'Có chỉ số rủi ro', color: 'amber', icon: '⚠️' };
    return { label: 'Tiếp tục bình thường', color: 'emerald', icon: '✅' };
  }, [decisionSummary]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">🎯 Tiêu chí Tiếp tục / Dừng</h2>
          <p className="text-sm text-slate-500 mt-0.5">So sánh trung bình thực đo với mục tiêu đã đặt</p>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-bold ${
          overall.color === 'rose' ? 'bg-rose-100 text-rose-700' :
          overall.color === 'amber' ? 'bg-amber-100 text-amber-700' :
          overall.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
        }`}>{overall.icon} {overall.label}</span>
      </div>
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {decisionSummary.map(d => (
          <div key={d.definitionId} className={`p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] hover:shadow-md ${
            d.color === 'rose' ? 'bg-rose-50/50 border-rose-200' :
            d.color === 'amber' ? 'bg-amber-50/50 border-amber-200' :
            'bg-emerald-50/50 border-emerald-200'
          }`}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-sm font-bold text-slate-900">{d.metricName}</p>
              <span className="text-2xl">{d.icon}</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-bold text-slate-900">{d.mean}</span>
              {d.unit && <span className="text-sm text-slate-500">{d.unit}</span>}
            </div>
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="text-slate-500">Mục tiêu: <b className="text-slate-700">{d.target}{d.unit}</b></span>
              <span className={`font-bold uppercase ${
                d.color === 'rose' ? 'text-rose-700' : d.color === 'amber' ? 'text-amber-700' : 'text-emerald-700'
              }`}>{d.status}</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${d.color === 'rose' ? 'bg-rose-500' : d.color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, (d.mean / d.target) * 100)}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 italic">{d.sampleSize} lần đo</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Stages Section ────────────────────────────────────────────────────────────
const StagesSection = ({ stages, groups, batches, measurements, measurementRecords, taskReportsByBatch, taskReports, schedules, tasks, stageForm, setStageForm, onCreateStage, onUpdateStage, onDeleteStage, saving, showToast }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [savingId, setSavingId] = useState(null);

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  const startEdit = (s) => {
    setEditingId(s.id);
    let parsed = safeParseJSON(s.resultData, {});
    const isPerGroup = isPerGroupStage(s.stageType);
    const stageRecs = measurementRecords.filter(r => r.stageId === s.id || r.experimentStageId === s.id);

    if (isPerGroup) {
      const overall = {}; const byGroup = {};
      getSchemaForStage(s.stageType).forEach(f => { overall[f.key] = ''; });
      groups.forEach(g => { byGroup[g.id] = {}; getSchemaForStage(s.stageType).forEach(f => { byGroup[g.id][f.key] = ''; }); });
      if (parsed && typeof parsed === 'object') {
        if (parsed.overall) Object.entries(parsed.overall).forEach(([k, v]) => { if (overall.hasOwnProperty(k)) overall[k] = v; });
        if (parsed.byGroup) Object.entries(parsed.byGroup).forEach(([gid, vals]) => {
          if (!byGroup[gid]) byGroup[gid] = {};
          getSchemaForStage(s.stageType).forEach(f => { byGroup[gid][f.key] = ''; });
          Object.entries(vals || {}).forEach(([k, v]) => { if (byGroup[gid].hasOwnProperty(k)) byGroup[gid][k] = v; });
        });
      } else if (parsed) Object.entries(parsed).forEach(([k, v]) => { if (overall.hasOwnProperty(k)) overall[k] = v; });
      const fieldKeys = getAutoFillFieldKeys(s.stageType);
      const computed = computeResultsByGroup({ stageId: s.id, groups, batches, records: stageRecs, definitions: measurements, fieldKeys });
      Object.entries(computed.overall || {}).forEach(([k, v]) => { if ((overall[k] === '' || overall[k] == null) && v != null) overall[k] = v; });
      Object.entries(computed.perGroup || {}).forEach(([gid, perG]) => {
        if (!byGroup[gid]) byGroup[gid] = {};
        Object.entries(perG).forEach(([k, v]) => { if ((byGroup[gid][k] === '' || byGroup[gid][k] == null) && v != null) byGroup[gid][k] = v; });
      });
      parsed = { overall, byGroup };
    } else {
      const isGrowth = s.stageType === 'Growing' || s.stageType === 'Growth';
      const autoFilledMap = isGrowth && measurements.length > 0
        ? autoFillFromDynamicSchema(buildGrowthResultSchema(s.stageType, measurements), stageRecs, measurements)
        : autoFillAllFields(s.stageType, stageRecs, measurements);
      Object.entries(autoFilledMap).forEach(([k, info]) => { if ((parsed[k] === '' || parsed[k] == null) && info.value != null) parsed[k] = info.value; });
    }

    setEditData({
      stageName: s.stageName || '', stageOrder: s.stageOrder ?? 1, stageType: s.stageType || 'Preparation',
      objective: s.objective || '', startDate: s.startDate ? s.startDate.slice(0, 10) : '',
      endDate: s.endDate ? s.endDate.slice(0, 10) : '', resultSummary: s.resultSummary || '',
      resultData: parsed, _isPerGroup: isPerGroup
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditData({}); };

  const updateField = (key, value, groupId = null) => {
    setEditData(prev => {
      if (prev._isPerGroup) {
        if (groupId != null) {
          const newByGroup = { ...(prev.resultData?.byGroup || {}) };
          newByGroup[groupId] = { ...(newByGroup[groupId] || {}), [key]: value };
          return { ...prev, resultData: { ...prev.resultData, byGroup: newByGroup } };
        }
        const newOverall = { ...(prev.resultData?.overall || {}) };
        newOverall[key] = value;
        return { ...prev, resultData: { ...prev.resultData, overall: newOverall } };
      }
      return { ...prev, resultData: { ...prev.resultData, [key]: value } };
    });
  };

  const saveEdit = async (stageId) => {
    setSavingId(stageId);
    try {
      const payload = {
        stageName: editData.stageName, stageOrder: parseInt(editData.stageOrder) || 1,
        stageType: editData.stageType, objective: editData.objective,
        startDate: editData.startDate || null, endDate: editData.endDate || null,
        resultSummary: editData.resultSummary || null, resultData: JSON.stringify(editData.resultData || {})
      };
      await onUpdateStage(stageId, payload);
      showToast('Đã lưu kết quả giai đoạn', 'success');
      cancelEdit();
    } catch (err) { showToast(err.message || 'Lỗi lưu', 'error'); }
    finally { setSavingId(null); }
  };

  const getStagePlantCount = (stage) => {
    const stageType = stage.stageType;
    if (!['Nursery', 'Planting', 'Care', 'Growing', 'Growth', 'Evaluation', 'Harvest', 'Harvesting'].includes(stageType)) return null;
    const stageSchedules = schedules.filter(sc => sc.experimentStageId === stage.id);
    let batchIds = [...new Set(stageSchedules.map(sc => sc.batchId).filter(Boolean))];
    if (batchIds.length === 0) batchIds = batches.map(b => b.id);
    let total = 0;
    let reportCount = 0;
    batchIds.forEach(bid => {
      const result = aggregatePlantCountFromReports(bid, taskReportsByBatch[bid] || []);
      if (result?.total) { total += result.total; reportCount += result.reportCount || 0; }
    });
    return total > 0 ? { total, reportCount } : null;
  };

  const getStageSuggestedHints = (stage) => {
    const stageType = stage.stageType;
    const stageTasks = tasks.filter(t => t.stageId === stage.id || t.experimentStageId === stage.id);
    const plantInfo = getStagePlantCount(stage);
    const schema = getSchemaForStage(stageType);

    const hints = [];
    if (plantInfo && (stageType === 'Nursery' || stageType === 'Planting')) {
      // Map field trong schema để auto-fill
      const targetField = stageType === 'Nursery' ? 'soLuong' : null;
      hints.push({ icon: '🌱', label: 'Số cây đã trồng/ươm', value: `${plantInfo.total} cây`, source: `${plantInfo.reportCount} báo cáo`, key: targetField, numericValue: plantInfo.total });
    }

    const countByType = {};
    stageTasks.forEach(t => { countByType[t.taskType] = (countByType[t.taskType] || 0) + 1; });
    Object.entries(countByType).forEach(([type, n]) => {
      hints.push({ icon: '📋', label: `Tác vụ ${type}`, value: `${n} task` });
    });

    if (stageType === 'Care') {
      const watering = stageTasks.filter(t => ['Watering', 'Irrigation'].includes(t.taskType) && t.status === 'Completed').length;
      const fertilize = stageTasks.filter(t => ['Fertilizing', 'Fertilizer'].includes(t.taskType) && t.status === 'Completed').length;
      const spray = stageTasks.filter(t => ['Spraying', 'PestControl'].includes(t.taskType) && t.status === 'Completed').length;
      if (watering > 0) hints.push({ icon: '💧', label: 'Số lần tưới thực tế', value: `${watering} lần`, key: 'soLanTuoi', numericValue: watering });
      if (fertilize > 0) hints.push({ icon: '🧪', label: 'Số lần bón phân thực tế', value: `${fertilize} lần`, key: 'soLanBonPhan', numericValue: fertilize });
      if (spray > 0) hints.push({ icon: '🛡️', label: 'Số lần phun thuốc thực tế', value: `${spray} lần`, key: 'soLanPhunThuoc', numericValue: spray });
    }

    if (stageType === 'Growing' || stageType === 'Growth') {
      const stageRecs = measurementRecords.filter(r => r.stageId === stage.id || r.experimentStageId === stage.id);
      if (stageRecs.length > 0) {
        const heights = stageRecs.map(r => Number(r.value)).filter(v => !isNaN(v) && v > 0);
        if (heights.length > 0) {
          const avg = Number((heights.reduce((s, v) => s + v, 0) / heights.length).toFixed(1));
          hints.push({ icon: '📏', label: 'Chiều cao trung bình', value: `${avg} cm`, source: `${heights.length} mẫu`, key: 'chieuCaoCm', numericValue: avg });
        }
      }
    }

    if (stageType === 'Harvesting' || stageType === 'Harvest') {
      const harvestReports = (taskReports || []).filter(r => stageTasks.some(t => t.id === r.taskId) && r.taskType === 'Harvesting');
      const totalYield = harvestReports.reduce((sum, r) => sum + (Number(r.harvestYield || r.yieldKg || r.actualYield) || 0), 0);
      if (totalYield > 0) hints.push({ icon: '⚖️', label: 'Sản lượng thực tế', value: `${totalYield} kg`, source: `${harvestReports.length} báo cáo`, key: 'sanLuongKg', numericValue: totalYield });
    }

    if (stageType === 'Evaluation') {
      const completedTasks = stageTasks.filter(t => t.status === 'Completed').length;
      const total = stageTasks.length;
      if (total > 0) hints.push({ icon: '📊', label: 'Tỷ lệ hoàn thành', value: `${Math.round(completedTasks / total * 100)}%`, source: `${completedTasks}/${total} tác vụ` });
    }

    return hints;
  };

  const sortedStages = useMemo(() => [...stages].sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0)), [stages]);
  const colorMap = { amber: 'bg-amber-50 border-amber-200', emerald: 'bg-emerald-50 border-emerald-200', blue: 'bg-blue-50 border-blue-200', teal: 'bg-teal-50 border-teal-200', slate: 'bg-slate-50 border-slate-200' };
  const badgeMap = { amber: 'bg-amber-100 text-amber-800', emerald: 'bg-emerald-100 text-emerald-800', blue: 'bg-blue-100 text-blue-800', teal: 'bg-teal-100 text-teal-800', slate: 'bg-slate-100 text-slate-800' };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">🪜 Giai Đoạn Thí Nghiệm</h2>
            <p className="text-sm text-slate-500 mt-0.5">Tạo, chỉnh sửa kết quả và đánh giá từng giai đoạn</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">{stages.length} giai đoạn</span>
            {stages.filter(s => s.status === 'Completed').length > 0 && (
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold">
                ✅ {stages.filter(s => s.status === 'Completed').length} hoàn thành
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Form tạo */}
      <div className="px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">+</span>
          <h4 className="text-sm font-bold text-blue-800">Thêm Giai Đoạn Mới</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
          <div className="xl:col-span-2">
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Tên giai đoạn *</label>
            <input placeholder="VD: Gieo trồng" value={stageForm.stageName}
              onChange={e => setStageForm({ ...stageForm, stageName: e.target.value })}
              className="w-full px-3 py-2.5 border border-blue-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Loại</label>
            <select value={stageForm.stageType}
              onChange={e => setStageForm({ ...stageForm, stageType: e.target.value })}
              className="w-full px-3 py-2.5 border border-blue-200 rounded-xl text-sm bg-white">
              {STAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Thứ tự</label>
            <input type="number" min="1" value={stageForm.stageOrder}
              onChange={e => setStageForm({ ...stageForm, stageOrder: e.target.value })}
              className="w-full px-3 py-2.5 border border-blue-200 rounded-xl text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Ngày bắt đầu</label>
            <input type="date" value={stageForm.startDate}
              onChange={e => setStageForm({ ...stageForm, startDate: e.target.value })}
              className="w-full px-3 py-2.5 border border-blue-200 rounded-xl text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Ngày kết thúc</label>
            <input type="date" value={stageForm.endDate}
              onChange={e => setStageForm({ ...stageForm, endDate: e.target.value })}
              className="w-full px-3 py-2.5 border border-blue-200 rounded-xl text-sm bg-white" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <input placeholder="Mục tiêu giai đoạn..." value={stageForm.objective}
            onChange={e => setStageForm({ ...stageForm, objective: e.target.value })}
            className="flex-1 px-3 py-2.5 border border-blue-200 rounded-xl text-sm bg-white" />
          <button onClick={onCreateStage} disabled={saving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all hover:scale-105">
            {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Đang tạo...</> : '➕ Tạo Giai Đoạn'}
          </button>
        </div>
      </div>

      {/* Danh sách */}
      <div className="p-4 space-y-3">
        {stages.length === 0 ? (
          <EmptyState icon="🪜" title="Chưa có giai đoạn nào" description="Tạo giai đoạn đầu tiên để bắt đầu thí nghiệm" />
        ) : sortedStages.map(s => {
          const isExpanded = expandedId === s.id;
          const isEditing = editingId === s.id;
          const meta = getStageStyle(s.stageType);
          const plantCount = getStagePlantCount(s);
          const stageTasks = tasks.filter(t => t.stageId === s.id || t.experimentStageId === s.id);
          const stageMeasurements = measurements.filter(m => m.stageId === s.id || m.experimentStageId === s.id);
          const parsedResult = safeParseJSON(s.resultData, null);
          const schema = getSchemaForStage(s.stageType);
          const isPerGroup = isPerGroupStage(s.stageType);

          return (
            <div key={s.id} className={`border-2 rounded-2xl overflow-hidden transition-all hover:shadow-md ${
              isExpanded ? `border-indigo-400 shadow-lg ${colorMap[meta.color] || colorMap.slate}` : 'border-slate-200'
            }`}>
              {/* Header */}
              <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={() => toggleExpand(s.id)}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${badgeMap[meta.color] || badgeMap.slate}`}>{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-slate-900 truncate">{s.stageName || '—'}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${badgeMap[meta.color] || badgeMap.slate}`}>{meta.label}</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">#{s.stageOrder}</span>
                    {s.status === 'Completed' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold">✅ Hoàn thành</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1">📅 {s.startDate ? new Date(s.startDate).toLocaleDateString('vi-VN') : '—'} → {s.endDate ? new Date(s.endDate).toLocaleDateString('vi-VN') : '—'}</span>
                    {stageTasks.length > 0 && <span className="flex items-center gap-1">📋 {stageTasks.length} tác vụ</span>}
                    {stageMeasurements.length > 0 && <span className="flex items-center gap-1">📐 {stageMeasurements.length} đo lường</span>}
                    {plantCount && <span className="flex items-center gap-1 text-emerald-600 font-semibold">🌱 {plantCount.total} cây đã trồng</span>}
                  </div>
                  {parsedResult && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] font-bold text-purple-700 uppercase">🧪 Kết quả:</span>
                      {isPerGroup && parsedResult.byGroup ? (
                        Object.entries(parsedResult.byGroup).map(([gid, obj]) => {
                          const g = groups.find(x => x.id === gid) || { groupName: `Nhóm ${gid.slice(0, 6)}` };
                          const filled = schema.filter(f => f.type === 'number' && obj[f.key] !== '' && obj[f.key] != null).length;
                          return (
                            <span key={gid} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-lg text-[10px] font-bold">
                              {g.groupName} <span className="text-purple-600 font-mono">{filled}/{schema.length}</span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-lg text-[10px] font-bold">
                          {schema.filter(f => f.type === 'number' && parsedResult[f.key] !== '' && parsedResult[f.key] != null).length}/{schema.length} fields
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-slate-400 text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </div>

              {isExpanded && (
                <div className={`border-t border-slate-200/50 p-5 space-y-4 bg-white/70`}>
                  {s.objective && (
                    <div className="bg-white rounded-xl p-4 border border-slate-100">
                      <p className="text-xs font-bold uppercase text-slate-500 mb-2">🎯 Mục tiêu</p>
                      <p className="text-sm text-slate-800">{s.objective}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl p-4 border border-slate-100">
                      <p className="text-xs font-bold uppercase text-slate-500 mb-3">📋 Tác vụ ({stageTasks.length})</p>
                      {stageTasks.length === 0 ? <p className="text-xs text-slate-400 italic">Chưa có tác vụ</p> : (
                        <div className="space-y-2 max-h-36 overflow-y-auto">
                          {stageTasks.slice(0, 6).map(t => (
                            <div key={t.id} className="flex items-center gap-2 text-xs">
                              <span className={`w-2 h-2 rounded-full ${t.status === 'Completed' ? 'bg-emerald-500' : t.status === 'InProgress' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                              <span className="font-semibold text-slate-800 truncate flex-1">{t.title || t.taskName}</span>
                              <span className="text-slate-500 shrink-0">{t.assignedToName || 'Chưa giao'}</span>
                            </div>
                          ))}
                          {stageTasks.length > 6 && <p className="text-[10px] text-slate-400">+ {stageTasks.length - 6} tác vụ khác</p>}
                        </div>
                      )}
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-slate-100">
                      <p className="text-xs font-bold uppercase text-slate-500 mb-3">📐 Đo lường ({stageMeasurements.length})</p>
                      {stageMeasurements.length === 0 ? <p className="text-xs text-slate-400 italic">Chưa có chỉ số</p> : (
                        <div className="grid grid-cols-2 gap-2">
                          {stageMeasurements.slice(0, 4).map(m => (
                            <div key={m.id} className="bg-slate-50 rounded-lg p-2">
                              <p className="text-[10px] font-bold text-slate-600 uppercase truncate">{m.metricName}</p>
                              <p className="text-sm font-mono font-bold text-slate-900">{m.targetValue ?? '—'}{m.unit}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Result Editor */}
                  <div className="bg-white rounded-xl p-5 border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-bold text-slate-900 flex items-center gap-2">📊 Kết quả giai đoạn</p>
                      {!isEditing ? (
                        <button onClick={() => startEdit(s)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all hover:scale-105">
                          ✏️ Chỉnh sửa
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={cancelEdit} className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50">Hủy</button>
                          <button onClick={() => saveEdit(s.id)} disabled={savingId === s.id}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50">
                            {savingId === s.id ? '⏳ Đang lưu...' : '💾 Lưu'}
                          </button>
                        </div>
                      )}
                    </div>

                    {!isEditing && parsedResult && (
                      <div className="space-y-4">
                        {isPerGroup && parsedResult.byGroup ? (
                          groups.map(g => {
                            const obj = parsedResult.byGroup[g.id] || {};
                            return (
                              <div key={g.id} className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                                <p className="text-xs font-bold text-indigo-700 mb-3 flex items-center gap-2">👥 {g.groupName} <span className="text-indigo-400">({g.groupType})</span></p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {schema.filter(f => f.type === 'number').map(f => (
                                    <div key={f.key} className="bg-white rounded-lg p-3 border border-indigo-100">
                                      <p className="text-[10px] text-slate-500 uppercase">{f.label}</p>
                                      <p className="text-base font-bold text-slate-900">{obj[f.key] ?? '—'}{f.unit}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {schema.filter(f => f.type === 'number').map(f => (
                              <div key={f.key} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                <p className="text-[10px] text-slate-500 uppercase">{f.label}</p>
                                <p className="text-base font-bold text-slate-900">{parsedResult[f.key] ?? '—'}{f.unit}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {isEditing && (
                      <div className="space-y-4">
                        {/* Gợi ý tự động từ task reports / measurements */}
                        {(() => {
                          const hints = getStageSuggestedHints(s);
                          if (hints.length === 0) return null;
                          return (
                            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">💡 Gợi ý tự động từ dữ liệu</p>
                                <span className="text-[10px] text-amber-600 italic">Click để điền vào form</span>
                              </div>
                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                {hints.map((h, i) => (
                                  <button key={i} onClick={() => {
                                    if (h.key) {
                                      if (editData._isPerGroup) {
                                        // Điền vào tất cả các nhóm
                                        groups.forEach(g => updateField(h.key, String(h.numericValue ?? ''), g.id));
                                      } else {
                                        updateField(h.key, String(h.numericValue ?? ''));
                                      }
                                      showToast(`Đã điền ${h.label}`, 'success');
                                    }
                                  }} className="bg-white rounded-lg p-2 border border-amber-100 hover:border-amber-300 hover:shadow-sm transition-all text-left">
                                    <p className="text-[10px] text-slate-500 uppercase">{h.icon} {h.label}</p>
                                    <p className="text-sm font-bold text-amber-700">{h.value}{h.source && <span className="text-[10px] text-slate-500 ml-1">({h.source})</span>}</p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        {editData._isPerGroup ? (
                          groups.map(g => (
                            <div key={g.id} className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                              <p className="text-xs font-bold text-indigo-700 mb-3">👥 {g.groupName}</p>
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                {schema.filter(f => f.type === 'number').map(f => (
                                  <div key={f.key}>
                                    <label className="text-[10px] text-slate-500 uppercase block mb-1">{f.label} {f.unit && `(${f.unit})`}</label>
                                    <input type="number" value={editData.resultData?.byGroup?.[g.id]?.[f.key] || ''}
                                      onChange={e => updateField(f.key, e.target.value, g.id)}
                                      className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {schema.filter(f => f.type === 'number').map(f => (
                              <div key={f.key}>
                                <label className="text-[10px] text-slate-500 uppercase block mb-1">{f.label} {f.unit && `(${f.unit})`}</label>
                                <input type="number" value={editData.resultData?.[f.key] || ''}
                                  onChange={e => updateField(f.key, e.target.value)}
                                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button onClick={() => onDeleteStage(s.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1 transition-colors">
                      🗑️ Xóa giai đoạn
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── ExperimentHierarchyView ──────────────────────────────────────────────────
import ExperimentHierarchyView from '../../components/researcher/ExperimentHierarchyView';
const ExperimentHierarchyViewLazy = ExperimentHierarchyView;

// ── Tasks Section ─────────────────────────────────────────────────────────────
const TaskTypeIcon = ({ type }) => {
  const icons = {
    Watering: '💧', Irrigation: '💦', Fertilizing: '🧪', Fertilizer: '🧪',
    Weeding: '🌿', PestControl: '🐛', Spraying: '🧴', Inspection: '👁️',
    Planting: '🌱', Harvesting: '🌾', Recording: '📝', Measurement: '📏',
    Pruning: '✂️', Mulching: '🍂', SoilPrep: '🪴', Default: '📌',
  };
  return <span className="text-lg">{icons[type] || icons.Default}</span>;
};

const TaskStatusBadge = ({ status, dueDate }) => {
  const overdue = dueDate && new Date(dueDate) < new Date() && !['Completed', 'Cancelled', 'Approved'].includes(status);
  const meta = {
    Pending: { label: 'Chờ', bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    Assigned: { label: 'Đã giao', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
    InProgress: { label: 'Đang làm', bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    Completed: { label: 'Hoàn thành', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    Cancelled: { label: 'Đã hủy', bg: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
    Approved: { label: 'Đã duyệt', bg: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  };
  const m = meta[status] || { label: status, bg: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' };
  return (
    <div className="flex items-center gap-2">
      {overdue && <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold animate-pulse">🚨 Quá hạn</span>}
      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${m.bg}`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${m.dot}`} />{m.label}
      </span>
    </div>
  );
};

const TaskPriorityBadge = ({ priority }) => {
  const m = { High: { label: 'Cao', bg: 'bg-rose-50 text-rose-700' }, Medium: { label: 'TB', bg: 'bg-amber-50 text-amber-700' }, Low: { label: 'Thấp', bg: 'bg-blue-50 text-blue-700' } };
  const p = m[priority] || m.Medium;
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.bg}`}>{p.label}</span>;
};

const SingleTaskCard = ({ task, batch, group, showBatch, showGroup, onClick }) => (
  <div onClick={() => onClick?.(task)} className={`flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-indigo-200 hover:shadow-sm transition-all group/single ${onClick ? 'cursor-pointer' : ''}`}>
    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
      <TaskTypeIcon type={task.taskType} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 leading-snug">{task.title}</p>
        <TaskStatusBadge status={task.status} dueDate={task.dueDate} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-slate-500">
        {task.taskType && <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">{task.taskType}</span>}
        {showGroup && group && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded flex items-center gap-0.5">👥 {group.groupName}</span>}
        {showBatch && batch && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded flex items-center gap-0.5">📦 {batch.batchCode}</span>}
        {task.assignedToName && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded flex items-center gap-0.5">👤 {task.assignedToName}</span>}
        {!task.assignedToName && (task.status === 'Pending' || task.status === 'Assigned') && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded flex items-center gap-0.5">⚠️ Chưa gán</span>}
        {task.experimentStageName && <span className="px-1.5 py-0.5 bg-violet-50 text-violet-700 rounded flex items-center gap-0.5">🪜 {task.experimentStageName}</span>}
        {task.dueDate && <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">📅 {new Date(task.dueDate).toLocaleDateString('vi-VN')}</span>}
        {task.priority && <TaskPriorityBadge priority={task.priority} />}
      </div>
    </div>
    {onClick && (
      <button onClick={(e) => { e.stopPropagation(); onClick(task); }} className="opacity-0 group-hover/single:opacity-100 transition-opacity px-2 py-1 text-slate-500 hover:bg-slate-100 rounded-lg text-xs font-bold" title="Xem chi tiết">›</button>
    )}
  </div>
);

const TasksSection = ({ tasks, groups, batches, taskStats, taskReportsByBatch, onOpenTaskDetail }) => {
  const [viewMode, setViewMode] = useState('batch'); // 'batch' | 'all'
  const [expandedBatch, setExpandedBatch] = useState({});
  const [taskFilter, setTaskFilter] = useState('all');

  const tasksByBatch = useMemo(() => {
    const m = new Map(); batches.forEach(b => m.set(b.id, []));
    tasks.forEach(t => {
      const bid = t.batchId || t.batch?.id;
      if (bid && m.has(bid)) m.get(bid).push(t);
    });
    return m;
  }, [tasks, batches]);

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all') return tasks;
    return tasks.filter(t => t.status === taskFilter || (taskFilter === 'overdue' && t.dueDate && new Date(t.dueDate) < new Date() && !['Completed', 'Cancelled', 'Approved'].includes(t.status)));
  }, [tasks, taskFilter]);

  const plantCountForBatch = (batchId) => {
    const reports = taskReportsByBatch?.[batchId] || [];
    return reports.filter(r => r.taskType === 'Planting' || r.taskType === 2).reduce((sum, r) => sum + (Number(r.actualPlantCount || r.plantCount) || 0), 0);
  };

  const getBatch = (batchId) => batches.find(b => b.id === batchId);
  const getGroup = (groupId) => groups.find(g => g.id === groupId);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">📌 Tác Vụ</h2>
            <p className="text-sm text-slate-500 mt-0.5">Danh sách tác vụ chi tiết theo lô. Bấm vào tác vụ để xem chi tiết và gán người thực hiện.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 rounded-lg text-xs">
              <span className="font-bold text-slate-700">Tổng:</span>
              <span className="font-bold text-indigo-600">{taskStats.total}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>⏳ {taskStats.pending}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span>🔄 {taskStats.inProgress}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>✅ {taskStats.completed}</span>
              {taskStats.overdue > 0 && <span className="flex items-center gap-1 text-rose-600"><span className="w-2 h-2 rounded-full bg-rose-500"></span>🚨 {taskStats.overdue}</span>}
            </div>
          </div>
        </div>
        {/* View mode tabs */}
        <div className="flex items-center gap-1 mt-3">
          <button onClick={() => setViewMode('batch')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${viewMode === 'batch' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>📦 Theo Lô</button>
          <button onClick={() => setViewMode('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${viewMode === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>📋 Tất cả</button>
          <div className="ml-2 border-l border-slate-200 pl-2">
            <select value={taskFilter} onChange={e => setTaskFilter(e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white">
              <option value="all">Tất cả</option>
              <option value="Pending">Chờ</option>
              <option value="Assigned">Đã giao</option>
              <option value="InProgress">Đang làm</option>
              <option value="Completed">Hoàn thành</option>
              <option value="overdue">Quá hạn</option>
            </select>
          </div>
        </div>
      </div>

      <div className="p-4">
        {tasks.length === 0 && filteredTasks.length === 0 ? (
          <EmptyState icon="📌" title="Chưa có tác vụ nào" description="Tác vụ sẽ xuất hiện khi được tạo" />
        ) : viewMode === 'batch' ? (
          /* ── View theo lô ── */
          <div className="space-y-3">
            {batches.map(batch => {
              const group = getGroup(batch.groupId);
              const batchTasks = (tasksByBatch.get(batch.id) || []).filter(t => taskFilter === 'all' || t.status === taskFilter || (taskFilter === 'overdue' && t.dueDate && new Date(t.dueDate) < new Date()));
              if (batchTasks.length === 0 && taskFilter !== 'all') return null;
              const planted = plantCountForBatch(batch.id);
              const completed = batchTasks.filter(t => t.status === 'Completed' || t.status === 'Approved').length;
              const pending = batchTasks.filter(t => t.status === 'Pending').length;
              return (
                <div key={batch.id} className="border border-emerald-200 rounded-xl overflow-hidden bg-emerald-50/20">
                  <button onClick={() => setExpandedBatch(prev => ({ ...prev, [batch.id]: !prev[batch.id] }))}
                    className="w-full px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between hover:bg-emerald-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">📦</span>
                      <div className="text-left">
                        <p className="font-bold text-sm text-slate-900">{batch.batchCode || `Batch #${batch.id}`}</p>
                        <p className="text-xs text-slate-500">
                          {group ? `👥 ${group.groupName}` : '—'} · 🌱 {planted} cây · {batchTasks.length} tác vụ
                          {completed > 0 && <span className="ml-1 text-emerald-600">✅ {completed}</span>}
                          {pending > 0 && <span className="ml-1 text-blue-600">⏳ {pending}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold">{batchTasks.length}</span>
                      <span className="text-slate-400">{expandedBatch[batch.id] ? '▾' : '▸'}</span>
                    </div>
                  </button>
                  {expandedBatch[batch.id] && (
                    <div className="p-3 space-y-1.5">
                      {batchTasks.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 py-3 italic">Chưa có tác vụ cho lô này</p>
                      ) : batchTasks.map(task => (
                        <SingleTaskCard key={task.id} task={task} batch={batch} group={group} showBatch showGroup onClick={onOpenTaskDetail} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ── View tất cả (danh sách phẳng) ── */
          <div className="space-y-1.5">
            {filteredTasks.map(task => {
              const batch = getBatch(task.batchId);
              const group = batch ? getGroup(batch.groupId) : null;
              return (
                <SingleTaskCard key={task.id} task={task} batch={batch} group={group} showBatch showGroup onClick={onOpenTaskDetail} />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Task Detail Drawer (chi tiết task + assign/reassign) ──────────────────────────
const TaskDetailDrawer = ({ task, onClose, stages, batches, groups, taskReports, onAssign, onReassign, showToast }) => {
  const [assignModal, setAssignModal] = useState(null); // 'assign' | 'reassign' | null
  const [assigneeId, setAssigneeId] = useState('');
  const [reason, setReason] = useState('');
  const [users, setUsersApi] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    if (assignModal) {
      setLoadingUsers(true);
      userApi.list({ role: 'Student,Technician' })
        .then(r => { if (alive) setUsersApi(Array.isArray(r) ? r : (r?.items || r?.data || [])); })
        .catch(err => console.warn('Load users failed:', err))
        .finally(() => alive && setLoadingUsers(false));
    }
    return () => { alive = false; };
  }, [assignModal]);

  if (!task) return null;

  const batch = batches.find(b => b.id === (task.batchId || task.batch?.id));
  const group = groups.find(g => g.id === (task.groupId || batch?.groupId || task.batch?.groupId));
  const stage = stages.find(s => s.id === (task.experimentStageId || task.stageId));

  const reports = (taskReports || []).filter(r => r.taskId === task.id);
  const assignments = task.assignments || [];
  const skills = task.requiredSkills || task.skillRequirements || [];

  const statusMap = {
    Pending: { label: 'Chờ', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
    Assigned: { label: 'Đã giao', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    InProgress: { label: 'Đang làm', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
    Completed: { label: 'Hoàn thành', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    Cancelled: { label: 'Đã hủy', bg: 'bg-slate-100 text-slate-500 border-slate-200' },
    Approved: { label: 'Đã duyệt', bg: 'bg-teal-50 text-teal-700 border-teal-200' },
  };
  const sm = statusMap[task.status] || { label: task.status, bg: 'bg-slate-100 text-slate-600 border-slate-200' };
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && !['Completed', 'Cancelled', 'Approved'].includes(task.status);
  const isAssigned = task.assigneeId || task.assignedToId;
  const canAssign = !isAssigned && ['Pending'].includes(task.status);
  const canReassign = isAssigned && ['Pending', 'Assigned', 'InProgress'].includes(task.status);

  const handleConfirm = async () => {
    if (!assigneeId) { showToast('Chọn người thực hiện', 'error'); return; }
    setSaving(true);
    try {
      if (assignModal === 'assign') {
        await onAssign(task.id, assigneeId, reason);
        showToast('Đã gán tác vụ', 'success');
      } else {
        await onReassign(task.id, assigneeId, reason);
        showToast('Đã chuyển giao tác vụ', 'success');
      }
      setAssignModal(null);
      setAssigneeId(''); setReason('');
    } catch (err) {
      showToast(err.message || 'Lỗi', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest opacity-80">Chi tiết tác vụ</p>
              <h3 className="font-bold text-lg mt-0.5 truncate">{task.title}</h3>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center font-bold">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Status + Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${sm.bg}`}>{sm.label}</span>
            {overdue && <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold animate-pulse">🚨 Quá hạn</span>}
            {task.priority && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-bold">Ưu tiên: {task.priority}</span>}
            {task.taskType && <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">{task.taskType}</span>}
            <div className="ml-auto flex items-center gap-2">
              {canAssign && <button onClick={() => setAssignModal('assign')} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">📌 Gán</button>}
              {canReassign && <button onClick={() => setAssignModal('reassign')} className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700">🔄 Chuyển giao</button>}
            </div>
          </div>

          {task.description && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs font-bold uppercase text-slate-400 mb-1">Mô tả</p>
              <p className="text-sm text-slate-700 leading-relaxed">{task.description}</p>
            </div>
          )}

          {/* Thông tin liên kết */}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon="🪜" label="Giai đoạn" value={stage ? `#${stage.stageOrder} ${stage.stageName}` : '—'} />
            <InfoRow icon="📦" label="Lô" value={batch?.batchCode || '—'} />
            <InfoRow icon="👥" label="Nhóm" value={group?.groupName || '—'} />
            <InfoRow icon="📅" label="Hạn" value={task.dueDate ? new Date(task.dueDate).toLocaleDateString('vi-VN') : '—'} />
            <InfoRow icon="👤" label="Người tạo" value={task.createdByName || '—'} />
            <InfoRow icon="🎯" label="Người thực hiện" value={task.assignedToName || '—'} highlight={isAssigned ? 'indigo' : 'amber'} />
          </div>

          {/* Kỹ năng yêu cầu */}
          {skills.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase text-slate-400 mb-2">🎯 Kỹ năng yêu cầu</p>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((sk, i) => (
                  <span key={i} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold">
                    {typeof sk === 'string' ? sk : sk.skillName || sk.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Reports */}
          <div>
            <p className="text-xs font-bold uppercase text-slate-400 mb-2">📋 Báo cáo ({reports.length})</p>
            {reports.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-3">Chưa có báo cáo</p>
            ) : (
              <div className="space-y-1.5">
                {reports.map(r => (
                  <div key={r.id || r.reportId} className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{r.taskType || '—'}</span>
                      <span className="text-slate-500">{r.submittedAt ? new Date(r.submittedAt).toLocaleString('vi-VN') : ''}</span>
                    </div>
                    {(r.actualPlantCount || r.plantCount) && (
                      <p className="text-emerald-700 font-bold mt-1">🌱 {r.actualPlantCount || r.plantCount} cây</p>
                    )}
                    {r.notes && <p className="text-slate-600 mt-0.5 line-clamp-2">{r.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lịch sử chuyển giao */}
          {assignments.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase text-slate-400 mb-2">🔄 Lịch sử chuyển giao</p>
              <div className="space-y-1.5">
                {assignments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 text-xs border border-slate-100">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800">{a.fromUserName || 'Hệ thống'} → {a.toUserName || '—'}</p>
                      <p className="text-slate-500 text-[10px]">{a.assignedAt ? new Date(a.assignedAt).toLocaleString('vi-VN') : ''}</p>
                      {a.reason && <p className="text-slate-600 italic text-[10px]">"{a.reason}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal chọn người giao */}
      {assignModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setAssignModal(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-slate-900 mb-1">{assignModal === 'assign' ? '📌 Gán tác vụ' : '🔄 Chuyển giao tác vụ'}</h3>
            <p className="text-sm text-slate-600 mb-4 truncate">"{task.title}"</p>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Người thực hiện *</label>
            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} disabled={loadingUsers}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white mb-3">
              <option value="">{loadingUsers ? 'Đang tải...' : '— Chọn người —'}</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.fullName || u.name} ({u.role})</option>)}
            </select>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Lý do (tùy chọn)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Nhập lý do..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setAssignModal(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-bold">Hủy</button>
              <button onClick={handleConfirm} disabled={saving || !assigneeId} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold">
                {saving ? 'Đang lưu...' : (assignModal === 'assign' ? 'Xác nhận gán' : 'Xác nhận chuyển giao')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const InfoRow = ({ icon, label, value, highlight }) => (
  <div className={`rounded-lg p-2.5 border ${highlight === 'indigo' ? 'bg-indigo-50 border-indigo-200' : highlight === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
    <p className="text-[10px] font-bold uppercase text-slate-400 mb-0.5 flex items-center gap-1">{icon} {label}</p>
    <p className="text-xs font-bold text-slate-900 truncate">{value || '—'}</p>
  </div>
);

// ── Schedules Section ─────────────────────────────────────────────────────────
const SchedulesSection = ({ schedules, groups, batches, stages, form, setForm, onCreate, onDelete, saving }) => {
  const [expandedStage, setExpandedStage] = useState({});
  const schedulesByStage = useMemo(() => {
    const m = new Map(); stages.forEach(s => m.set(s.id, []));
    const unassigned = [];
    schedules.forEach(s => {
      const sid = s.experimentStageId || '_unassigned';
      if (m.has(sid)) m.get(sid).push(s);
      else unassigned.push(s);
    });
    if (unassigned.length > 0) m.set('_unassigned', unassigned);
    return m;
  }, [schedules, stages]);

  const handleStageChange = (stageId) => {
    const selected = stages.find(s => s.id === stageId);
    const updates = { ...form, experimentStageId: stageId };
    if (selected && !form.startDate && selected.startDate) updates.startDate = selected.startDate.split('T')[0];
    if (selected && !form.endDate && selected.endDate) updates.endDate = selected.endDate.split('T')[0];
    setForm(updates);
  };

  const typeMeta = {
    Watering: { icon: '💧', label: 'Tưới nước', color: 'blue' },
    Fertilizing: { icon: '🧪', label: 'Bón phân', color: 'amber' },
    Observation: { icon: '👁️', label: 'Quan sát', color: 'purple' },
    Inspection: { icon: '🔍', label: 'Kiểm tra', color: 'indigo' },
    Harvest: { icon: '🌾', label: 'Thu hoạch', color: 'orange' },
    Planting: { icon: '🌱', label: 'Trồng', color: 'emerald' },
    Other: { icon: '📋', label: 'Khác', color: 'slate' },
  };

  const scheduleByType = useMemo(() => {
    const map = {};
    schedules.forEach(s => {
      const type = s.taskType || 'Other';
      if (!map[type]) map[type] = 0;
      map[type]++;
    });
    return map;
  }, [schedules]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">📅 Lịch Chăm Sóc</h2>
            <p className="text-sm text-slate-500 mt-0.5">Tổ chức theo giai đoạn thí nghiệm</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(scheduleByType).map(([type, count]) => {
              const tm = typeMeta[type] || typeMeta.Other;
              return <span key={type} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">{tm.icon} {count}</span>;
            })}
          </div>
        </div>
      </div>

      {/* Form tạo */}
      <div className="px-6 py-5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-sm font-bold">+</span>
          <h4 className="text-sm font-bold text-amber-800">Thêm Lịch Chăm Sóc Mới</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Giai đoạn *</label>
            <select value={form.experimentStageId} onChange={e => handleStageChange(e.target.value)}
              className="w-full px-3 py-2.5 border border-amber-200 rounded-xl text-sm bg-white">
              <option value="">— Chọn giai đoạn —</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>#{s.stageOrder} {s.stageName || s.name}{s.startDate ? ` (${new Date(s.startDate).toLocaleDateString('vi-VN')})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Loại công việc</label>
            <select value={form.taskType} onChange={e => setForm({ ...form, taskType: e.target.value })}
              className="w-full px-3 py-2.5 border border-amber-200 rounded-xl text-sm bg-white">
              {Object.entries(typeMeta).map(([v, m]) => <option key={v} value={v}>{m.icon} {m.label}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Tiêu đề lịch *</label>
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="VD: Tưới nước buổi sáng"
              className="w-full px-3 py-2.5 border border-amber-200 rounded-xl text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Lô áp dụng</label>
            <select value={form.batchId} onChange={e => setForm({ ...form, batchId: e.target.value })}
              className="w-full px-3 py-2.5 border border-amber-200 rounded-xl text-sm bg-white">
              <option value="">— Tất cả lô —</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.batchCode || b.name} ({b.plantCount || 0} cây)</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Tần suất (ngày/lần)</label>
            <input type="number" min="1" value={form.frequencyDays} onChange={e => setForm({ ...form, frequencyDays: e.target.value })}
              className="w-full px-3 py-2.5 border border-amber-200 rounded-xl text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Ngày bắt đầu</label>
            <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
              className="w-full px-3 py-2.5 border border-amber-200 rounded-xl text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Ngày kết thúc</label>
            <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
              className="w-full px-3 py-2.5 border border-amber-200 rounded-xl text-sm bg-white" />
          </div>
        </div>
        <button onClick={onCreate} disabled={saving}
          className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-200 transition-all hover:scale-105">
          {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Đang tạo...</> : '➕ Tạo Lịch'}
        </button>
      </div>

      {/* Danh sách */}
      <div className="p-4 space-y-3">
        {stages.length === 0 && schedules.length === 0 ? (
          <EmptyState icon="📅" title="Chưa có lịch chăm sóc nào" description="Tạo giai đoạn trước, sau đó thêm lịch chăm sóc" />
        ) : stages.map(stage => {
          const stageSchedules = schedulesByStage.get(stage.id) || [];
          const isOpen = expandedStage[stage.id] !== false;
          const meta = getStageStyle(stage.stageType);
          return (
            <div key={stage.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <button onClick={() => setExpandedStage(prev => ({ ...prev, [stage.id]: !isOpen }))}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                    meta.color === 'amber' ? 'bg-amber-100 text-amber-700' :
                    meta.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-violet-100 text-violet-700'
                  }`}>{meta.icon}</div>
                  <div className="text-left">
                    <p className="font-bold text-sm text-slate-900">#{stage.stageOrder} {stage.stageName || stage.name || 'Giai đoạn'}</p>
                    <p className="text-xs text-slate-500">{stage.stageType || '—'} · {stageSchedules.length} lịch</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold">{stageSchedules.length}</span>
                  <span className="text-slate-400">{isOpen ? '▾' : '▸'}</span>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 p-3 space-y-2 bg-slate-50/50">
                  {stageSchedules.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-3 italic">Chưa có lịch cho giai đoạn này</p>
                  ) : stageSchedules.map(schedule => {
                    const tm = typeMeta[schedule.taskType] || typeMeta.Other;
                    const colorMap = { blue: 'bg-blue-50 text-blue-700', amber: 'bg-amber-50 text-amber-700', purple: 'bg-purple-50 text-purple-700', indigo: 'bg-indigo-50 text-indigo-700', orange: 'bg-orange-50 text-orange-700', emerald: 'bg-emerald-50 text-emerald-700', slate: 'bg-slate-50 text-slate-700' };
                    return (
                      <div key={schedule.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 hover:border-amber-200 transition-colors group">
                        <span className="text-xl">{tm.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{schedule.title || schedule.scheduleName || tm.label}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-500">
                            {schedule.frequencyDays && <span>🔁 {schedule.frequencyDays} ngày/lần</span>}
                            {schedule.startDate && <span>📅 {new Date(schedule.startDate).toLocaleDateString('vi-VN')}</span>}
                            {schedule.endDate && <span>→ {new Date(schedule.endDate).toLocaleDateString('vi-VN')}</span>}
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${colorMap[tm.color]}`}>{tm.label}</span>
                        <button onClick={() => onDelete(schedule.id)} className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity font-bold">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Measurements Section ───────────────────────────────────────────────────────
const MeasurementsSection = ({ measurements, groups, form, setForm, onCreate, onDelete, saving }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-100">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">📊 Chỉ Số Đo Lường</h2>
          <p className="text-sm text-slate-500 mt-0.5">Định nghĩa các chỉ số cần theo dõi</p>
        </div>
        <span className="px-3 py-1.5 bg-teal-100 text-teal-700 rounded-lg text-sm font-bold">{measurements.length} chỉ số</span>
      </div>
    </div>
    <div className="px-6 py-5 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-100">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold">+</span>
        <h4 className="text-sm font-bold text-teal-800">Thêm Chỉ Số Đo Lường Mới</h4>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Nhóm *</label>
          <select value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value })}
            className="w-full px-3 py-2.5 border border-teal-200 rounded-xl text-sm bg-white">
            <option value="">— Chọn nhóm —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.groupName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Tên chỉ số *</label>
          <input value={form.metricName} onChange={e => setForm({ ...form, metricName: e.target.value })}
            placeholder="VD: Chiều cao cây" className="w-full px-3 py-2.5 border border-teal-200 rounded-xl text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Đơn vị</label>
          <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
            placeholder="VD: cm, kg" className="w-full px-3 py-2.5 border border-teal-200 rounded-xl text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Giá trị mục tiêu</label>
          <input type="number" step="0.1" value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.targetValue })}
            placeholder="VD: 30" className="w-full px-3 py-2.5 border border-teal-200 rounded-xl text-sm bg-white" />
        </div>
        <div className="lg:col-span-4">
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Mô tả</label>
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Phương pháp đo, tiêu chuẩn..." className="w-full px-3 py-2.5 border border-teal-200 rounded-xl text-sm bg-white" />
        </div>
      </div>
      <button onClick={onCreate} disabled={saving}
        className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-teal-200 transition-all hover:scale-105">
        {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Đang tạo...</> : '➕ Tạo Chỉ Số'}
      </button>
    </div>
    <div className="p-4">
      {measurements.length === 0 ? (
        <EmptyState icon="📊" title="Chưa có chỉ số nào" description="Tạo chỉ số để bắt đầu theo dõi" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {measurements.map(m => (
            <div key={m.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 hover:border-teal-300 transition-all hover:shadow-md group">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{m.metricName || '—'}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">👥 {groups.find(g => g.id === m.groupId)?.groupName || m.groupId || '—'}</p>
                </div>
                <button onClick={() => onDelete(m.id)} className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity font-bold shrink-0">✕</button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {m.unit && <span className="px-2 py-1 bg-slate-200 text-slate-600 rounded-lg">📏 {m.unit}</span>}
                {m.targetValue !== null && m.targetValue !== undefined && (
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-bold">🎯 {m.targetValue}{m.unit}</span>
                )}
              </div>
              {m.description && <p className="text-xs text-slate-400 mt-2 italic line-clamp-2">{m.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

// ── Batches Section ───────────────────────────────────────────────────────────
const BatchesSection = ({ batches, groups, bedAssignments, form, setForm, onCreate, onDelete, saving, taskReportsByBatch }) => {
  const plantedCount = (batchId) => {
    const reports = taskReportsByBatch?.[batchId] || [];
    return reports.reduce((sum, r) => sum + (Number(r.actualPlantCount || r.plantCount) || 0), 0);
  };
  return (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-100">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">📦 Lô Thí Nghiệm</h2>
          <p className="text-sm text-slate-500 mt-0.5">Tạo và quản lý các lô trồng</p>
        </div>
        <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">{batches.length} lô</span>
      </div>
    </div>
    <div className="px-6 py-5 bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">+</span>
        <h4 className="text-sm font-bold text-emerald-800">Thêm Lô Mới</h4>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Nhóm *</label>
          <select value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value })}
            className="w-full px-3 py-2.5 border border-emerald-200 rounded-xl text-sm bg-white">
            <option value="">— Chọn nhóm —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.groupName} ({g.groupType})</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Luống gán</label>
          <select value={form.experimentBedAssignmentId} onChange={e => setForm({ ...form, experimentBedAssignmentId: e.target.value })}
            className="w-full px-3 py-2.5 border border-emerald-200 rounded-xl text-sm bg-white">
            <option value="">— Chọn luống —</option>
            {bedAssignments.map(a => <option key={a.id} value={a.id}>{a.bedCode || a.bedId}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Mã lô *</label>
          <input value={form.batchCode} onChange={e => setForm({ ...form, batchCode: e.target.value })}
            placeholder="VD: LOT-A1" className="w-full px-3 py-2.5 border border-emerald-200 rounded-xl text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Số cây dự kiến</label>
          <input type="number" min="1" value={form.plantCount} onChange={e => setForm({ ...form, plantCount: e.target.value })}
            placeholder="VD: 50" className="w-full px-3 py-2.5 border border-emerald-200 rounded-xl text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Ngày trồng</label>
          <input type="date" value={form.plantingDate} onChange={e => setForm({ ...form, plantingDate: e.target.value })}
            className="w-full px-3 py-2.5 border border-emerald-200 rounded-xl text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Ngày dự kiến thu hoạch</label>
          <input type="date" value={form.expectedHarvestDate} onChange={e => setForm({ ...form, expectedHarvestDate: e.target.value })}
            className="w-full px-3 py-2.5 border border-emerald-200 rounded-xl text-sm bg-white" />
        </div>
        <div className="lg:col-span-2">
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Ghi chú</label>
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Ghi chú thêm..." className="w-full px-3 py-2.5 border border-emerald-200 rounded-xl text-sm bg-white" />
        </div>
      </div>
      <button onClick={onCreate} disabled={saving}
        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-200 transition-all hover:scale-105">
        {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Đang tạo...</> : '➕ Tạo Lô'}
      </button>
    </div>
    <div className="p-4">
      {batches.length === 0 ? (
        <EmptyState icon="📦" title="Chưa có lô nào" description="Tạo lô đầu tiên để bắt đầu trồng" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {batches.map(batch => {
            const planted = plantedCount(batch.id);
            const expected = Number(batch.plantCount) || 0;
            const progress = expected > 0 ? Math.min(100, Math.round((planted / expected) * 100)) : 0;
            return (
              <div key={batch.id} className="bg-white rounded-xl p-4 border border-slate-200 hover:border-emerald-300 transition-all hover:shadow-md group">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-bold text-sm text-slate-900 font-mono">{batch.batchCode || batch.name || '—'}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">👥 {groups.find(g => g.id === batch.groupId)?.groupName || batch.groupId || '—'}</p>
                  </div>
                  <button onClick={() => onDelete(batch.id)} className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity font-bold shrink-0">✕</button>
                </div>
                {/* Chi tiết số cây đã trồng */}
                <div className="mb-3 p-3 bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg border border-emerald-100">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Đã trồng</span>
                    <span className="text-xs text-slate-500">/ {expected} cây</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-emerald-700">{planted}</span>
                    <span className="text-xs text-slate-600 font-semibold">cây</span>
                    {progress > 0 && <span className="ml-auto text-[10px] font-bold text-emerald-600">{progress}%</span>}
                  </div>
                  {expected > 0 && (
                    <div className="mt-2 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {batch.plantingDate && <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md">📅 {new Date(batch.plantingDate).toLocaleDateString('vi-VN')}</span>}
                  {batch.expectedHarvestDate && <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md">🌾 {new Date(batch.expectedHarvestDate).toLocaleDateString('vi-VN')}</span>}
                </div>
                {batch.notes && <p className="text-xs text-slate-400 mt-2 italic line-clamp-2">{batch.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
  );
};

// ── Design Section ───────────────────────────────────────────────────────────
const DesignSection = ({ experiment }) => {
  const raw = experiment.design || experiment.designParameters || experiment.designConfig;
  let parsed = null;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  } else if (typeof raw === 'object' && raw !== null) {
    parsed = raw;
  }

  const type = experiment.designType || experiment.designName || parsed?.designType || parsed?.type || '';

  const typeMeta = {
    'CRD': { label: 'CRD', desc: 'Complete Randomize Design', color: 'indigo', icon: '🎲' },
    'RCBD': { label: 'RCBD', desc: 'Randomized Complete Block Design', color: 'violet', icon: '🧱' },
    'LSRD': { label: 'LSRD', desc: 'Latin Square Row Design', color: 'purple', icon: '🗂️' },
    'Factorial': { label: 'Factorial', desc: 'Factorial Experiment', color: 'blue', icon: '✖️' },
    'Split-Plot': { label: 'Split-Plot', desc: 'Split-Plot Design', color: 'teal', icon: '📊' },
    'Strip-Plot': { label: 'Strip-Plot', desc: 'Strip-Plot Design', color: 'cyan', icon: '🟧' },
    'Nested': { label: 'Nested', desc: 'Nested Design', color: 'amber', icon: '🔢' },
    'Ammi': { label: 'AMMI', desc: 'Additive Main Effects and Multiplicative Interaction', color: 'green', icon: '📈' },
    'FactorialRCBD': { label: 'Factorial RCBD', desc: 'Factorial in RCBD', color: 'emerald', icon: '🧮' },
  };
  const tm = typeMeta[type] || { label: type || 'Thí nghiệm', desc: experiment.designDescription || '', color: 'slate', icon: '📐' };
  const colorMap = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
  };

  const getIcon = (key) => {
    const map = {
      replicates: '🔁', blocks: '🧱', rows: '➗', columns: '➗', factors: '✖️',
      factorLevels: '🔢', treatmentFactors: '🧪', experimentalUnits: '📦',
      plotSize: '📏', plantSpacing: '🌱', rowSpacing: '↔️', spacing: '↔️',
      harvestArea: '🌾', plantDensity: '📊', duration: '📅',
      numberOfTreatments: '🧪', treatmentCombinations: '🔀', controlTreatment: '✅',
      treatments: '💊', variables: '📊', observations: '👁️',
    };
    return map[key] || '📋';
  };

  const formatValue = (val) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Có' : 'Không';
    if (typeof val === 'number') return val.toLocaleString('vi-VN');
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">📐 Thiết Kế Thí Nghiệm</h2>
        <p className="text-sm text-slate-500 mt-0.5">Phương pháp bố trí & thông số thiết kế</p>
      </div>
      <div className="p-6">
        {/* Header với loại thiết kế */}
        {type && (
          <div className={`flex items-center gap-4 p-4 rounded-2xl border mb-6 ${colorMap[tm.color] || colorMap.slate}`}>
            <div className="w-14 h-14 rounded-2xl bg-white/80 flex items-center justify-center text-2xl shadow-sm">{tm.icon}</div>
            <div>
              <p className="font-bold text-base text-slate-900">{tm.label}</p>
              <p className="text-xs mt-0.5 opacity-75">{tm.desc}</p>
            </div>
          </div>
        )}

        {parsed ? (
          <div className="space-y-3">
            {/* Nhóm các trường jsonb theo category */}
            {(() => {
              const layout = parsed.layout || parsed.experimentalLayout || null;
              const treatment = parsed.treatments || parsed.treatmentFactors || parsed.factorLevels || null;
              const stats = parsed.statistical || parsed.analysis || null;
              const field = parsed.fieldDesign || parsed.plotLayout || null;

              const sections = [];
              if (layout) {
                const entries = Object.entries(layout).filter(([k, v]) => v !== null && v !== undefined && k !== 'id');
                if (entries.length > 0) sections.push({ title: '📐 Bố Trí Thí Nghiệm', items: entries });
              }
              if (treatment) {
                const entries = Object.entries(treatment).filter(([k, v]) => v !== null && v !== undefined && k !== 'id');
                if (entries.length > 0) sections.push({ title: '💊 Xử Lý & Nhân Tố', items: entries });
              }
              if (field) {
                const entries = Object.entries(field).filter(([k, v]) => v !== null && v !== undefined && k !== 'id');
                if (entries.length > 0) sections.push({ title: '📏 Kích Thước Ô', items: entries });
              }
              if (stats) {
                const entries = Object.entries(stats).filter(([k, v]) => v !== null && v !== undefined && k !== 'id');
                if (entries.length > 0) sections.push({ title: '📊 Thống Kê', items: entries });
              }

              // fallback: nếu không có layout/treatment cụ thể thì hiển thị toàn bộ
              if (sections.length === 0) {
                const entries = Object.entries(parsed).filter(([k, v]) => v !== null && v !== undefined && k !== 'id' && k !== 'designType' && k !== 'type' && k !== 'designName');
                if (entries.length > 0) sections.push({ title: '⚙️ Cấu Hình Thiết Kế', items: entries });
              }

              return sections.map(sec => (
                <div key={sec.title}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{sec.title}</p>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {sec.items.map(([key, value]) => (
                      <div key={key} className="bg-slate-50 rounded-xl p-3 border border-slate-200 hover:border-indigo-200 transition-colors">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-sm">{getIcon(key)}</span>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 leading-snug">{formatValue(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        ) : type || experiment.designDescription ? (
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-violet-200">📐</div>
            <div>
              <p className="text-base font-bold text-slate-900">{type || experiment.designType}</p>
              {experiment.designDescription && <p className="text-sm text-slate-500 mt-1">{experiment.designDescription}</p>}
            </div>
          </div>
        ) : (
          <EmptyState icon="📐" title="Chưa có thông tin thiết kế" description="Thông tin thiết kế sẽ được cập nhật" />
        )}
      </div>
    </div>
  );
};

// ── Beds Section ─────────────────────────────────────────────────────────────
const BedsSection = ({ bedAssignments, availableBeds, areas, batches }) => {
  const areaMap = useMemo(() => { const m = new Map(); areas.forEach(a => m.set(a.id, a)); return m; }, [areas]);
  const bedMap = useMemo(() => { const m = new Map(); availableBeds.forEach(b => m.set(b.id, b)); return m; }, [availableBeds]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">🌱 Luống Đã Gán</h2>
            <p className="text-sm text-slate-500 mt-0.5">Vị trí vật lý của các lô trong nông trại</p>
          </div>
          <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">{bedAssignments.length} luống</span>
        </div>
      </div>
      <div className="p-4">
        {bedAssignments.length === 0 ? (
          <EmptyState icon="🌱" title="Chưa có luống nào được gán" description="Luống sẽ xuất hiện khi được gán cho thí nghiệm" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {bedAssignments.map(assignment => {
              const bed = bedMap.get(assignment.bedId) || {};
              const area = areaMap.get(assignment.areaId || bed.areaId) || {};
              const batch = batches.find(b => b.experimentBedAssignmentId === assignment.id);
              return (
                <div key={assignment.id} className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-200 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl">🌱</span>
                    <p className="font-bold text-sm text-slate-900">{bed.bedCode || bed.name || assignment.bedId}</p>
                  </div>
                  <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">📍 {area.areaName || area.name || '—'}</p>
                  {batch && (
                    <div className="mt-2 px-2 py-1.5 bg-emerald-100 rounded-lg">
                      <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">📦 {batch.batchCode || batch.name}</p>
                      <p className="text-xs text-emerald-600">🌱 {batch.plantCount || 0} cây</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExperimentDetailPage;