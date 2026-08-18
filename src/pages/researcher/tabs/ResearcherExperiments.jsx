import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { experimentsApi, tasksApi, experimentRequestsApi, taskReportsApi, measurementRecordsApi } from '../../../api/experimentApi';
import { farmsApi, bedsApi } from '../../../api/managerResourcesApi';
import { stagesApi, groupsApi, designApi, measurementsApi, schedulesApi, batchesApi, bedAssignmentsApi, userApi, areasApi } from '../../../api/researcherApi';
import { canCreateTaskOnStage, canGenerateTasksFromStage, canCreateBatch } from '../../../utils/taskValidation';
import { aggregatePlantCountFromReports, comparePlannedVsActual } from '../../../utils/measurement';
import { autoFillAllFields, autoFillFromDynamicSchema, evaluateAgainstTarget, buildMiniComparison, generateStructuredComment, getFieldMeta, computeResultsByGroup, computeResultsFromSchedulesAndReports, calcScheduledOccurrences, isPerGroupStage, getAutoFillFieldKeys, addDynamicMeasurementsToSchema, buildGrowthResultSchema } from '../../../utils/stageResultCompute';
import { cropsApi } from '../../../api/cropApi';
import { skillsApi, tasksCountApi } from '../../../api/skillsApi';
import { useToast } from '../../../context/ToastContext';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import Pagination from '../../../components/ui/Pagination';
import BatchEditModal from '../../../components/researcher/BatchEditModal';
import StatisticsDashboard from '../../../components/researcher/StatisticsDashboard';
import IoTSensorTab from '../../../components/iot/IoTSensorTab';

// ── Portal helper ─────────────────────────────────────────────────────────────

const Portal = ({ children }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

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
  { id: 'iot', label: 'IoT Sensor' },
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

// ── Business Validation: Reassign ──────────────────────────────────────────────────
// Nghiệp vụ: chỉ được chuyển giao task khi thoả 3 điều kiện đồng thời.
// Lý do: đảm bảo audit trail, tránh race condition, tránh chuyển cho chính mình.
//
// 1. Task thuộc nhóm "active" — chưa kết thúc vòng đời.
//    Loại trừ: Completed, Approved (đã duyệt), Cancelled, Rejected, Resigned,
//    Reassigned (đang chuyển).
// 2. Phải có người đang assigned — nếu chưa có, dùng chức năng "Gán" thay thế.
// 3. Người đang assigned phải khác researcher đang thao tác — tự chuyển cho mình
//    là vô nghĩa và phá audit trail.
//
// Trả về { allowed: boolean, reason: string } để UI hiển thị tooltip giải thích.

const REASSIGN_ALLOWED_STATUSES = ['Pending', 'Assigned', 'InProgress', 'Overdue'];
const REASSIGN_BLOCKED_STATUSES = ['Completed', 'Approved', 'Cancelled', 'Rejected', 'Resigned', 'Reassigned'];

// ── Helper lấy assignee thật của task (BE có thể trả nhiều field khác nhau) ───
// Phải đồng bộ với ResearcherKPIs.jsx (cùng fallback chain) để tránh logic lệch nhau
export const getTaskAssignee = (task) => {
  if (!task) return { id: null, name: null };
  return {
    id: task.assignedToId || task.assignedToUserId || task.assigneeId || null,
    name: task.assignedToName || task.assignedToUserName || task.assigneeName || null
  };
};

export const isTaskAssigned = (task) => {
  const { id, name } = getTaskAssignee(task);
  return Boolean(id || name);
};

export const canReassignTask = (task, currentUserId) => {
  if (!task) return { allowed: false, reason: 'Không có tác vụ' };

  if (!REASSIGN_ALLOWED_STATUSES.includes(task.status)) {
    const reason = REASSIGN_BLOCKED_STATUSES.includes(task.status)
      ? `Tác vụ đã ở trạng thái "${task.status}" — không thể chuyển giao`
      : `Trạng thái "${task.status}" không cho phép chuyển giao`;
    return { allowed: false, reason };
  }

  // P0 fix: chỉ cần 1 trong 2 trường (id hoặc name) là đủ chứng minh đã gán
  // Tránh block nhầm khi BE chỉ trả 1 field (vd `assignedToId` nhưng không có `assignedToName`)
  if (!isTaskAssigned(task)) {
    return { allowed: false, reason: 'Tác vụ chưa được gán cho ai — dùng "Gán" để phân công' };
  }

  const { id: assigneeId } = getTaskAssignee(task);
  if (currentUserId && assigneeId === currentUserId) {
    return { allowed: false, reason: 'Bạn là người đang được gán — không thể tự chuyển cho mình' };
  }

  return { allowed: true, reason: 'Chuyển giao tác vụ sang người khác' };
};

// ExperimentStageType enum mới (BE cập nhật): Preparation | Planting | Growing | Harvesting | PostHarvest | Other
const STAGE_TYPES = [
  { value: 'Preparation', label: 'Chuẩn bị (Preparation)', icon: '🛠️', color: 'amber' },
  { value: 'Planting', label: 'Gieo trồng (Planting)', icon: '🌱', color: 'emerald' },
  { value: 'Nursery', label: 'Ươm cây (Nursery)', icon: '🪴', color: 'emerald' },
  { value: 'Care', label: 'Chăm sóc (Care)', icon: '💧', color: 'blue' },
  { value: 'Growing', label: 'Sinh trưởng (Growing)', icon: '📈', color: 'emerald' },
  { value: 'Growth', label: 'Theo dõi sinh trưởng (Growth)', icon: '📊', color: 'teal' },
  { value: 'Evaluation', label: 'Đánh giá (Evaluation)', icon: '✅', color: 'amber' },
  { value: 'Harvesting', label: 'Thu hoạch (Harvesting)', icon: '🌾', color: 'amber' },
  { value: 'Harvest', label: 'Thu hoạch (Harvest)', icon: '🌾', color: 'amber' },
  { value: 'PostHarvest', label: 'Sau thu hoạch (PostHarvest)', icon: '📦', color: 'slate' },
  { value: 'Other', label: 'Khác (Other)', icon: '📌', color: 'slate' }
];

// Schema cho form ResultData theo từng stageType (tự động sinh field)
// Mỗi field: { key, label, type, unit, min, max, step, hint, group, autoFrom }
const RESULT_DATA_SCHEMA = {
  Nursery: [
    { key: 'soLuong', label: 'Số lượng cây giống', type: 'number', unit: 'cây', min: 0, step: 1, icon: '🌱', group: 'Số lượng' },
    { key: 'tiLeNayMam', label: 'Tỷ lệ nảy mầm', type: 'number', unit: '%', min: 0, max: 100, step: 0.1, icon: '🌿', group: 'Chất lượng' },
    { key: 'chatLuongCayGiong', label: 'Đánh giá chất lượng', type: 'select', options: [{ value: 'tot', label: 'Tốt' }, { value: 'dat', label: 'Đạt' }, { value: 'kem', label: 'Kém' }], icon: '⭐', group: 'Chất lượng' },
    { key: 'ghiChu', label: 'Ghi chú', type: 'text', icon: '📝', group: 'Khác' }
  ],
  Planting: [
    { key: 'dienTichGieo', label: 'Diện tích gieo', type: 'number', unit: 'm²', min: 0, step: 0.1, icon: '📐', group: 'Diện tích' },
    { key: 'matDoGieo', label: 'Mật độ gieo', type: 'number', unit: 'cây/m²', min: 0, step: 0.1, icon: '🌱', group: 'Diện tích' },
    { key: 'soLuongHatGiong', label: 'Số lượng hạt giống', type: 'number', unit: 'hạt', min: 0, step: 1, icon: '🌰', group: 'Số lượng' },
    { key: 'tiLeNayMam', label: 'Tỷ lệ nảy mầm', type: 'number', unit: '%', min: 0, max: 100, step: 0.1, icon: '🌿', group: 'Chất lượng' }
  ],
  Care: [
    { key: 'soLanTuoi', label: 'Số lần tưới', type: 'number', unit: 'lần', min: 0, step: 1, icon: '💧', group: 'Tưới nước' },
    { key: 'luongNuocTong', label: 'Tổng lượng nước', type: 'number', unit: 'lít', min: 0, step: 1, icon: '💦', group: 'Tưới nước' },
    { key: 'soLanBonPhan', label: 'Số lần bón phân', type: 'number', unit: 'lần', min: 0, step: 1, icon: '🧪', group: 'Phân bón' },
    { key: 'loaiPhanBon', label: 'Loại phân bón', type: 'text', icon: '🧬', group: 'Phân bón' },
    { key: 'soLanPhunThuoc', label: 'Số lần phun thuốc BVTV', type: 'number', unit: 'lần', min: 0, step: 1, icon: '🛡️', group: 'Phòng trừ sâu bệnh' },
    { key: 'ghiChu', label: 'Ghi chú', type: 'text', icon: '📝', group: 'Khác' }
  ],
  Growing: [
    { key: 'chieuCaoCm', label: 'Chiều cao trung bình', type: 'number', unit: 'cm', min: 0, step: 0.1, icon: '📏', group: 'Sinh trưởng', autoFrom: 'avgHeight' },
    { key: 'soLaTrungBinh', label: 'Số lá trung bình', type: 'number', unit: 'lá', min: 0, step: 0.1, icon: '🍃', group: 'Sinh trưởng' },
    { key: 'tiLeSong', label: 'Tỷ lệ sống', type: 'number', unit: '%', min: 0, max: 100, step: 0.1, icon: '❤️', group: 'Sức khỏe', autoFrom: 'survivalRate' },
    { key: 'tocDoSinhTruong', label: 'Tốc độ sinh trưởng', type: 'number', unit: 'cm/ngày', min: 0, step: 0.01, icon: '📈', group: 'Sinh trưởng' }
  ],
  Growth: [
    { key: 'chieuCaoCm', label: 'Chiều cao trung bình', type: 'number', unit: 'cm', min: 0, step: 0.1, icon: '📏', group: 'Sinh trưởng', autoFrom: 'avgHeight' },
    { key: 'soLaTrungBinh', label: 'Số lá trung bình', type: 'number', unit: 'lá', min: 0, step: 0.1, icon: '🍃', group: 'Sinh trưởng' },
    { key: 'tiLeSong', label: 'Tỷ lệ sống', type: 'number', unit: '%', min: 0, max: 100, step: 0.1, icon: '❤️', group: 'Sức khỏe', autoFrom: 'survivalRate' },
    { key: 'tocDoSinhTruong', label: 'Tốc độ sinh trưởng', type: 'number', unit: 'cm/ngày', min: 0, step: 0.01, icon: '📈', group: 'Sinh trưởng' },
    { key: 'ghiChu', label: 'Ghi chú', type: 'text', icon: '📝', group: 'Khác' }
  ],
  Evaluation: [
    { key: 'tiLeDauQua', label: 'Tỷ lệ đậu quả', type: 'number', unit: '%', min: 0, max: 100, step: 0.1, icon: '🍎', group: 'Năng suất' },
    { key: 'tiLeSong', label: 'Tỷ lệ sống', type: 'number', unit: '%', min: 0, max: 100, step: 0.1, icon: '❤️', group: 'Sức khỏe' },
    { key: 'danhGia', label: 'Đánh giá tổng thể', type: 'select', options: [{ value: 'xuat_sac', label: 'Xuất sắc' }, { value: 'tot', label: 'Tốt' }, { value: 'dat', label: 'Đạt' }, { value: 'kem', label: 'Kém' }], icon: '⭐', group: 'Đánh giá' },
    { key: 'ghiChu', label: 'Ghi chú', type: 'text', icon: '📝', group: 'Khác' }
  ],
  Harvest: [
    { key: 'sanLuongKg', label: 'Sản lượng', type: 'number', unit: 'kg', min: 0, step: 0.1, icon: '⚖️', group: 'Sản lượng' },
    { key: 'sanLuongTan', label: 'Sản lượng (tấn)', type: 'number', unit: 'tấn', min: 0, step: 0.01, icon: '🌾', group: 'Sản lượng' },
    { key: 'chatLuong', label: 'Phân loại chất lượng', type: 'select', options: [{ value: 'A', label: 'Loại A' }, { value: 'B', label: 'Loại B' }, { value: 'C', label: 'Loại C' }], icon: '🏆', group: 'Chất lượng' },
    { key: 'donGia', label: 'Đơn giá', type: 'number', unit: 'VNĐ/kg', min: 0, step: 100, icon: '💰', group: 'Kinh tế' },
    { key: 'ghiChu', label: 'Ghi chú', type: 'text', icon: '📝', group: 'Khác' }
  ],
  Harvesting: [
    { key: 'sanLuongKg', label: 'Sản lượng', type: 'number', unit: 'kg', min: 0, step: 0.1, icon: '⚖️', group: 'Sản lượng' },
    { key: 'chatLuong', label: 'Phân loại chất lượng', type: 'select', options: [{ value: 'A', label: 'Loại A' }, { value: 'B', label: 'Loại B' }, { value: 'C', label: 'Loại C' }], icon: '🏆', group: 'Chất lượng' },
    { key: 'donGia', label: 'Đơn giá', type: 'number', unit: 'VNĐ/kg', min: 0, step: 100, icon: '💰', group: 'Kinh tế' }
  ],
  PostHarvest: [
    { key: 'khoiLuongBaoQuan', label: 'Khối lượng bảo quản', type: 'number', unit: 'kg', min: 0, step: 0.1, icon: '📦', group: 'Bảo quản' },
    { key: 'tyLeHaoHut', label: 'Tỷ lệ hao hụt', type: 'number', unit: '%', min: 0, max: 100, step: 0.1, icon: '📉', group: 'Bảo quản' },
    { key: 'nhietDoBaoQuan', label: 'Nhiệt độ bảo quản', type: 'number', unit: '°C', step: 0.1, icon: '🌡️', group: 'Bảo quản' }
  ],
  Preparation: [
    { key: 'dienTichChuanBi', label: 'Diện tích chuẩn bị', type: 'number', unit: 'm²', min: 0, step: 0.1, icon: '📐', group: 'Diện tích' },
    { key: 'thietBiSuDung', label: 'Thiết bị sử dụng', type: 'text', icon: '🛠️', group: 'Thiết bị' },
    { key: 'nhanCong', label: 'Số nhân công', type: 'number', unit: 'người', min: 0, step: 1, icon: '👷', group: 'Nhân lực' }
  ],
  Other: [
    { key: 'ghiChu', label: 'Ghi chú', type: 'text', icon: '📝', group: 'Khác' }
  ]
};

// Lấy schema theo stageType, fallback về Other
const getSchemaForStage = (stageType) => RESULT_DATA_SCHEMA[stageType] || RESULT_DATA_SCHEMA.Other;

// Lấy style màu theo stageType
const getStageStyle = (stageType) => {
  const t = STAGE_TYPES.find(s => s.value === stageType);
  return t || { icon: '📌', color: 'slate' };
};

// Group các field theo group
const groupFields = (schema) => {
  const groups = {};
  schema.forEach(f => {
    const g = f.group || 'Khác';
    if (!groups[g]) groups[g] = [];
    groups[g].push(f);
  });
  return groups;
};

// GroupType giữ nguyên enum string: Control | Treatment
const GROUP_TYPES = [
  { value: 'Control', label: 'Đối chứng (Control)' },
  { value: 'Treatment', label: 'Xử lý (Treatment)' }
];

// DesignType enum mới (BE cập nhật): CRD | RCBD | LSD | Factorial | SplitPlot | Other
const DESIGN_TYPES = [
  { value: 'CRD', label: 'CRD - Completely Randomized' },
  { value: 'RCBD', label: 'RCBD - Randomized Complete Block' },
  { value: 'LSD', label: 'LSD - Latin Square Design' },
  { value: 'Factorial', label: 'Factorial Design' },
  { value: 'SplitPlot', label: 'Split-Plot Design' },
  { value: 'Other', label: 'Khác (Other)' }
];

// TaskType giữ nguyên string enum (BE không đổi)
const TASK_TYPES = [
  { value: 'Planting', label: 'Trồng (Planting)' },
  { value: 'Watering', label: 'Tưới nước (Watering)' },
  { value: 'Fertilizing', label: 'Bón phân (Fertilizing)' },
  { value: 'Observation', label: 'Quan sát (Observation)' },
  { value: 'Inspection', label: 'Kiểm tra (Inspection)' },
  { value: 'Harvest', label: 'Thu hoạch (Harvest)' },
  { value: 'Other', label: 'Khác (Other)' }
];

// ── Researcher Experiments List ───────────────────────────────────────────────────

const ResearcherExperiments = ({ prefillData, onPrefillConsumed }) => {
  const { showToast } = useToast();
  const [experiments, setExperiments] = useState([]);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allSkills, setAllSkills] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFarm, setFilterFarm] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
      // Lấy tất cả yêu cầu, lọc Approved chưa được dùng (chưa có experimentId)
      const data = await experimentRequestsApi.getAll({ status: 'Approved' });
      const list = (Array.isArray(data) ? data : []).filter(r => !r.experimentId);
      setQuickRequests(list);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách yêu cầu', 'error');
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
      showToast('Vui lòng chọn 1 yêu cầu', 'warning');
      return;
    }
    try {
      setQuickSubmitting(true);
      const exp = await experimentsApi.createFromRequest(selectedRequestId);
      const newId = exp?.id || exp?.data?.id;
      showToast('Đã tạo thí nghiệm nhanh từ yêu cầu!', 'success');
      closeQuickCreate();
      fetchExperiments();
      // Mở thẳng detail experiment mới tạo
      if (newId) {
        const found = (await experimentsApi.getAll()).find(e => e.id === newId);
        if (found) openDetail(found);
      }
    } catch (err) {
      showToast(err.message || 'Lỗi tạo thí nghiệm nhanh', 'error');
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
      showToast(err.message || 'Không thể tải danh sách thí nghiệm', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFarms(); fetchCropVarieties(); }, []);
  useEffect(() => { fetchExperiments(); }, [filterFarm, filterStatus]);

  // Load skills for requiredSkills multi-select trong form tạo task
  useEffect(() => {
    let cancelled = false;
    skillsApi.getAll()
      .then(data => { if (!cancelled) setAllSkills(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setAllSkills([]); });
    return () => { cancelled = true; };
  }, []);

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
    if (createForm.startDate) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const start = new Date(createForm.startDate); start.setHours(0, 0, 0, 0);
      if (start < today) errs.startDate = 'Ngày bắt đầu phải là hôm nay hoặc trong tương lai';
    }
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

  // Reset page khi filter thay đổi
  React.useEffect(() => { setPage(1); }, [filterStatus, filterFarm, search]);

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
          {filtered.length} thí nghiệm
        </p>
      </div>

      {/* Experiments Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Mã TN</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Tiêu đề</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Nông trại</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Trạng thái</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Bắt đầu</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Kết thúc</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-on-surface-variant">Đang tải...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center">
                  <div className="text-4xl mb-2">🌱</div>
                  <p className="text-sm font-bold text-on-surface">Chưa có thí nghiệm nào</p>
                  <p className="text-xs text-on-surface-variant mt-1">Nhấn "Tạo TN" để tạo mới, hoặc "Tạo nhanh từ yêu cầu" để tạo từ request đã duyệt.</p>
                </td></tr>
              ) : (
                filtered.slice((page - 1) * pageSize, page * pageSize).map(exp => (
                  <tr key={exp.id} className="border-b border-outline-variant hover:bg-surface-container-low/40 transition-colors">
                    <td className="px-6 py-4 text-xs font-mono font-bold text-on-surface">{exp.experimentCode || '—'}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-on-surface line-clamp-1">{exp.title || '(Không có tiêu đề)'}</p>
                      {exp.objective && <p className="text-[11px] text-on-surface-variant line-clamp-1 mt-0.5">{exp.objective}</p>}
                    </td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant">{exp.farmName || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        exp.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                        exp.status === 'Completed' ? 'bg-blue-100 text-blue-700' :
                        exp.status === 'Planning' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>{exp.status || '—'}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">{exp.startDate || '—'}</td>
                    <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">{exp.endDate || '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => openDetail(exp)}
                        className="text-indigo-600 font-bold text-[10px] uppercase hover:underline whitespace-nowrap">
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            className="px-6 border-t border-outline-variant"
          />
        </div>
      </div>

      {/* Modal Tạo TN nhanh từ Approved Request */}
      {showQuickCreate && (
        <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10200] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-emerald-50/50 shrink-0">
                <div>
                  <h3 className="font-hanken font-bold text-lg text-emerald-700">⚡ Tạo Thí Nghiệm Nhanh</h3>
                  <p className="text-xs text-emerald-700/70 mt-0.5">Chọn 1 yêu cầu đã được duyệt — hệ thống tự động tạo Experiment + Groups + Batches từ MonitoringPlan.</p>
                </div>
                <button onClick={closeQuickCreate} className="text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {quickLoading ? (
                  <div className="py-12 text-center text-sm text-on-surface-variant">Đang tải danh sách yêu cầu...</div>
                ) : quickRequests.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-4xl mb-2">📭</div>
                    <p className="text-sm font-bold text-on-surface">Không có yêu cầu nào đã được duyệt</p>
                    <p className="text-xs text-on-surface-variant mt-1">Vui lòng duyệt yêu cầu trước, hoặc dùng "Tạo TN" để tạo thủ công.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                      {quickRequests.length} yêu cầu khả dụng
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
                              <span className="text-sm font-bold text-on-surface line-clamp-1">{r.title || '(Không có tiêu đề)'}</span>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                Approved
                              </span>
                            </div>
                            <div className="text-xs text-on-surface-variant mt-1 flex items-center gap-3 flex-wrap">
                              <span>🏠 {r.farmName || '—'}</span>
                              <span>📅 {r.expectedStartDate || '—'} → {r.expectedEndDate || '—'}</span>
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
                  Hủy
                </button>
                <button onClick={handleQuickCreate} disabled={!selectedRequestId || quickSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all">
                  {quickSubmitting ? 'Đang tạo...' : (<><span>⚡</span> Tạo TN nhanh</>)}
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
          allSkills={allSkills}
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

    </div>
  );
};

// ── Experiment Detail Modal ───────────────────────────────────────────────────────

const ExperimentDetailModal = ({ experiment, allSkills: parentAllSkills = [], onClose, onExperimentUpdated }) => {
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
  // TaskReports để tính "số cây đã trồng" thực tế từ các report Planting
  // (key theo batchId, value là mảng các report của batch đó).
  const [taskReportsByBatch, setTaskReportsByBatch] = useState({});
  // MeasurementRecords (giá trị thực đo) — dùng cho auto-fill + comparison.
  const [measurementRecords, setMeasurementRecords] = useState([]);

  // Available beds
  const [availableBeds, setAvailableBeds] = useState([]);
  const [areas, setAreas] = useState([]);

  // Task users
  const [users, setUsers] = useState([]);
  const [skillMatches, setSkillMatches] = useState([]);
  const [userWorkload, setUserWorkload] = useState({}); // userId -> {totalTasks, pendingTasks, inProgressTasks, ...}
  const [selectedTaskForAssign, setSelectedTaskForAssign] = useState(null);
  const [reassignModalTask, setReassignModalTask] = useState(null); // {task, saving, form}

  // Edit state
  const [editExp, setEditExp] = useState(null);
  const [showEditExp, setShowEditExp] = useState(false);
  const [savingExp, setSavingExp] = useState(false);

  // Batch edit state
  const [editingBatch, setEditingBatch] = useState(null);
  const [showEditBatch, setShowEditBatch] = useState(false);
  const [updatingBatch, setUpdatingBatch] = useState(false);

  // Đồng bộ editExp với expDetail khi expDetail thay đổi từ bên ngoài (refresh, save...)
  // Chỉ sync khi KHÔNG đang edit để tránh ghi đè dữ liệu user đang nhập
  useEffect(() => {
    if (expDetail && !showEditExp) {
      setEditExp(expDetail);
    }
  }, [expDetail, showEditExp]);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Cache fetched tabs - only fetch once per tab
  const [fetchedTabs, setFetchedTabs] = useState(new Set());

  // Forms
  const [stageForm, setStageForm] = useState({ stageName: '', stageOrder: 1, stageType: 'Preparation', objective: '', startDate: '', endDate: '', resultSummary: '', resultDataRaw: '', overrideEnabled: false, resultDataOverride: '' });
  const [editingStageId, setEditingStageId] = useState(null);
  const [showEditStage, setShowEditStage] = useState(false);
  const [groupForm, setGroupForm] = useState({ groupName: '', groupType: 'Control', treatmentDescription: '' });
  const [designForm, setDesignForm] = useState({ designType: 'RCBD', replicationCount: 3, randomizationMethod: '', designParameters: '' });

  // Populate designForm when design data loads
  useEffect(() => {
    if (design) {
      setDesignForm({
        designType: design.designType || 'RCBD',
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
  const [taskForm, setTaskForm] = useState({ experimentStageId: '', batchId: '', careScheduleId: '', taskType: 'Watering', title: '', description: '', requiredSkillDescription: '', dueDate: '', skillRequirements: [] });
  const [assignForm, setAssignForm] = useState({ assigneeId: '', reason: '' });

  // Lấy current user ID từ localStorage (JWT payload). Memo để tránh re-parse.
  const currentUserId = useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      return u?.id || u?.userId || u?.sub || null;
    } catch { return null; }
  }, []);

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
      } else if (tab === 'stages') {
        const stageData = await stagesApi.getByExperiment(experiment.id);
        setStages(Array.isArray(stageData) ? stageData : []);
        // Also load batches để hiển thị thông tin trồng cây trong stage form
        const batchData = await batchesApi.getByExperiment(experiment.id);
        setBatches(Array.isArray(batchData) ? batchData : []);
        // Load groups for batch-group mapping
        const groupData = await groupsApi.getByExperiment(experiment.id);
        setGroups(Array.isArray(groupData) ? groupData : []);
        // Load task reports for all batches
        const batchList = batchData || [];
        if (batchList.length > 0) {
          const reports = await Promise.allSettled(
            batchList.map(b => taskReportsApi.getByBatch(b.id))
          );
          const map = {};
          batchList.forEach((b, i) => {
            const r = reports[i];
            map[b.id] = r.status === 'fulfilled' ? (Array.isArray(r.value) ? r.value : []) : [];
          });
          setTaskReportsByBatch(map);
        }
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
        // Also ensure stages are loaded for schedule-stage mapping
        if (stages.length === 0) {
          const stageData = await stagesApi.getByExperiment(experiment.id);
          setStages(Array.isArray(stageData) ? stageData : []);
        }
      } else if (tab === 'batches') {
        const data = await batchesApi.getByExperiment(experiment.id);
        setBatches(Array.isArray(data) ? data : []);
        const ba = await bedAssignmentsApi.getByExperiment(experiment.id);
        setBedAssignments(Array.isArray(ba) ? ba : []);
        // Fetch task reports cho từng batch (song song, allSettled để không fail cả batch khi 1 batch lỗi)
        // → dùng để tính "số cây thực tế đã trồng" từ các report Planting.
        const batchList = Array.isArray(data) ? data : [];
        if (batchList.length > 0) {
          const reports = await Promise.allSettled(
            batchList.map(b => taskReportsApi.getByBatch(b.id))
          );
          const map = {};
          batchList.forEach((b, i) => {
            const r = reports[i];
            if (r.status === 'fulfilled') {
              map[b.id] = Array.isArray(r.value) ? r.value : [];
            } else {
              map[b.id] = [];
            }
          });
          setTaskReportsByBatch(map);
        }
        // Fetch measurement records (giá trị thực đo) cho cả experiment
        // → dùng cho auto-fill + comparison trong StagesTab.
        try {
          const records = await measurementRecordsApi.getByExperiment(experiment.id);
          setMeasurementRecords(Array.isArray(records) ? records : []);
        } catch {
          setMeasurementRecords([]);
        }
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
    } catch {
      setAreas([]);
      setAvailableBeds([]);
    } finally {
      // Reset loading kể cả khi 404 (endpoint BE chưa có)
      setTabLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // Fetch all tab data upfront so dropdowns are populated even before user clicks each tab
    ['tasks', 'stages', 'groups', 'design', 'measurements', 'schedules', 'batches'].forEach(tab => {
      if (!fetchedTabs.has(tab)) {
        fetchTabData(tab);
        setFetchedTabs(prev => new Set([...prev, tab]));
      }
    });
    fetchUsers();
    if (expDetail?.farmId) fetchBeds(expDetail.farmId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiment.id]);

  // Update exp status
  const handleStatusChange = async (newStatus) => {
    try {
      await experimentsApi.updateStatus(experiment.id, newStatus);
      showToast('Đã cập nhật trạng thái thí nghiệm', 'success');
      const updated = await experimentsApi.getById(experiment.id);
      const updatedData = updated?.data || updated;
      setExpDetail(updatedData);
      setEditExp(updatedData);
      localStorage.setItem(`exp_detail_${experiment.id}`, JSON.stringify(updatedData));
      if (onExperimentUpdated) onExperimentUpdated(updatedData);
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
      const updatedData = updated?.data || updated;
      setExpDetail(updatedData);
      setEditExp(updatedData); // Đồng bộ form state với data mới nhất
      // Cập nhật cache để lần mở sau có data mới
      localStorage.setItem(`exp_detail_${experiment.id}`, JSON.stringify(updatedData));
      if (onExperimentUpdated) onExperimentUpdated(updatedData);
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

  // Wrapper cho StagesTab: nhận stageId + payload từ component con
  const handleUpdateStageFromTab = async (stageId, payload) => {
    try {
      await stagesApi.update(stageId, payload);
      showToast('Đã cập nhật giai đoạn', 'success');
      fetchTabData('stages');
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật giai đoạn', 'error');
      throw err;
    }
  };

  // Stage edit (giữ cho Modal cũ nếu còn dùng)
  const openEditStage = (s) => {
    setStageForm({
      stageName: s.stageName || '',
      stageOrder: s.stageOrder ?? 1,
      stageType: s.stageType ?? 'Preparation',
      objective: s.objective || '',
      startDate: s.startDate ? s.startDate.slice(0, 10) : '',
      endDate: s.endDate ? s.endDate.slice(0, 10) : '',
      resultSummary: s.resultSummary || '',
      // ResultData từ BE (string JSON), parse ra để chỉnh nếu cần
      resultDataRaw: s.resultData || '',
      // Override edit (UI): khi bật "override", user nhập JSON riêng
      overrideEnabled: false,
      resultDataOverride: ''
    });
    setEditingStageId(s.id);
    setShowEditStage(true);
  };
  const closeEditStage = () => { setShowEditStage(false); setEditingStageId(null); };
  const handleUpdateStage = async () => {
    if (!editingStageId) return;
    if (!stageForm.stageName.trim()) { showToast('Tên giai đoạn không được trống', 'error'); return; }
    try {
      const payload = {
        stageName: stageForm.stageName,
        stageOrder: parseInt(stageForm.stageOrder) || 1,
        stageType: stageForm.stageType,
        objective: stageForm.objective,
        startDate: stageForm.startDate || null,
        endDate: stageForm.endDate || null,
        resultSummary: stageForm.resultSummary || null
      };
      if (stageForm.overrideEnabled && stageForm.resultDataOverride.trim()) {
        // Validate JSON
        try { JSON.parse(stageForm.resultDataOverride); }
        catch { showToast('JSON Override không hợp lệ', 'error'); return; }
        payload.resultData = stageForm.resultDataOverride;
      } else {
        // BÁO BE tự tính
        payload.resultData = null;
      }
      await stagesApi.update(editingStageId, payload);
      showToast('Đã cập nhật giai đoạn', 'success');
      closeEditStage();
      fetchTabData('stages');
    } catch (err) { showToast(err.message || 'Lỗi cập nhật giai đoạn', 'error'); }
  };

  // Group CRUD
  const handleCreateGroup = async () => {
    if (!groupForm.groupName.trim()) { showToast('Tên nhóm không được trống', 'error'); return; }
    try {
      await groupsApi.create(experiment.id, { ...groupForm });
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
        await designApi.update(experiment.id, { designType: designForm.designType, replicationCount: parseInt(designForm.replicationCount), randomizationMethod: designForm.randomizationMethod, designParameters: designForm.designParameters });
      } else {
        await designApi.create(experiment.id, { designType: designForm.designType, replicationCount: parseInt(designForm.replicationCount), randomizationMethod: designForm.randomizationMethod, designParameters: designForm.designParameters });
      }
      showToast('Đã lưu thiết kế', 'success');
      fetchTabData('design');
    } catch (err) { showToast(err.message || 'Lỗi lưu thiết kế', 'error'); }
  };
  const handleDeleteDesign = async () => { openConfirm('Xóa Thiết Kế', 'Bạn có chắc muốn xóa thiết kế?', async () => { try { await designApi.remove(experiment.id); showToast('Đã xóa thiết kế', 'success'); fetchTabData('design'); } catch (err) { showToast(err.message, 'error'); } }); };

  // Auto-Setup: Tạo Groups + Batches tự động từ Design
  const handleAutoSetup = async () => {
    if (!design) {
      showToast('Cần tạo thiết kế trước khi chạy Auto-Setup.', 'warning');
      return;
    }
    openConfirm(
      'Auto-Setup Experiment',
      'Hệ thống sẽ tự động tạo Groups và Batches dựa trên thiết kế hiện tại. Tiếp tục?',
      async () => {
        try {
          setTabLoading(true);
          const result = await experimentsApi.autoSetup(experiment.id);
          showToast(result?.message || 'Auto-Setup hoàn tất!', 'success');
          // Refresh all relevant tabs
          fetchTabData('groups');
          fetchTabData('batches');
        } catch (err) {
          showToast(err.message || 'Lỗi Auto-Setup', 'error');
        } finally {
          setTabLoading(false);
        }
      }
    );
  };

  // Randomize Beds: Phân bổ beds ngẫu nhiên cho các groups
  const handleRandomizeBeds = async () => {
    if (groups.length === 0) {
      showToast('Cần có ít nhất một nhóm trước khi randomize.', 'warning');
      return;
    }
    openConfirm(
      'Randomize Beds',
      `Phân bổ ngẫu nhiên ${bedAssignments.length} beds cho ${groups.length} nhóm. Tiếp tục?`,
      async () => {
        try {
          setTabLoading(true);
          const result = await experimentsApi.randomizeBeds(experiment.id);
          showToast(result?.message || 'Randomize thành công!', 'success');
          fetchTabData('batches');
        } catch (err) {
          showToast(err.message || 'Lỗi Randomize Beds', 'error');
        } finally {
          setTabLoading(false);
        }
      }
    );
  };

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
    if (scheduleForm.startDate) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const start = new Date(scheduleForm.startDate); start.setHours(0, 0, 0, 0);
      if (start < today) { showToast('Ngày bắt đầu lịch phải là hôm nay hoặc trong tương lai', 'error'); return; }
    }
    if (scheduleForm.endDate && scheduleForm.startDate && scheduleForm.endDate < scheduleForm.startDate) {
      showToast('Ngày kết thúc phải sau ngày bắt đầu', 'error'); return;
    }
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
    // P0-#9: bắt buộc groupId + batchCode + experimentBedAssignmentId
    const batchCheck = canCreateBatch({
      experimentStageId: 'stub',
      groupId: batchForm.groupId,
      name: batchForm.batchCode
    });
    if (!batchCheck.allowed) { showToast(batchCheck.reason, 'error'); return; }
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

  const handleUpdateBatch = async (batchId, payload) => {
    try {
      setUpdatingBatch(true);
      await batchesApi.update(batchId, payload);
      showToast('Đã cập nhật lô', 'success');
      await fetchTabData('batches');
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật lô', 'error');
      throw err;
    } finally {
      setUpdatingBatch(false);
    }
  };

  const openBatchEdit = (batch) => {
    setEditingBatch(batch);
    setShowEditBatch(true);
  };

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
        if (stages.length === 0) {
          showToast('Thí nghiệm chưa có giai đoạn nào. Vui lòng thêm giai đoạn trước.', 'error');
          return;
        }
        if (groups.length === 0) {
          showToast('Thí nghiệm chưa có nhóm nào. Vui lòng thêm nhóm trước.', 'error');
          return;
        }
        // P0-#8: chặn generate nếu experiment không còn Active/Draft
        if (experiment?.status && !['Active', 'Draft'].includes(experiment.status)) {
          showToast(`Thí nghiệm đang ở trạng thái "${experiment.status}" — không thể generate tasks`, 'error');
          return;
        }
        await tasksApi.generateByExperiment(experiment.id);
        showToast('Đã tạo tác vụ tự động cho thí nghiệm', 'success');
      } else if (type === 'stage') {
        let stageId = taskForm.experimentStageId;
        // Auto-select first stage if none selected and only one stage exists
        if (!stageId && stages.length === 1) {
          stageId = stages[0].id;
          setTaskForm(f => ({ ...f, experimentStageId: stageId }));
        }
        if (!stageId) {
          showToast('Vui lòng chọn giai đoạn hoặc thêm giai đoạn trước', 'error');
          return;
        }
        // P0-#8: validate stage còn active trước khi generate
        const targetStage = stages.find(s => s.id === stageId);
        const stageCheck = canGenerateTasksFromStage(targetStage);
        if (!stageCheck.allowed) { showToast(stageCheck.reason, 'error'); return; }
        await tasksApi.generateByStage(stageId);
        showToast('Đã tạo tác vụ tự động cho giai đoạn', 'success');
      }
      fetchTabData('tasks');
    } catch (err) { showToast(err.message || 'Lỗi tạo tác vụ', 'error'); }
  };

  // Task CRUD
  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) { showToast('Tiêu đề tác vụ không được trống', 'error'); return; }
    // P0-#10: validate stage còn active trước khi tạo task
    const selectedStage = stages.find(s => s.id === taskForm.experimentStageId);
    const stageCheck = canCreateTaskOnStage(selectedStage);
    if (!stageCheck.allowed) { showToast(stageCheck.reason, 'error'); return; }
    // Validate dueDate: phải là hôm nay hoặc tương lai (>= 00:00 hôm nay)
    if (taskForm.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(taskForm.dueDate);
      due.setHours(0, 0, 0, 0);
      if (due < today) {
        showToast('Hạn chót phải là hôm nay hoặc trong tương lai. Không thể tạo tác vụ cho ngày đã qua.', 'error');
        return;
      }
    }
    try {
      const payload = { experimentId: experiment.id, ...taskForm };
      if (!payload.experimentStageId) delete payload.experimentStageId;
      if (!payload.batchId) delete payload.batchId;
      if (!payload.careScheduleId) delete payload.careScheduleId;
      if (!payload.dueDate) delete payload.dueDate;
      if (!payload.description) delete payload.description;
      if (!payload.requiredSkillDescription) delete payload.requiredSkillDescription;
      // skillRequirements: chỉ gửi mảng có item hợp lệ (skillId + requiredLevel >= 1)
      if (Array.isArray(payload.skillRequirements)) {
        payload.skillRequirements = payload.skillRequirements
          .filter(sr => sr && sr.skillId && Number(sr.requiredLevel) >= 1)
          .map(sr => ({ skillId: sr.skillId, requiredLevel: Number(sr.requiredLevel) }));
        if (payload.skillRequirements.length === 0) delete payload.skillRequirements;
      } else {
        delete payload.skillRequirements;
      }
      await tasksApi.create(payload);
      showToast('Đã tạo tác vụ', 'success');
      setTaskForm({ experimentStageId: '', batchId: '', careScheduleId: '', taskType: 'Watering', title: '', description: '', requiredSkillDescription: '', dueDate: '', skillRequirements: [] });
      fetchTabData('tasks');
    } catch (err) { showToast(err.message || 'Lỗi tạo tác vụ', 'error'); }
  };
  const handleDeleteTask = async (id) => { openConfirm('Xóa Tác Vụ', 'Bạn có chắc muốn xóa tác vụ này?', async () => { try { await tasksApi.remove(id); showToast('Đã xóa tác vụ', 'success'); fetchTabData('tasks'); } catch (err) { showToast(err.message, 'error'); } }); };

  // Skill match — kèm workload của các user match trong ngày dueDate của task
  const handleSkillMatch = async (taskId) => {
    try {
      const matches = await tasksApi.getSkillMatches(taskId);
      const matchList = Array.isArray(matches) ? matches : [];
      setSkillMatches(matchList);
      setSelectedTaskForAssign(taskId);

      // Tìm task để biết dueDate
      const task = tasks.find(t => t.id === taskId);
      const dateParam = task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : undefined;

      // Chỉ fetch workload cho các user nằm trong match list
      try {
        const countRes = await tasksCountApi.countByUser(dateParam ? { date: dateParam } : {});
        const userMap = {};
        (countRes?.users || []).forEach(u => {
          userMap[u.userId] = {
            totalTasks: u.totalTasks,
            pendingTasks: u.pendingTasks,
            inProgressTasks: u.inProgressTasks,
            completedTasks: u.completedTasks,
            overdueTasks: u.overdueTasks,
            roleName: u.roleName
          };
        });
        // Giữ cache workload cũ cho user không có trong response mới
        setUserWorkload(prev => ({ ...prev, ...userMap }));
      } catch {
        // Không block UI nếu /count-by-user fail (vd: không phải Researcher hoặc quyền)
      }
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

  // Reassign — mở modal thay vì prompt()
  const openReassign = async (task) => {
    // Defense in depth: dù UI đã ẩn nút, vẫn validate lại ở handler
    const check = canReassignTask(task, currentUserId);
    if (!check.allowed) {
      showToast(check.reason, 'error');
      return;
    }

    // Khi mở, đồng thời fetch skill match + workload để hiển thị gợi ý
    setReassignModalTask({ task, saving: false, form: { assigneeId: '', reason: '' }, skillMatches: [], userWorkload: {}, loading: true });
    try {
      const [matches, countRes] = await Promise.allSettled([
        tasksApi.getSkillMatches(task.id),
        tasksCountApi.countByUser({}).catch(() => ({ users: [] }))
      ]);
      const matchList = matches.status === 'fulfilled' ? (Array.isArray(matches.value) ? matches.value : []) : [];
      const userMap = {};
      (countRes.value?.users || []).forEach(u => {
        userMap[u.userId] = {
          totalTasks: u.totalTasks,
          pendingTasks: u.pendingTasks,
          inProgressTasks: u.inProgressTasks,
          roleName: u.roleName
        };
      });
      setReassignModalTask(prev => prev ? { ...prev, skillMatches: matchList, userWorkload: userMap, loading: false } : prev);
    } catch {
      setReassignModalTask(prev => prev ? { ...prev, loading: false } : prev);
    }
  };

  const closeReassign = () => {
    setReassignModalTask(null);
  };

  const handleConfirmReassign = async () => {
    if (!reassignModalTask) return;
    const { task, form } = reassignModalTask;

    // Defense in depth: validate lại trước khi gọi API
    const check = canReassignTask(task, currentUserId);
    if (!check.allowed) {
      showToast(check.reason, 'error');
      setReassignModalTask(null);
      return;
    }

    if (!form.assigneeId) {
      showToast('Vui lòng chọn người được chuyển giao', 'error');
      return;
    }
    if (form.assigneeId === getTaskAssignee(task).id) {
      showToast('Không thể chuyển cho cùng người đang giữ task', 'error');
      return;
    }
    setReassignModalTask(prev => prev ? { ...prev, saving: true } : prev);
    try {
      await tasksApi.reassign({ taskId: task.id, newAssigneeId: form.assigneeId, reason: form.reason });
      showToast('Đã chuyển giao tác vụ', 'success');
      setReassignModalTask(null);
      fetchTabData('tasks');
    } catch (err) {
      showToast(err.message || 'Lỗi chuyển giao', 'error');
      setReassignModalTask(prev => prev ? { ...prev, saving: false } : prev);
    }
  };

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center shrink-0 bg-indigo-50 min-h-[72px]">
          <div>
            <h3 className="font-hanken font-bold text-lg text-primary">
              {expDetail?.experimentCode || 'Chi Tiết Thí Nghiệm'}
            </h3>
            <p className="text-xs text-on-surface-variant">{expDetail?.title || '—'}</p>
            {expDetail?.procedureTemplateName && (
              <p className="text-[10px] text-indigo-600 mt-0.5">📋 {expDetail.procedureTemplateName}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {expDetail?.status === 'Draft' && (
              <button onClick={() => handleStatusChange('Active')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg">
                ▶ Kích Hoạt (Draft → Active)
              </button>
            )}
            {expDetail?.status === 'Active' && (
              <button onClick={() => handleStatusChange('Paused')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-lg">
                ⏸ Tạm Dừng (Active → Paused)
              </button>
            )}
            {expDetail?.status === 'Paused' && (
              <button onClick={() => handleStatusChange('Active')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg">
                ▶ Tiếp Tục (Paused → Active)
              </button>
            )}
            {(expDetail?.status === 'Active' || expDetail?.status === 'Paused') && (
              <button onClick={() => handleStatusChange('Completed')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg">
                ✅ Kết Thúc
              </button>
            )}
            {expDetail?.status !== 'Completed' && expDetail?.status !== 'Cancelled' && (
              <button onClick={() => handleStatusChange('Cancelled')}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg">
                ✕ Hủy
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
                <StagesTab stages={stages} form={stageForm} setForm={setStageForm} onCreate={handleCreateStage} onDelete={handleDeleteStage} onEdit={openEditStage} onUpdate={handleUpdateStageFromTab} loading={tabLoading} tasks={tasks} measurements={measurements} showToast={showToast} measurementRecords={measurementRecords} groups={groups} batches={batches} taskReportsByBatch={taskReportsByBatch} schedules={schedules} />
              )}
              {activeTab === 'groups' && (
                <GroupsTab groups={groups} form={groupForm} setForm={setGroupForm} onCreate={handleCreateGroup} onDelete={handleDeleteGroup} loading={tabLoading} />
              )}
              {activeTab === 'design' && (
                <DesignTab design={design} form={designForm} setForm={setDesignForm} onSave={handleSaveDesign} onDelete={handleDeleteDesign} loading={tabLoading} />
              )}
              {activeTab === 'measurements' && (
                <MeasurementsTab measurements={measurements} groups={groups} form={measurementForm} setForm={setMeasurementForm} onCreate={handleCreateMeasurement} onDelete={handleDeleteMeasurement} loading={tabLoading} experimentId={experiment?.id} stages={stages} />
              )}
              {activeTab === 'schedules' && (
                <SchedulesTab schedules={schedules} stages={stages} batches={batches} form={scheduleForm} setForm={setScheduleForm} onCreate={handleCreateSchedule} onDelete={handleDeleteSchedule} loading={tabLoading} />
              )}
              {activeTab === 'batches' && (
                <BatchesTab batches={batches} bedAssignments={bedAssignments} groups={groups} form={batchForm} setForm={setBatchForm} onCreate={handleCreateBatch} onDelete={handleDeleteBatch} onEdit={openBatchEdit} onRandomizeBeds={handleRandomizeBeds} loading={tabLoading} taskReportsByBatch={taskReportsByBatch} />
              )}
              {activeTab === 'tasks' && (
<TasksTab
                tasks={tasks} stages={stages} batches={batches} schedules={schedules}
                form={taskForm} setForm={setTaskForm} allSkills={parentAllSkills}
                users={users} assignForm={assignForm} setAssignForm={setAssignForm}
                skillMatches={skillMatches} userWorkload={userWorkload}
                selectedTaskForAssign={selectedTaskForAssign}
                currentUserId={currentUserId}
                onCreate={handleCreateTask} onDelete={handleDeleteTask}
                onGenerate={(type) => handleGenerateTasks(type)}
                onSkillMatch={handleSkillMatch} onAssign={handleAssignTask}
                onReassign={openReassign}
                reassignModalTask={reassignModalTask}
                onReassignFormChange={(patch) => setReassignModalTask(prev => prev ? { ...prev, form: { ...prev.form, ...patch } } : prev)}
                onConfirmReassign={handleConfirmReassign}
                onCloseReassign={closeReassign}
                loading={tabLoading}
              />
              )}
              {activeTab === 'iot' && (
                <IoTSensorTab experimentTitle={expDetail?.title || expDetail?.experimentCode} />
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

      {/* Batch Edit Modal */}
      <BatchEditModal
        open={showEditBatch}
        batch={editingBatch}
        bedAssignments={bedAssignments}
        groups={groups}
        onClose={() => { setShowEditBatch(false); setEditingBatch(null); }}
        onSave={handleUpdateBatch}
      />
    </div>
    </Portal>
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

// Parse ResultData an toàn (string JSON từ BE)
const parseStageResult = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};

// Helper: format số thập phân gọn
const fmtNum = (v, d = 2) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return n.toFixed(d);
};

// Render bảng so sánh groups từ ResultData (Hybrid BE-compute)
const StageResultPanel = ({ result }) => {
  const parsed = parseStageResult(result);
  if (!parsed) return (
    <div className="text-[10px] text-slate-400 italic">Chưa có kết quả — hệ thống sẽ tự tính sau khi bạn bấm Lưu.</div>
  );
  const groups = Array.isArray(parsed.groups) ? parsed.groups : [];
  const comparison = parsed.comparison || null;
  const recordedAt = parsed.recordedAt || null;

  // Tìm best/worst để highlight
  const metricsArr = groups.map(g => ({
    name: g.groupName || g.groupId || '—',
    type: g.groupType || '—',
    bed: g.bedCode || '',
    rep: g.replicateIndex ?? '',
    h: Number(g.metrics?.avgHeight ?? 0) || 0,
    leaf: Number(g.metrics?.avgLeafCount ?? 0) || 0,
    surv: Number(g.metrics?.survivalRate ?? 0) || 0,
    grow: Number(g.metrics?.growthRate ?? 0) || 0,
    yield: Number(g.metrics?.yieldKg ?? 0) || 0,
    raw: g
  }));
  const maxH = Math.max(...metricsArr.map(m => m.h), 0);
  const maxSurv = Math.max(...metricsArr.map(m => m.surv), 0);
  const best = comparison?.bestGroupName
    || (metricsArr.length ? metricsArr.reduce((a, b) => (b.h > a.h ? b : a)).name : null);

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md text-[10px] font-bold uppercase">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" /> BE-computed
          </span>
          {recordedAt && (
            <span className="text-[10px] text-slate-500">Cập nhật: {new Date(recordedAt).toLocaleString('vi-VN')}</span>
          )}
        </div>
        {best && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold">
            🏆 Tốt nhất: <span className="font-extrabold">{best}</span>
            {comparison?.significance && <span className="ml-1 px-1 bg-amber-200 rounded text-[9px]">{comparison.significance}</span>}
          </span>
        )}
      </div>

      {/* Comparison table */}
      {groups.length === 0 ? (
        <div className="text-[11px] text-slate-500 italic py-2">Chưa có nhóm nào trong thí nghiệm để tính.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className="text-left px-2.5 py-2 font-bold uppercase tracking-wide text-[10px]">Nhóm</th>
                <th className="text-left px-2.5 py-2 font-bold uppercase tracking-wide text-[10px]">Loại</th>
                <th className="text-right px-2.5 py-2 font-bold uppercase tracking-wide text-[10px]">Chiều cao TB<br /><span className="font-normal normal-case text-[9px]">(cm)</span></th>
                <th className="text-right px-2.5 py-2 font-bold uppercase tracking-wide text-[10px]">Lá TB</th>
                <th className="text-right px-2.5 py-2 font-bold uppercase tracking-wide text-[10px]">Tỷ lệ sống<br /><span className="font-normal normal-case text-[9px]">(%)</span></th>
                <th className="text-right px-2.5 py-2 font-bold uppercase tracking-wide text-[10px]">Tốc độ sinh trưởng<br /><span className="font-normal normal-case text-[9px]">(cm/ngày)</span></th>
                <th className="text-right px-2.5 py-2 font-bold uppercase tracking-wide text-[10px]">Năng suất<br /><span className="font-normal normal-case text-[9px]">(kg)</span></th>
              </tr>
            </thead>
            <tbody>
              {metricsArr.map((m, i) => {
                const isBest = best && m.name === best;
                const hWidth = maxH > 0 ? Math.max(6, Math.round((m.h / maxH) * 100)) : 0;
                const sWidth = maxSurv > 0 ? Math.max(6, Math.round((m.surv / maxSurv) * 100)) : 0;
                return (
                  <tr key={i} className={`border-t border-slate-100 ${isBest ? 'bg-amber-50/60' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-2.5 py-2">
                      <div className="flex items-center gap-1.5">
                        {isBest && <span>🏆</span>}
                        <span className="font-bold text-slate-800">{m.name}</span>
                        {m.bed && <span className="px-1 py-0.5 bg-slate-100 rounded text-[9px] text-slate-500">{m.bed}</span>}
                        {m.rep !== '' && m.rep !== null && <span className="px-1 py-0.5 bg-slate-100 rounded text-[9px] text-slate-500">R{m.rep}</span>}
                      </div>
                    </td>
                    <td className="px-2.5 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${m.type === 'Control' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'}`}>{m.type}</span>
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono font-bold text-slate-800">
                      <div>{fmtNum(m.h, 1)}</div>
                      <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: hWidth + '%' }} /></div>
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono text-slate-700">{fmtNum(m.leaf, 1)}</td>
                    <td className="px-2.5 py-2 text-right font-mono text-slate-700">
                      <div>{fmtNum(m.surv, 1)}%</div>
                      <div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: sWidth + '%' }} /></div>
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono text-slate-700">{fmtNum(m.grow, 2)}</td>
                    <td className="px-2.5 py-2 text-right font-mono text-slate-700">{fmtNum(m.yield, 2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {comparison?.note && (
        <div className="text-[10px] text-slate-600 italic px-1">📝 {comparison.note}</div>
      )}
    </div>
  );
};

const StagesTab = ({ stages, form, setForm, onCreate, onDelete, onEdit, onUpdate, loading, tasks = [], measurements = [], showToast, measurementRecords = [], groups = [], batches = [], taskReportsByBatch = {}, schedules = [] }) => {
  // State cho accordion: stageId đang mở rộng
  const [expandedId, setExpandedId] = useState(null);
  // State form local cho mỗi stage khi edit
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [savingId, setSavingId] = useState(null);

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  const startEdit = (s) => {
    setEditingId(s.id);
    // Parse ResultData nếu có
    let parsed = {};
    if (s.resultData) {
      try { parsed = typeof s.resultData === 'string' ? JSON.parse(s.resultData) : s.resultData; }
      catch { parsed = {}; }
    }
    // Auto-fill: với mỗi field trong schema có auto-fill được, nếu parsed[key] rỗng
    // → tự động tính từ measurement records (của stage này) và điền vào.
    // Map _autoFilled để UI biết field nào đến từ auto-fill (có thể override sau).
    const stageRecs = measurementRecords.filter(r =>
      r.stageId === s.id || r.experimentStageId === s.id || r.stage?.id === s.id
    );
    // Schema động cho Growing/Growth: tự động lấy từ MeasurementDefinition
    const isGrowth = s.stageType === 'Growing' || s.stageType === 'Growth';
    const dynamicSchema = isGrowth ? buildGrowthResultSchema(s.stageType, measurements) : [];
    // Auto-fill: ưu tiên auto-fill từ schema động (đầy đủ metric), fallback hardcode cho stage khác
    const autoFilledMap = isGrowth && dynamicSchema.length > 0
      ? autoFillFromDynamicSchema(dynamicSchema, stageRecs, measurements)
      : autoFillAllFields(s.stageType, stageRecs, measurements);
    // Hỗ trợ per-group: nếu stage này dùng per-group, ta chia kết quả theo từng nhóm.
    const isPerGroup = isPerGroupStage(s.stageType);
    const merged = isPerGroup
      ? ensurePerGroupStructure(parsed, s.stageType, groups)
      : { ...parsed };
    const autoFilled = {};

    // Auto-fill overall + per-group khi isPerGroup
    if (isPerGroup) {
      const fieldKeys = getAutoFillFieldKeys(s.stageType);
      const computed = computeResultsByGroup({
        stageId: s.id,
        groups,
        batches,
        records: stageRecs,
        definitions: measurements,
        fieldKeys
      });
      // Auto-fill overall (chỉ khi overall[field] rỗng)
      Object.entries(computed.overall).forEach(([k, v]) => {
        if (merged.overall[k] === undefined || merged.overall[k] === null || merged.overall[k] === '') {
          merged.overall[k] = v;
          autoFilled[k] = { value: v, source: `Tổng hợp ${groups.length} nhóm`, count: stageRecs.length };
        }
      });
      // Auto-fill per-group (chỉ khi group[key] rỗng)
      Object.entries(computed.perGroup).forEach(([gid, perG]) => {
        if (!merged.byGroup[gid]) merged.byGroup[gid] = {};
        Object.entries(perG).forEach(([fk, v]) => {
          if (merged.byGroup[gid][fk] === undefined || merged.byGroup[gid][fk] === null || merged.byGroup[gid][fk] === '') {
            merged.byGroup[gid][fk] = v;
          }
        });
      });

      // ── KHÔNG auto-fill từ Schedules + TaskReports vào form nữa ──
      // Researcher sẽ xem bảng tham khảo và tự bấm nút "Điền vào form" nếu muốn.
      // (Logic tham khảo vẫn dùng computeResultsFromSchedulesAndReports ở UI phía dưới.)
    } else {
      // Auto-fill cũ (flat)
      Object.entries(autoFilledMap).forEach(([k, info]) => {
        const cur = merged[k];
        if (cur === undefined || cur === null || cur === '') {
          merged[k] = info.value;
          autoFilled[k] = info;
        }
      });
    }

    setEditData({
      stageName: s.stageName || '',
      stageOrder: s.stageOrder ?? 1,
      stageType: s.stageType || 'Preparation',
      objective: s.objective || '',
      startDate: s.startDate ? s.startDate.slice(0, 10) : '',
      endDate: s.endDate ? s.endDate.slice(0, 10) : '',
      resultSummary: s.resultSummary || '',
      resultData: merged,
      _autoFilled: autoFilled,
      _isPerGroup: isPerGroup
    });
  };

  // Đảm bảo cấu trúc { overall: {...}, byGroup: { [gid]: {...} } } cho per-group stages
  function ensurePerGroupStructure(parsed, stageType, groupsList) {
    const schema = RESULT_DATA_SCHEMA[stageType] || [];
    const overall = {};
    schema.forEach(f => { overall[f.key] = ''; });
    const byGroup = {};
    (groupsList || []).forEach(g => {
      byGroup[g.id] = {};
      schema.forEach(f => { byGroup[g.id][f.key] = ''; });
    });

    // Nếu parsed đã có cấu trúc per-group → copy
    if (parsed && typeof parsed === 'object' && (parsed.overall || parsed.byGroup)) {
      // overall
      if (parsed.overall && typeof parsed.overall === 'object') {
        Object.entries(parsed.overall).forEach(([k, v]) => {
          if (overall.hasOwnProperty(k)) overall[k] = v;
        });
      }
      // byGroup
      if (parsed.byGroup && typeof parsed.byGroup === 'object') {
        Object.entries(parsed.byGroup).forEach(([gid, vals]) => {
          if (!byGroup[gid]) byGroup[gid] = {};
          schema.forEach(f => { byGroup[gid][f.key] = ''; });
          Object.entries(vals || {}).forEach(([k, v]) => {
            if (byGroup[gid].hasOwnProperty(k)) byGroup[gid][k] = v;
          });
        });
      }
    } else if (parsed && typeof parsed === 'object') {
      // parsed là flat cũ → đổ hết vào overall
      Object.entries(parsed).forEach(([k, v]) => {
        if (overall.hasOwnProperty(k)) overall[k] = v;
      });
    }
    return { overall, byGroup };
  }

  const cancelEdit = () => { setEditingId(null); setEditData({}); };

  const updateResultField = (key, value, groupId = null) => {
    setEditData(prev => {
      if (prev._isPerGroup) {
        if (groupId != null) {
          const newByGroup = { ...(prev.resultData?.byGroup || {}) };
          newByGroup[groupId] = { ...(newByGroup[groupId] || {}), [key]: value };
          return { ...prev, resultData: { ...prev.resultData, byGroup: newByGroup } };
        }
        // Group chưa chọn → ghi vào overall
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
        stageName: editData.stageName,
        stageOrder: parseInt(editData.stageOrder) || 1,
        stageType: editData.stageType,
        objective: editData.objective,
        startDate: editData.startDate || null,
        endDate: editData.endDate || null,
        resultSummary: editData.resultSummary || null,
        resultData: JSON.stringify(editData.resultData || {})
      };
      await onUpdate && onUpdate(stageId, payload);
      showToast && showToast('Đã lưu kết quả giai đoạn', 'success');
      cancelEdit();
    } catch (err) {
      showToast && showToast(err.message || 'Lỗi lưu', 'error');
    } finally {
      setSavingId(null);
    }
  };

  // Filter tasks/measurements theo stage
  const getStageTasks = (stageId) => tasks.filter(t => t.stageId === stageId || t.stage?.id === stageId);
  const getStageMeasurements = (stageId) => measurements.filter(m => m.stageId === stageId || m.stage?.id === stageId);

  // Parse resultData (string JSON → object)
  const parseResultData = (raw) => {
    if (!raw) return null;
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { return null; }
  };

  return (
    <div className="space-y-4">
      {/* Create form (compact) */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <h4 className="text-xs font-bold text-blue-700 mb-3">+ Thêm Giai Đoạn Mới</h4>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <input placeholder="Tên giai đoạn *" value={form.stageName} onChange={e => setForm({ ...form, stageName: e.target.value })}
            className="px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white" />
          <input type="number" placeholder="Thứ tự" value={form.stageOrder} onChange={e => setForm({ ...form, stageOrder: e.target.value })}
            className="px-3 py-2 border border-blue-200 rounded-lg text-sm bg-white" />
          <select value={form.stageType} onChange={e => setForm({ ...form, stageType: e.target.value })}
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

      {/* Stages List (accordion) */}
      {loading ? <p className="text-center text-sm text-on-surface-variant py-4">Đang tải...</p> :
        stages.length === 0 ? <p className="text-center text-sm text-on-surface-variant py-4">Chưa có giai đoạn nào.</p> :
        <div className="space-y-2">
          {stages.map(s => {
            const isExpanded = expandedId === s.id;
            const isEditing = editingId === s.id;
            const stageTypeMeta = getStageStyle(s.stageType);
            const parsedResult = s.resultData
              ? (typeof s.resultData === 'string' ? safeParseJSON(s.resultData, {}) : s.resultData)
              : {};
            const stageTasks = getStageTasks(s.id);
            const stageMeasurements = getStageMeasurements(s.id);
            // Schema cho form ResultData:
            //   - Nursery/Planting/Care/Evaluation/Harvest/...: schema hardcode (RESULT_DATA_SCHEMA).
            //   - Growing/Growth (Theo dõi sinh trưởng): schema ĐỘNG hoàn toàn từ MeasurementDefinition
            //     của experiment — mỗi metric → 1 field input. Researcher chủ động tạo metric ở tab
            //     Đo Lường → form báo cáo tự động sinh field tương ứng.
            //     Nếu chưa có metric nào → fallback schema hardcode + banner hướng dẫn.
            const baseSchema = getSchemaForStage(s.stageType);
            let schema = baseSchema;
            if (s.stageType === 'Growing' || s.stageType === 'Growth') {
              const dynamicSchema = buildGrowthResultSchema(s.stageType, measurements);
              schema = dynamicSchema.length > 0 ? dynamicSchema : baseSchema;
            }
            const grouped = groupFields(schema);

            // Tô nền theo color của stage type
            const colorBg = {
              amber: 'bg-amber-50 border-amber-200',
              emerald: 'bg-emerald-50 border-emerald-200',
              blue: 'bg-blue-50 border-blue-200',
              teal: 'bg-teal-50 border-teal-200',
              slate: 'bg-slate-50 border-slate-200'
            }[stageTypeMeta.color] || 'bg-slate-50 border-slate-200';

            const colorBadge = {
              amber: 'bg-amber-100 text-amber-800',
              emerald: 'bg-emerald-100 text-emerald-800',
              blue: 'bg-blue-100 text-blue-800',
              teal: 'bg-teal-100 text-teal-800',
              slate: 'bg-slate-100 text-slate-800'
            }[stageTypeMeta.color] || 'bg-slate-100 text-slate-800';

            return (
              <div key={s.id} className={`bg-white border-2 rounded-2xl overflow-hidden transition-all ${isExpanded ? 'border-blue-400 shadow-md' : 'border-outline-variant'}`}>
                {/* Header (clickable) */}
                <div className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => toggleExpand(s.id)}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base shrink-0 ${colorBadge}`}>
                    {stageTypeMeta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-on-surface truncate">{s.stageName || '—'}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider ${colorBadge}`}>
                        {stageTypeMeta.label.split('(')[0].trim()}
                      </span>
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">
                        #{s.stageOrder}
                      </span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">
                      📅 {s.startDate || '—'} → {s.endDate || '—'}
                      {stageTasks.length > 0 && <span className="ml-2">📋 {stageTasks.length} tác vụ</span>}
                      {stageMeasurements.length > 0 && <span className="ml-2">📊 {stageMeasurements.length} đo lường</span>}
                      {(['Nursery', 'Planting'].includes(s.stageType) && (() => {
                        // Chỉ hiển thị số cây cho stage Ươm cây hoặc Gieo trồng
                        const stageSchedules = schedules.filter(sc => sc.experimentStageId === s.id);
                        const batchIds = [...new Set(stageSchedules.map(sc => sc.batchId).filter(Boolean))];
                        if (batchIds.length === 0) return null;
                        let total = 0;
                        batchIds.forEach(bid => {
                          const reports = taskReportsByBatch[bid] || [];
                          const result = aggregatePlantCountFromReports(bid, reports);
                          if (result?.total) total += result.total;
                        });
                        return total > 0 ? <span className="ml-2">🌱 {total} cây đã trồng</span> : null;
                      })())}
                    </p>

                    {/* Kết quả giai đoạn (collapsed) — per-group summary */}
                    {(() => {
                      const rd = parseResultData(s.resultData);
                      if (!rd) return null;
                      if (rd.byGroup && typeof rd.byGroup === 'object') {
                        const groupIds = Object.keys(rd.byGroup);
                        if (groupIds.length === 0) return null;
                        // Lấy schema để biết field nào là số
                        const schemaFields = getSchemaForStage(s.stageType).filter(f => f.type === 'number');
                        const rows = groupIds.map(gid => {
                          const g = groups.find(x => x.id === gid) || { groupName: `Nhóm ${gid.slice(0, 6)}` };
                          const obj = rd.byGroup[gid] || {};
                          const filled = schemaFields.filter(f => {
                            const v = obj[f.key];
                            return v !== '' && v !== null && v !== undefined;
                          }).length;
                          const totalF = schemaFields.length;
                          return { gid, name: g.groupName, groupType: g.groupType, filled, totalF };
                        }).filter(r => r.filled > 0);
                        if (rows.length === 0) return null;
                        return (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-[9px] font-bold text-purple-700 uppercase">🧪 Kết quả:</span>
                            {rows.map(r => (
                              <span key={r.gid} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[9px] font-bold">
                                {r.name} <span className="text-purple-600 font-mono">{r.filled}/{r.totalF}</span>
                              </span>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-slate-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className={`border-t border-outline-variant ${colorBg} p-4 space-y-4 animate-fade-in`}>
                    {/* Read-only view */}
                    {!isEditing && (
                      <>
                        {/* Objective */}
                        {s.objective && (
                          <div className="bg-white/70 rounded-lg p-3 border border-white">
                            <p className="text-[10px] font-bold uppercase text-slate-600 mb-1">🎯 Mục tiêu</p>
                            <p className="text-xs text-slate-800">{s.objective}</p>
                          </div>
                        )}

                        {/* Tasks liên quan */}
                        <div className="bg-white/70 rounded-lg p-3 border border-white">
                          <p className="text-[10px] font-bold uppercase text-slate-600 mb-2 flex items-center gap-1.5">
                            📋 Tác vụ của giai đoạn
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px]">{stageTasks.length}</span>
                          </p>
                          {stageTasks.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic">Chưa có tác vụ nào được giao cho giai đoạn này.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {stageTasks.map(t => (
                                <div key={t.id} className="flex items-center gap-2 text-[11px] bg-white p-2 rounded-md">
                                  <span className={`w-1.5 h-1.5 rounded-full ${t.status === 'Completed' ? 'bg-emerald-500' : t.status === 'InProgress' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                  <span className="font-bold text-slate-800 flex-1 truncate">{t.taskName || t.title}</span>
                                  <span className="text-[9px] text-slate-500">{t.assignedUserName || 'Chưa giao'}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Measurements */}
                        <div className="bg-white/70 rounded-lg p-3 border border-white">
                          <p className="text-[10px] font-bold uppercase text-slate-600 mb-2 flex items-center gap-1.5">
                            📐 Các chỉ số đo lường
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px]">{stageMeasurements.length}</span>
                          </p>
                          {stageMeasurements.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic">Chưa có chỉ số đo lường nào cho giai đoạn này.</p>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {stageMeasurements.map(m => (
                                <div key={m.id} className="bg-white p-2 rounded-md border border-slate-100">
                                  <p className="text-[9px] font-bold text-slate-500 uppercase truncate">{m.measurementName || m.name}</p>
                                  <p className="text-sm font-mono font-bold text-slate-800 mt-0.5">
                                    {m.targetValue ?? m.value ?? '—'}
                                    <span className="text-[9px] text-slate-500 ml-1">{m.unit || ''}</span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Result Summary */}
                        {s.resultSummary && (
                          <div className="bg-emerald-50/70 rounded-lg p-3 border border-emerald-200">
                            <p className="text-[10px] font-bold uppercase text-emerald-700 mb-1">✅ Nhận xét kết quả</p>
                            <p className="text-xs text-emerald-900 whitespace-pre-line leading-relaxed">{s.resultSummary}</p>
                          </div>
                        )}

                        {/* Result Data (read-only) */}
                        {(() => {
                          if (!parsedResult || Object.keys(parsedResult).length === 0) return null;

                          // Per-group view
                          if (parsedResult.byGroup && typeof parsedResult.byGroup === 'object') {
                            const groupIds = Object.keys(parsedResult.byGroup);
                            const schemaFields = schema.filter(f => f.type === 'number');
                            const overall = parsedResult.overall || {};
                            const hasOverall = Object.entries(overall).some(([k, v]) =>
                              schemaFields.some(f => f.key === k) && v !== '' && v !== null && v !== undefined
                            );
                            return (
                              <div className="bg-blue-50/70 rounded-lg p-3 border border-blue-200 space-y-3">
                                <p className="text-[10px] font-bold uppercase text-blue-700">📊 Số liệu kết quả ({stageTypeMeta.label})</p>

                                {hasOverall && (
                                  <div className="bg-white rounded-md p-2 border border-blue-100">
                                    <p className="text-[9px] font-bold text-blue-700 uppercase mb-1.5">📐 Tổng hợp (overall)</p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                                      {schemaFields.filter(f => overall[f.key] !== undefined && overall[f.key] !== null && overall[f.key] !== '').map(f => (
                                        <div key={`ov-${f.key}`} className="bg-blue-50/50 p-1.5 rounded border border-blue-100">
                                          <p className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                            <span>{f.icon}</span>
                                            <span className="truncate">{f.label}</span>
                                          </p>
                                          <p className="text-sm font-mono font-bold text-blue-900 mt-0.5">
                                            {overall[f.key]}{f.unit && <span className="text-[9px] text-slate-500 ml-1">{f.unit}</span>}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {groupIds.length > 0 && (
                                  <div className="space-y-2">
                                    {groupIds.map(gid => {
                                      const g = groups.find(x => x.id === gid) || { groupName: `Nhóm ${gid.slice(0, 6)}` };
                                      const obj = parsedResult.byGroup[gid] || {};
                                      const filledFields = schemaFields.filter(f =>
                                        obj[f.key] !== undefined && obj[f.key] !== null && obj[f.key] !== ''
                                      );
                                      if (filledFields.length === 0) return null;
                                      return (
                                        <div key={gid} className="bg-white rounded-md p-2 border-2 border-purple-200">
                                          <p className="text-[10px] font-extrabold text-purple-700 uppercase mb-1.5 flex items-center gap-1.5">
                                            🧪 {g.groupName}
                                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-bold">{g.groupType || 'Group'}</span>
                                          </p>
                                          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                                            {filledFields.map(f => (
                                              <div key={`${gid}-${f.key}`} className="bg-purple-50/50 p-1.5 rounded border border-purple-100">
                                                <p className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                                  <span>{f.icon}</span>
                                                  <span className="truncate">{f.label}</span>
                                                </p>
                                                <p className="text-sm font-mono font-bold text-purple-900 mt-0.5">
                                                  {obj[f.key]}{f.unit && <span className="text-[9px] text-slate-500 ml-1">{f.unit}</span>}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          // Flat view
                          return (
                            <div className="bg-blue-50/70 rounded-lg p-3 border border-blue-200">
                              <p className="text-[10px] font-bold uppercase text-blue-700 mb-2">📊 Số liệu kết quả</p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {schema.filter(f => parsedResult[f.key] !== undefined && parsedResult[f.key] !== null && parsedResult[f.key] !== '').map(f => (
                                  <div key={f.key} className="bg-white p-2 rounded-md border border-blue-100">
                                    <p className="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-1">
                                      <span>{f.icon}</span>
                                      <span className="truncate">{f.label}</span>
                                    </p>
                                    <p className="text-sm font-mono font-bold text-blue-900 mt-0.5">
                                      {parsedResult[f.key]}
                                      {f.unit && <span className="text-[9px] text-slate-500 ml-1">{f.unit}</span>}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2 border-t border-white">
                          <button onClick={(e) => { e.stopPropagation(); startEdit(s); }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all">
                            <span>✏️</span> Nhập / Sửa kết quả
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
                            className="px-3 py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold">
                            ✕ Xóa
                          </button>
                        </div>
                      </>
                    )}

                    {/* Edit form */}
                    {isEditing && (
                      <div className="bg-white rounded-lg p-4 border-2 border-blue-300 space-y-4">
                        <div className="flex items-center justify-between -mt-1">
                          <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                            <span className="w-1.5 h-5 bg-blue-500 rounded" /> Chỉnh sửa giai đoạn & nhập kết quả
                          </h4>
                          <button onClick={cancelEdit} className="text-[10px] text-slate-500 hover:text-slate-700 font-bold">✕ Đóng</button>
                        </div>

                        {/* Thông tin cơ bản */}
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tên giai đoạn *</label>
                            <input value={editData.stageName}
                              onChange={e => setEditData({ ...editData, stageName: e.target.value })}
                              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none" />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Thứ tự</label>
                              <input type="number" value={editData.stageOrder}
                                onChange={e => setEditData({ ...editData, stageOrder: e.target.value })}
                                className="w-full mt-1 px-2.5 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Loại</label>
                              <select value={editData.stageType}
                                onChange={e => setEditData({ ...editData, stageType: e.target.value })}
                                className="w-full mt-1 px-2.5 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                                {STAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Bắt đầu</label>
                              <input type="date" value={editData.startDate}
                                onChange={e => setEditData({ ...editData, startDate: e.target.value })}
                                className="w-full mt-1 px-2.5 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Kết thúc</label>
                              <input type="date" value={editData.endDate}
                                onChange={e => setEditData({ ...editData, endDate: e.target.value })}
                                className="w-full mt-1 px-2.5 py-2 border border-slate-200 rounded-lg text-sm bg-white" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Mục tiêu</label>
                            <textarea value={editData.objective}
                              onChange={e => setEditData({ ...editData, objective: e.target.value })}
                              rows={2} className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white resize-none" />
                          </div>
                        </div>

                        {/* Thông tin số cây đã trồng - CHỈ CHO STAGE ƯƠM/GIEO) */}
                        {['Nursery', 'Planting'].includes(s.stageType) && (() => {
                          // Lấy các batch liên quan đến stage này qua schedules
                          const stageSchedules = schedules.filter(sc => sc.experimentStageId === s.id);
                          const relatedBatchIds = [...new Set(stageSchedules.map(sc => sc.batchId).filter(Boolean))];

                          if (relatedBatchIds.length === 0) {
                            return (
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <p className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                  🌱 <span>Chưa có lô nào liên quan đến giai đoạn này (chưa có lịch chăm sóc)</span>
                                </p>
                              </div>
                            );
                          }

                          // Tính toán summary cho các lô liên quan
                          let totalPlanted = 0;
                          const batchInfos = relatedBatchIds.map(bid => {
                            const batch = batches.find(b => b.id === bid);
                            if (!batch) return null;
                            const reports = taskReportsByBatch[bid] || [];
                            const result = aggregatePlantCountFromReports(bid, reports);
                            const planted = result?.total ?? 0;
                            totalPlanted += planted;
                            const group = groups.find(g => g.id === batch.groupId || g.id === batch.experimentalGroupId);
                            return { batchCode: batch.batchCode, groupName: group?.groupName || group?.name || null, planted };
                          }).filter(Boolean);

                          return (
                            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                              <p className="text-[10px] font-bold text-emerald-700 uppercase mb-2 flex items-center gap-1.5">
                                🌱 Số cây đã trồng thực tế (từ báo cáo tác vụ)
                              </p>
                              <div className="space-y-1.5">
                                {batchInfos.map((b, i) => (
                                  <div key={i} className="flex items-center gap-2 p-1.5 bg-white/70 rounded border border-emerald-100">
                                    <span className="font-bold text-emerald-800 text-[11px] min-w-[80px]">{b.batchCode}</span>
                                    {b.groupName && (
                                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-bold">
                                        {b.groupName}
                                      </span>
                                    )}
                                    <span className="flex-1" />
                                    <span className={`font-extrabold text-sm ${b.planted > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                      {b.planted > 0 ? `${b.planted} cây` : '—'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {totalPlanted > 0 && (
                                <div className="mt-2 pt-2 border-t border-emerald-200 flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-emerald-700">Tổng cộng</span>
                                  <span className="text-lg font-extrabold text-emerald-700">{totalPlanted} cây</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Form nhập số liệu (theo stageType) */}
                        <div className="border-t border-slate-200 pt-3">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              📊 Số liệu kết quả — <span className="text-blue-600">{stageTypeMeta.label}</span>
                            </h5>
                            <span className="text-[10px] text-slate-500">
                              {editData._isPerGroup ? `${groups.length} nhóm × ${schema.length} chỉ số` : `${Object.keys(grouped).length} nhóm · ${schema.length} chỉ số`}
                            </span>
                          </div>

                          {/* Banner: form động cho stage Theo dõi sinh trưởng */}
                          {(s.stageType === 'Growing' || s.stageType === 'Growth') && (() => {
                            // Đếm metric từ 2 nguồn, lấy max:
                            //   1. schema động (buildGrowthResultSchema khi chạy) - có thể thiếu nếu groupId filter
                            //   2. measurements gốc - tổng số MeasurementDefinition của experiment
                            const dynamicFields = schema.filter(f => f.group === 'Sinh trưởng (động)');
                            const dynamicFromRaw = (measurements || []).length;
                            // Gom unique theo (label + unit) → tránh đếm trùng khi 2 nhóm có cùng metric
                            const uniqKeys = new Set();
                            const uniqFields = [];
                            for (const f of dynamicFields) {
                              const k = `${(f.label || '').toLowerCase()}|${(f.unit || '').toLowerCase()}`;
                              if (uniqKeys.has(k)) continue;
                              uniqKeys.add(k);
                              uniqFields.push(f);
                            }
                            // Nếu schema có dynamicFields rỗng nhưng measurements có data → fallback hiển thị
                            const dynamicCount = uniqFields.length > 0
                              ? uniqFields.length
                              : dynamicFromRaw;
                            return (
                              <div className={`mb-3 px-3 py-2 rounded-r-lg text-[10px] flex items-start gap-2 border-l-4 ${dynamicCount > 0 ? 'bg-teal-50 border-teal-500 text-teal-800' : 'bg-amber-50 border-amber-500 text-amber-800'}`}>
                                <span className="text-base shrink-0">{dynamicCount > 0 ? '📊' : '⚠️'}</span>
                                <div className="flex-1">
                                  {dynamicCount > 0 ? (
                                    <>
                                      <strong className="font-extrabold">Form động từ MeasurementDefinition:</strong> Đã fetch <strong>{dynamicCount}</strong> chỉ số sinh trưởng (đã gom trùng theo tên + đơn vị) từ API:
                                      <span className="ml-1">{uniqFields.map(f => `${f.label}${f.unit ? ` (${f.unit})` : ''}`).join(', ')}</span>.
                                      <div className="mt-1">Mỗi nhóm chỉ thấy chỉ số của nhóm mình. Báo cáo được tách riêng theo từng nhóm bên dưới.</div>
                                      {dynamicFields.length === 0 && dynamicFromRaw > 0 && (
                                        <div className="mt-1 text-amber-700">
                                          (debug: schema={dynamicFields.length} nhưng measurements={dynamicFromRaw} — schema rỗng do measurements thiếu group/groupId)
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <strong className="font-extrabold">Chưa có chỉ số đo lường nào:</strong> giai đoạn <em>{s.stageName}</em> hiện chưa có <em>MeasurementDefinition</em> nào.
                                      Vào tab <em>Đo Lường</em> → bấm <code>+ Tạo Đo Lường</code> để thêm chỉ số sinh trưởng → form báo cáo sẽ tự động cập nhật.
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Bảng tham khảo: Lịch chăm sóc + Báo cáo thực tế (chỉ cho stage Care) */}
                          {editData._isPerGroup && s.stageType === 'Care' && (() => {
                            const ref = computeResultsFromSchedulesAndReports({
                              stageId: s.id, groups, batches, schedules, taskReportsByBatch
                            });
                            const batchIds = Object.keys(ref.byBatch);
                            if (batchIds.length === 0) return null;
                            // Chỉ hiển thị các field có thể đếm được từ Schedules/Reports (soLanTuoi, soLanBonPhan, soLanPhunThuoc)
                            // Bỏ field text như ghiChu, loaiPhanBon và field đo lường như luongNuocTong (cần đo thực tế)
                            const COUNTABLE_FIELD_KEYS = new Set(['soLanTuoi', 'soLanBonPhan', 'soLanPhunThuoc']);
                            const careFields = schema.filter(f => f.type === 'number' && COUNTABLE_FIELD_KEYS.has(f.key));
                            return (
                              <div className="mb-4 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg p-3 border-2 border-cyan-300">
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                  <p className="text-[11px] font-extrabold text-cyan-800 uppercase tracking-wider flex items-center gap-1.5">
                                    🔍 Bảng tham khảo — Số liệu THỰC TẾ vs KẾ HOẠCH (theo từng batch → nhóm)
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Fill form từ ref — CHỈ điền số liệu THỰC TẾ (actual), không phải kế hoạch
                                      setEditData(prev => {
                                        const newOverall = { ...(prev.resultData?.overall || {}) };
                                        const newByGroup = { ...(prev.resultData?.byGroup || {}) };
                                        // Overall: lấy actual (số liệu thực tế)
                                        Object.entries(ref.overall).forEach(([k, v]) => {
                                          const actual = (typeof v === 'object' && v !== null) ? v.actual : v;
                                          if (newOverall[k] === '' || newOverall[k] == null) newOverall[k] = actual;
                                        });
                                        // Per-group: lấy actual
                                        Object.entries(ref.perGroup).forEach(([gid, vals]) => {
                                          if (!newByGroup[gid]) newByGroup[gid] = {};
                                          Object.entries(vals).forEach(([fk, v]) => {
                                            if (fk === '_meta') return;
                                            const actual = (typeof v === 'object' && v !== null) ? v.actual : v;
                                            if (newByGroup[gid][fk] === '' || newByGroup[gid][fk] == null) newByGroup[gid][fk] = actual;
                                          });
                                        });
                                        return { ...prev, resultData: { overall: newOverall, byGroup: newByGroup } };
                                      });
                                      showToast && showToast('Đã điền số liệu THỰC TẾ từ task reports đã duyệt vào các ô trống. Vui lòng kiểm tra lại trước khi lưu.', 'success');
                                    }}
                                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all"
                                    title="Điền số liệu THỰC TẾ (TT) từ task reports đã duyệt vào các ô trống. KHÔNG điền kế hoạch (KH)."
                                  >
                                    ⬇️ Điền thực tế vào form (chỉ ô trống)
                                  </button>
                                </div>

                                <p className="text-[9px] text-cyan-700 italic mb-2">
                                  💡 <strong>KH</strong> (kế hoạch) = tổng số lần dự kiến theo lịch (tính bằng <code>floor((endDate - startDate) / frequencyDays) + 1</code>).
                                  <strong>TT</strong> (thực tế) = số task report <em>đã duyệt</em> của batch.
                                  <strong className="text-emerald-700">Nút "Điền vào form" chỉ điền số THỰC TẾ</strong> — researcher review rồi tự chỉnh thêm nếu cần.
                                </p>

                                <div className="overflow-x-auto bg-white rounded-lg border border-cyan-200">
                                  <table className="w-full text-[10px]">
                                    <thead>
                                      <tr className="bg-cyan-100 text-cyan-900">
                                        <th className="px-2 py-2 text-left">Nhóm</th>
                                        {careFields.map(f => (
                                          <th key={f.key} className="px-2 py-2 text-center border-l border-cyan-200" colSpan={2} title={`KH = tổng lần dự kiến theo lịch (startDate→endDate, frequencyDays). TT = số task report đã duyệt.`}>
                                            <div className="flex items-center justify-center gap-1">{f.icon}<span>{f.label}</span></div>
                                            <div className="text-[8px] font-normal text-cyan-700">(KH / TT)</div>
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {/* Chỉ hiển thị hàng tổng theo nhóm (gom các batch trong nhóm) */}
                                      {groups.map(g => {
                                        const perG = ref.perGroup[g.id] || {};
                                        const metaG = perG._meta || {};
                                        return (
                                          <tr key={`g-${g.id}`} className="border-t border-cyan-100 hover:bg-cyan-50/50">
                                            <td className="px-2 py-1.5 font-bold text-purple-900">
                                              <span>🧪 {g.groupName || '—'}</span>
                                              <span className="px-1 py-0.5 ml-1 bg-purple-100 text-purple-700 rounded text-[8px] font-bold">{g.groupType || 'Group'}</span>
                                            </td>
                                            {careFields.map(f => {
                                              const m = metaG[f.key] || {};
                                              return (
                                                <td key={`g-${g.id}-${f.key}-kh`} className="px-2 py-1.5 text-center font-mono font-extrabold border-l border-cyan-100 text-blue-700" title="KH = tổng số lần dự kiến theo lịch (gom các batch trong nhóm)">
                                                  {m.planned || 0}
                                                </td>
                                              );
                                            }).concat(careFields.map(f => {
                                              const m = metaG[f.key] || {};
                                              return (
                                                <td key={`g-${g.id}-${f.key}-tt`} className="px-2 py-1.5 text-center font-mono font-extrabold text-emerald-700" title="TT = số task report đã duyệt (Approved/Completed/Done) của các batch trong nhóm">
                                                  {m.actual || 0}
                                                </td>
                                              );
                                            }))}
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })()}

                          {/* PER-GROUP MODE: 1 bảng per group (bỏ OVERALL cho Growing/Growth) */}
                          {editData._isPerGroup && groups.length > 0 ? (
                            <div className="space-y-4">
                              {/* OVERALL section - chỉ hiển thị cho stage KHÔNG phải Growing/Growth */}
                              {(s.stageType !== 'Growing' && s.stageType !== 'Growth') && (
                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                                <p className="text-[10px] font-extrabold text-blue-700 uppercase mb-2 tracking-wider flex items-center gap-1.5">
                                  Tổng hợp (overall) — trung bình các nhóm
                                </p>
                                {/* Với Growing/Growth: overall GOM các metric có cùng label + unit từ tất cả nhóm
                                    thành 1 dòng duy nhất, hiển thị trung bình các nhóm. */}
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                  {(() => {
                                    const isGrowth = s.stageType === 'Growing' || s.stageType === 'Growth';
                                    if (!isGrowth) {
                                      // Stage thường: render schema như cũ
                                      return schema.map(field => {
                                        const v = editData.resultData?.overall?.[field.key];
                                        const hasValue = v !== undefined && v !== null && v !== '';
                                        const evalResult = field.type === 'number' && hasValue
                                          ? evaluateAgainstTarget(v, field.key)
                                          : null;
                                        return (
                                          <div key={`ov-${field.key}`} className={`rounded-md p-2 border ${
                                            evalResult?.status === 'met' ? 'bg-emerald-50 border-emerald-200'
                                            : hasValue ? 'bg-white border-blue-100' : 'bg-slate-50 border-slate-200'
                                          }`}>
                                            <p className="text-[9px] font-bold text-slate-500 uppercase truncate flex items-center gap-1">
                                              <span>{field.icon}</span><span className="truncate">{field.label}</span>
                                            </p>
                                            <p className="text-sm font-mono font-bold text-slate-800">
                                              {hasValue ? v : '—'} {field.unit && <span className="text-[9px] text-slate-500 ml-1">{field.unit}</span>}
                                            </p>
                                            {evalResult && evalResult.status !== 'no_target' && (
                                              <p className={`text-[9px] mt-0.5 font-bold text-${evalResult.color}-700`}>
                                                {evalResult.icon} {evalResult.percent}% target
                                              </p>
                                            )}
                                          </div>
                                        );
                                      });
                                    }

                                    // Growing/Growth: gom metric theo (label + unit)
                                    //   key gom = label.toLowerCase + '|' + unit
                                    const grouped = new Map();
                                    for (const f of schema) {
                                      if (f.key === 'ghiChu') continue;
                                      const gKey = `${(f.label || '').toLowerCase().trim()}|${(f.unit || '').toLowerCase().trim()}`;
                                      if (!grouped.has(gKey)) {
                                        grouped.set(gKey, { label: f.label, unit: f.unit, icon: f.icon, targetValue: f.targetValue, fieldKeys: [] });
                                      }
                                      grouped.get(gKey).fieldKeys.push(f.key);
                                    }

                                    return Array.from(grouped.values()).map(g => {
                                      // Tính overall: ưu tiên giá trị overall trực tiếp, fallback trung bình byGroup
                                      let v = editData.resultData?.overall?.[g.fieldKeys[0]];
                                      let hasValue = v !== undefined && v !== null && v !== '';
                                      if (!hasValue && editData.resultData?.byGroup) {
                                        const vals = g.fieldKeys.map(k =>
                                          Object.values(editData.resultData.byGroup)
                                            .map(bg => bg?.[k])
                                            .filter(x => x !== undefined && x !== null && x !== '')
                                            .map(Number)
                                            .filter(n => !isNaN(n))
                                        ).flat();
                                        if (vals.length > 0) {
                                          v = vals.reduce((s, x) => s + x, 0) / vals.length;
                                          v = Math.round(v * 100) / 100;
                                          hasValue = true;
                                        }
                                      }
                                      const evalResult = g.targetValue != null && hasValue
                                        ? (() => {
                                            const target = parseFloat(g.targetValue);
                                            const val = parseFloat(v);
                                            if (isNaN(target) || isNaN(val)) return null;
                                            const pct = Math.round((val / target) * 100);
                                            let status = 'met', color = 'emerald', icon = '✅', label = 'Đạt';
                                            if (pct < 70) { status = 'below'; color = 'rose'; icon = '⚠️'; label = 'Dưới'; }
                                            else if (pct < 90) { status = 'close'; color = 'amber'; icon = '🔸'; label = 'Gần'; }
                                            return { status, color, icon, label, percent: pct };
                                          })()
                                        : null;
                                      return (
                                        <div key={`ov-grp-${g.label}-${g.unit}`} className={`rounded-md p-2 border ${
                                          evalResult?.status === 'met' ? 'bg-emerald-50 border-emerald-200'
                                          : hasValue ? 'bg-white border-blue-100' : 'bg-slate-50 border-slate-200'
                                        }`}>
                                          <p className="text-[9px] font-bold text-slate-500 uppercase truncate flex items-center gap-1">
                                            <span>{g.icon}</span><span className="truncate">{g.label}</span>
                                          </p>
                                          <p className="text-sm font-mono font-bold text-slate-800">
                                            {hasValue ? v : '—'} {g.unit && <span className="text-[9px] text-slate-500 ml-1">{g.unit}</span>}
                                          </p>
                                          {evalResult && (
                                            <p className={`text-[9px] mt-0.5 font-bold text-${evalResult.color}-700`}>
                                              {evalResult.icon} {evalResult.percent}% target
                                            </p>
                                          )}
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                                <p className="text-[9px] text-blue-600 italic mt-2">💡 Overall chỉ hiển thị chỉ số chung. Chỉ số riêng của từng nhóm xem bên dưới.</p>
                              </div>
                              )}

                              {/* Placeholder cho Growing/Growth: không có OVERALL vì mỗi nhóm có metric riêng */}
                              {(s.stageType === 'Growing' || s.stageType === 'Growth') && (
                                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-3 border border-cyan-200">
                                  <p className="text-[10px] font-extrabold text-cyan-700 uppercase mb-1 tracking-wider flex items-center gap-1.5">
                                    Báo cáo riêng từng nhóm
                                  </p>
                                  <p className="text-[9px] text-cyan-600 italic">
                                    💡 Giai đoạn <em>Theo dõi sinh trưởng</em> không có tổng hợp chung vì mỗi nhóm có chỉ số riêng (tùy theo MeasurementDefinition gán cho nhóm đó). Vui lòng nhập số liệu cho từng nhóm bên dưới.
                                  </p>
                                </div>
                              )}

                              {/* PER-GROUP sections */}
                              {(() => {
                                // Với Growing/Growth: mỗi nhóm có schema riêng từ MeasurementDefinition của nhóm đó.
                                // Với stage khác: tất cả nhóm dùng chung schema hardcode.
                                const isGrowthStage = s.stageType === 'Growing' || s.stageType === 'Growth';
                                return groups.map(g => {
                                const groupData = editData.resultData?.byGroup?.[g.id] || {};
                                // Schema riêng cho group
                                let groupSchema = schema;
                                if (isGrowthStage) {
                                  const dynamicSchema = buildGrowthResultSchema(s.stageType, measurements, g.id);
                                  groupSchema = dynamicSchema.length > 0 ? dynamicSchema : schema;
                                }
                                const groupFieldCount = groupSchema.filter(f => f.group === 'Sinh trưởng (động)').length;
                                return (
                                  <div key={g.id} className="bg-white rounded-lg p-3 border-2 border-purple-200">
                                    <p className="text-[11px] font-extrabold text-purple-700 uppercase mb-2 tracking-wider flex items-center gap-1.5">
                                      🧪 Nhóm: <span className="text-purple-900">{g.groupName || g.name}</span>
                                      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-bold">{g.groupType || 'Group'}</span>
                                      {isGrowthStage && (
                                        <span className="px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded text-[9px] font-bold">
                                          📊 {groupFieldCount} chỉ số của nhóm
                                        </span>
                                      )}
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                      {groupSchema.map(field => {
                                        const currentVal = groupData[field.key];
                                        const hasValue = currentVal !== undefined && currentVal !== null && currentVal !== '';
                                        const evalResult = field.type === 'number' && hasValue
                                          ? evaluateAgainstTarget(currentVal, field.key)
                                          : null;
                                        return (
                                          <div key={`${g.id}-${field.key}`} className={`relative rounded-lg p-2.5 border transition-all ${
                                            evalResult?.status === 'met' ? 'bg-emerald-50/50 border-emerald-200'
                                            : evalResult?.status === 'close' ? 'bg-amber-50/50 border-amber-200'
                                            : evalResult?.status === 'below' || evalResult?.status === 'above' ? 'bg-rose-50/50 border-rose-200'
                                            : hasValue ? 'bg-blue-50/50 border-blue-200'
                                            : 'bg-slate-50 border-slate-200'
                                          }`}>
                                            <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5 mb-1">
                                              <span>{field.icon}</span>
                                              <span className="truncate">{field.label}</span>
                                              {evalResult && evalResult.status !== 'no_target' && evalResult.status !== 'no_value' && (
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold bg-${evalResult.color}-100 text-${evalResult.color}-700`}
                                                  title={`${evalResult.label} (${evalResult.percent}% target)`}>
                                                  {evalResult.icon} {evalResult.percent}%
                                                </span>
                                              )}
                                            </label>
                                            {field.type === 'select' ? (
                                              <select value={currentVal || ''}
                                                onChange={e => updateResultField(field.key, e.target.value, g.id)}
                                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none">
                                                <option value="">-- Chọn --</option>
                                                {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                              </select>
                                            ) : field.type === 'text' ? (
                                              <input type="text" value={currentVal || ''}
                                                onChange={e => updateResultField(field.key, e.target.value, g.id)}
                                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none" />
                                            ) : (
                                              <div className="flex items-center gap-1.5">
                                                <input type="number" value={currentVal ?? ''}
                                                  min={field.min} max={field.max} step={field.step}
                                                  onChange={e => updateResultField(field.key, e.target.value === '' ? null : Number(e.target.value), g.id)}
                                                  className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none font-mono font-bold" />
                                                {field.unit && (
                                                  <span className="text-[10px] text-slate-500 font-bold bg-white px-2 py-1.5 rounded-md border border-slate-200 shrink-0">{field.unit}</span>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              });
                              })()}
                            </div>
                          ) : (
                          /* FLAT MODE (cũ) */
                          <div>
                          {Object.entries(grouped).map(([groupName, fields]) => (
                            <div key={groupName} className="mb-3 last:mb-0">
                              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-wider">{groupName}</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {fields.map(field => {
                                  const currentVal = editData.resultData?.[field.key];
                                  const hasValue = currentVal !== undefined && currentVal !== null && currentVal !== '';
                                  // Auto-fill info (nếu field này đã được auto-fill khi mở edit)
                                  const autoInfo = editData._autoFilled?.[field.key];
                                  // Target evaluation (chỉ cho field số)
                                  const isNumeric = field.type === 'number';
                                  const evalResult = isNumeric && hasValue
                                    ? evaluateAgainstTarget(currentVal, field.key)
                                    : null;
                                  return (
                                    <div key={field.key} className={`relative rounded-lg p-2.5 border transition-all ${
                                      evalResult?.status === 'met' ? 'bg-emerald-50/50 border-emerald-200'
                                      : evalResult?.status === 'close' ? 'bg-amber-50/50 border-amber-200'
                                      : evalResult?.status === 'below' || evalResult?.status === 'above' ? 'bg-rose-50/50 border-rose-200'
                                      : hasValue ? 'bg-blue-50/50 border-blue-200'
                                      : 'bg-slate-50 border-slate-200'
                                    }`}>
                                      <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5 mb-1">
                                        <span>{field.icon}</span>
                                        <span>{field.label}</span>
                                        {field.autoFrom && (
                                          <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[8px] font-bold" title={`Có thể tự tính từ ${field.autoFrom}`}>AUTO</span>
                                        )}
                                        {autoInfo && (
                                          <span
                                            className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-[8px] font-bold cursor-help"
                                            title={`✨ Tự động từ ${autoInfo.count} mẫu đo (metric: ${autoInfo.source}). Bạn có thể sửa lại.`}
                                          >
                                            ✨ {autoInfo.count} mẫu
                                          </span>
                                        )}
                                        {evalResult && evalResult.status !== 'no_target' && evalResult.status !== 'no_value' && (
                                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold bg-${evalResult.color}-100 text-${evalResult.color}-700`}
                                            title={`${evalResult.label} (${evalResult.percent}% target${evalResult.delta != null ? `, Δ=${evalResult.delta}` : ''})`}>
                                            {evalResult.icon} {evalResult.label} · {evalResult.percent}%
                                          </span>
                                        )}
                                      </label>
                                      {field.type === 'select' ? (
                                        <select value={currentVal || ''}
                                          onChange={e => updateResultField(field.key, e.target.value)}
                                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none">
                                          <option value="">-- Chọn --</option>
                                          {field.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                      ) : field.type === 'text' ? (
                                        <input type="text" value={currentVal || ''}
                                          onChange={e => updateResultField(field.key, e.target.value)}
                                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none" />
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                          <input type="number" value={currentVal ?? ''}
                                            min={field.min} max={field.max} step={field.step}
                                            onChange={e => updateResultField(field.key, e.target.value === '' ? null : Number(e.target.value))}
                                            className="flex-1 px-2.5 py-1.5 border border-slate-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none font-mono font-bold" />
                                          {field.unit && (
                                            <span className="text-[10px] text-slate-500 font-bold bg-white px-2 py-1.5 rounded-md border border-slate-200 shrink-0">{field.unit}</span>
                                          )}
                                        </div>
                                      )}
                                      {field.hint && (
                                        <p className="text-[9px] text-slate-500 mt-1 italic">{field.hint}</p>
                                      )}
                                      {autoInfo && (
                                        <p className="text-[9px] text-purple-700 mt-1 italic">
                                          💡 Tính từ <strong>{autoInfo.source}</strong> ({autoInfo.count} mẫu đo). Có thể sửa lại.
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                          </div>
                          )}
                        </div>

                        {/* Mini comparison table các nhóm */}
                        {(() => {
                          const stageRecs = measurementRecords.filter(r =>
                            r.stageId === s.id || r.experimentStageId === s.id || r.stage?.id === s.id
                          );
                          const comparison = buildMiniComparison({
                            stageId: s.id,
                            groups,
                            batches,
                            records: stageRecs,
                            definitions: measurements,
                            fieldKeys: ['chieuCaoCm', 'tiLeSong', 'tiLeDauQua', 'sanLuongKg', 'soLaTrungBinh']
                          });
                          if (comparison.length === 0) return null;
                          return (
                            <div className="border-t border-slate-200 pt-3">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                  🏆 So sánh giữa các nhóm
                                </h5>
                                <span className="text-[10px] text-slate-500">{comparison.length} chỉ số · {comparison[0].rows.length} nhóm</span>
                              </div>
                              <div className="space-y-2">
                                {comparison.map(cmp => (
                                  <div key={cmp.fieldKey} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                    <div className="bg-slate-50 px-2.5 py-1.5 border-b border-slate-200 flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-slate-700">📏 {cmp.label}</span>
                                      <span className="text-[9px] text-slate-500">
                                        {(() => {
                                          const meta = getFieldMeta(cmp.fieldKey);
                                          return meta.target ? `Target: ${meta.target}${cmp.unit || meta.unit || ''}` : '';
                                        })()}
                                      </span>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                      {cmp.rows.map((row, idx) => (
                                        <div key={row.groupId} className={`flex items-center gap-2 px-2.5 py-1.5 text-[11px] ${row.isBest ? 'bg-emerald-50/40' : ''}`}>
                                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${row.isBest ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                            {idx + 1}
                                          </span>
                                          <span className="flex-1 truncate font-semibold text-slate-800">
                                            {row.groupName}
                                            {row.isBest && <span className="ml-1.5 text-emerald-600">🏆</span>}
                                          </span>
                                          <span className="font-mono font-bold text-slate-900">
                                            {row.value}{cmp.unit}
                                          </span>
                                          {row.status && row.status.status !== 'no_target' && row.status.status !== 'no_value' && (
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold bg-${row.status.color}-100 text-${row.status.color}-700 shrink-0`}
                                              title={`${row.status.label} · ${row.status.percent}% target`}>
                                              {row.status.icon} {row.status.percent}%
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Summary */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">📝 Nhận xét & Kết luận</label>
                          </div>
                          <textarea value={editData.resultSummary}
                            onChange={e => setEditData({ ...editData, resultSummary: e.target.value })}
                            rows={5}
                            placeholder="Nhập nhận xét, phân tích và kết luận của bạn về kết quả giai đoạn..."
                            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-amber-50/30 focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none resize-none font-mono text-[11px]" />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                          <button onClick={cancelEdit}
                            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50">
                            Hủy
                          </button>
                          <button onClick={() => saveEdit(s.id)} disabled={savingId === s.id}
                            className="inline-flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50">
                            {savingId === s.id ? '⏳ Đang lưu...' : (<><span>💾</span> Lưu kết quả</>)}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      }
    </div>
  );
};

// Helper parse JSON an toàn
function safeParseJSON(s, fallback = null) {
  try { return typeof s === 'string' ? JSON.parse(s) : s; }
  catch { return fallback; }
}

// ── Groups Tab ─────────────────────────────────────────────────────────────────

const GroupsTab = ({ groups = [], form, setForm, onCreate, onDelete, loading }) => (
  <div className="space-y-4">

    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
      <h4 className="text-xs font-bold text-emerald-700 mb-3">+ Thêm Nhóm Mới (Thủ Công)</h4>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input placeholder="Tên nhóm *" value={form.groupName} onChange={e => setForm({ ...form, groupName: e.target.value })}
          className="px-3 py-2 border border-emerald-200 rounded-lg text-sm bg-white" />
        <select value={form.groupType} onChange={e => setForm({ ...form, groupType: e.target.value })}
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
            <select value={form.designType} onChange={e => setForm({ ...form, designType: e.target.value })}
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
      </div>
    </div>
  );
};

// ── Measurements Tab ─────────────────────────────────────────────────────────────

const MeasurementsTab = ({ measurements = [], groups = [], form, setForm, onCreate, onDelete, loading, experimentId, stages = [] }) => (
  <div className="space-y-4">
    {/* CRUD MeasurementDefinition (giữ lại để tạo các metric mới) */}
    <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
      <h4 className="text-xs font-bold text-teal-700 mb-3">+ Thêm Chỉ Số Đo Lường (MeasurementDefinition)</h4>
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

    {/* Dashboard thống kê tổng hợp theo stage / experiment */}
    <div className="border-t-2 border-dashed border-slate-200 pt-5 mt-2">
      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
        📈 Thống kê & Phân tích
        <span className="text-[10px] text-slate-500 font-normal">— AVG, MIN, MAX, STDDEV, Median, Q1, Q3, so sánh nhóm, xuất CSV/Excel</span>
      </h3>
      <StatisticsDashboard experimentId={experimentId} stages={stages || []} />
    </div>
  </div>
);

// ── Schedules Tab ───────────────────────────────────────────────────────────────

const SchedulesTab = ({ schedules = [], stages = [], batches = [], form, setForm, onCreate, onDelete, loading }) => {
  // Auto-fill startDate/endDate khi chọn giai đoạn (nếu giai đoạn có thông tin)
  const handleStageChange = (stageId) => {
    const selected = stages.find(s => s.id === stageId);
    if (!selected) {
      setForm({ ...form, experimentStageId: stageId });
      return;
    }
    const updates = { ...form, experimentStageId: stageId };
    // Chỉ auto-fill khi field chưa có giá trị (tránh ghi đè dữ liệu user đã nhập)
    if (!form.startDate && selected.startDate) {
      updates.startDate = selected.startDate.split('T')[0];
    }
    if (!form.endDate && selected.endDate) {
      updates.endDate = selected.endDate.split('T')[0];
    }
    setForm(updates);
  };

  return (
  <div className="space-y-4">
    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
      <h4 className="text-xs font-bold text-amber-700 mb-3">+ Thêm Lịch Chăm Sóc</h4>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Giai Đoạn</label>
          <select value={form.experimentStageId} onChange={e => handleStageChange(e.target.value)}
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white">
            <option value="">— Chọn giai đoạn —</option>
            {stages.map(s => {
              const range = (s.startDate || s.endDate)
                ? ` (${(s.startDate || '?').split('T')[0]} → ${(s.endDate || '?').split('T')[0]})`
                : '';
              return <option key={s.id} value={s.id}>{s.stageName}{range}</option>;
            })}
          </select>
          {form.experimentStageId && (() => {
            const sel = stages.find(s => s.id === form.experimentStageId);
            if (!sel?.startDate && !sel?.endDate) return null;
            return (
              <p className="text-[10px] text-amber-700 mt-1 italic">
                💡 Giai đoạn: <span className="font-mono">{(sel.startDate || '—').split('T')[0]}</span> → <span className="font-mono">{(sel.endDate || '—').split('T')[0]}</span>
              </p>
            );
          })()}
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Lô áp dụng</label>
          <select value={form.batchId} onChange={e => setForm({ ...form, batchId: e.target.value })}
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white">
            <option value="">— Tất cả lô (áp dụng chung) —</option>
            {batches.map(b => {
              const grp = (b.groupName || b.group?.groupName) ? ` · ${b.groupName || b.group?.groupName}` : '';
              const count = b.plantCount ? ` · ${b.plantCount} cây` : '';
              return <option key={b.id} value={b.id}>{b.batchCode}{grp}{count}</option>;
            })}
          </select>
          {form.batchId && (() => {
            const b = batches.find(x => x.id === form.batchId);
            if (!b) return null;
            return (
              <p className="text-[10px] text-amber-700 mt-1 italic">
                🌱 Lô <strong>{b.batchCode}</strong>
                {(b.groupName || b.group?.groupName) && <> · Nhóm <strong>{b.groupName || b.group?.groupName}</strong></>}
                {b.plantCount != null && <> · {b.plantCount} cây</>}
                {b.plantingDate && <> · Trồng <span className="font-mono">{(b.plantingDate || '').split('T')[0]}</span></>}
              </p>
            );
          })()}
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Loại Tác Vụ</label>
          <select value={form.taskType} onChange={e => setForm({ ...form, taskType: e.target.value })}
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
          <input type="date" value={form.startDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={e => setForm({ ...form, startDate: e.target.value })}
            className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Ngày Kết Thúc</label>
          <input type="date" value={form.endDate}
            min={form.startDate || new Date().toISOString().split('T')[0]}
            onChange={e => setForm({ ...form, endDate: e.target.value })}
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
        {schedules.map(sc => {
          const batch = batches.find(b => b.id === sc.batchId);
          const stage = stages.find(s => s.id === sc.experimentStageId);
          return (
            <div key={sc.id} className="flex items-center gap-3 p-3 bg-white border border-outline-variant rounded-xl hover:border-amber-300 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="text-sm font-semibold text-on-surface truncate">{sc.title || '—'}</span>
                  {stage && (
                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold uppercase">
                      📅 {stage.stageName}
                    </span>
                  )}
                  {batch ? (
                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">
                      🌱 {batch.batchCode}
                      {batch.groupName && <> · {batch.groupName}</>}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold">
                      🌐 Mọi lô
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-on-surface-variant">
                  {sc.frequencyDays ? `${sc.frequencyDays} ngày/lần · ` : ''}
                  📍 {sc.startDate || '—'} → {sc.endDate || '—'}
                  {batch?.plantingDate && <> · Trồng {(batch.plantingDate || '').split('T')[0]}</>}
                </p>
                {sc.instruction && <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">{sc.instruction}</p>}
              </div>
              <button onClick={() => onDelete(sc.id)} className="text-rose-400 hover:text-rose-600 text-xs font-bold shrink-0">✕ Xóa</button>
            </div>
          );
        })}
      </div>
    }
  </div>
  );
};

// ── Batches Tab ───────────────────────────────────────────────────────────────

const BatchesTab = ({ batches = [], bedAssignments = [], groups = [], form, setForm, onCreate, onDelete, onEdit, onRandomizeBeds, loading, taskReportsByBatch = {} }) => {
  // Helper render cell "Số cây thực tế" (tính từ các TaskReport Planting của batch)
  const renderActualCountCell = (batch) => {
    const reports = taskReportsByBatch[batch.id] || [];
    const actual = aggregatePlantCountFromReports(batch.id, reports);
    const cmp = comparePlannedVsActual(batch.plantCount, actual);
    if (cmp.status === 'empty') {
      return (
        <span className="text-[10px] text-slate-400 italic" title="Chưa có báo cáo Planting nào">
          —
        </span>
      );
    }
    if (cmp.status === 'no_plan') {
      return (
        <span className="text-[10px] text-amber-700 font-semibold" title="Có báo cáo trồng nhưng batch chưa ghi kế hoạch">
          ⚠ {cmp.actual} cây
        </span>
      );
    }
    const statusBadge = {
      match: { color: 'bg-emerald-100 text-emerald-700', icon: '✅', label: 'khớp' },
      less: { color: 'bg-amber-100 text-amber-800', icon: '⚠️', label: `thiếu ${Math.abs(cmp.diff)}` },
      over: { color: 'bg-blue-100 text-blue-700', icon: 'ℹ️', label: `dư +${cmp.diff}` }
    }[cmp.status];
    const tooltip = `Kế hoạch: ${cmp.planned} · Thực tế: ${cmp.actual} (${actual.reportCount} báo cáo Planting)`;
    return (
      <div className="flex flex-col gap-0.5">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${statusBadge.color}`} title={tooltip}>
          <span>{statusBadge.icon}</span> {cmp.actual} <span className="opacity-70 font-normal">{statusBadge.label}</span>
        </span>
        {actual.reportCount > 1 && (
          <span className="text-[9px] text-slate-500 italic">{actual.reportCount} lần trồng</span>
        )}
      </div>
    );
  };

  return (
  <div className="space-y-4">
    {/* Info banner if no beds assigned */}
    {bedAssignments.length === 0 && (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        ⚠️ Chưa có luống nào được gán cho thí nghiệm này. Vui lòng liên hệ Manager để gán luống trước khi tạo lô.
      </div>
    )}

    {/* Nút Randomize Beds - song song với cách tạo thủ công */}
    {bedAssignments.length > 0 && (
      <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-indigo-700 mb-1">🎲 Randomize Beds (Khuyến nghị)</h4>
            <p className="text-[11px] text-indigo-600/80 leading-relaxed">
              Tự động phân bổ ngẫu nhiên các luống cho từng nhóm — đảm bảo tính ngẫu nhiên hóa của thiết kế thí nghiệm.
            </p>
          </div>
          <button onClick={onRandomizeBeds} disabled={loading || groups.length === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 shadow-sm shadow-indigo-600/20 whitespace-nowrap">
            {loading ? 'Đang xử lý...' : '🎲 Randomize Beds'}
          </button>
        </div>
      </div>
    )}

    <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
      <h4 className="text-xs font-bold text-rose-700 mb-3">+ Thêm Lô Mới (Thủ Công)</h4>
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
            <tr>{['Mã Lô', 'Luống (Khu/Trại)', 'Nhóm', 'Ngày Trồng', 'Dự Kiến Thu Hoạch', 'Số Cây (kế hoạch)', 'Thực Tế (Planting)', 'Ghi Chú', 'Thao Tác'].map(h => (
              <th key={h} className="px-4 py-3 text-left font-bold text-rose-700 uppercase">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {batches.map(b => {
              const ba = bedAssignments.find(x => x.id === b.experimentBedAssignmentId);
              const bedDisplay = b.bedCode || b.bedName || ba?.bedCode || ba?.bedName || '—';
              const areaFarm = [b.areaName, b.farmName].filter(Boolean).join(' / ') || ba ? [ba?.areaName, ba?.farmName].filter(Boolean).join(' / ') : '';
              const isIncomplete = !b.experimentBedAssignmentId || !b.groupId || !b.plantingDate;
              return (
                <tr key={b.id} className={`hover:bg-surface-container/20 ${isIncomplete ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-4 py-3 font-bold font-mono">
                    {b.batchCode || '—'}
                    {isIncomplete && (
                      <span className="ml-1.5 inline-block px-1.5 py-0.5 text-[9px] font-bold bg-amber-200 text-amber-800 rounded-full" title="Thiếu thông tin — bấm ✏️ để bổ sung">
                        ⚠️ Thiếu
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{bedDisplay}</div>
                    {areaFarm && <div className="text-[10px] text-on-surface-variant mt-0.5">🌾 {areaFarm}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{groups.find(g => g.id === b.groupId)?.groupName || b.groupName || '—'}</span>
                    {b.cropVarietyName && <div className="text-[10px] text-on-surface-variant mt-0.5">🌱 {b.cropVarietyName}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono">{b.plantingDate || '—'}</td>
                  <td className="px-4 py-3 font-mono">{b.expectedHarvestDate || '—'}</td>
                  <td className="px-4 py-3 font-bold">{b.plantCount || '—'}</td>
                  <td className="px-4 py-3">{renderActualCountCell(b)}</td>
                  <td className="px-4 py-3 text-on-surface-variant max-w-[160px]">
                    <div className="truncate" title={b.notes || ''}>{b.notes || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {onEdit && (
                        <button onClick={() => onEdit(b)} title="Chỉnh sửa thông tin lô"
                          className="px-2 py-1 text-amber-600 hover:bg-amber-50 rounded-lg text-xs font-bold">
                          ✏️ Sửa
                        </button>
                      )}
                      <button onClick={() => onDelete(b.id)} className="px-2 py-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold">✕</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    }
  </div>
  );
};

// ── Beds Tab ─────────────────────────────────────────────────────────────────

const BedsTab = ({ bedAssignments = [], availableBeds = [], areas = [], form, setForm, onAssign, onDelete, loading }) => (
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

// ── Tasks Tab (Visual: grouped by dueDate, date filter, modal assign) ─────────

const TasksTab = ({
  tasks = [], stages = [], batches = [], schedules = [], form, setForm, allSkills = [],
  users = [], assignForm, setAssignForm, skillMatches = [], userWorkload = {},
  selectedTaskForAssign, currentUserId,
  onCreate, onDelete, onGenerate, onSkillMatch, onAssign, onReassign,
  reassignModalTask, onReassignFormChange, onConfirmReassign, onCloseReassign,
  loading
}) => {
  const [filterDate, setFilterDate] = useState('all');
  const [assignModalTask, setAssignModalTask] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [localSkills, setLocalSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(false);

  // Load skills ngay khi TasksTab mount (defensive — nếu allSkills prop rỗng do chưa fetch xong)
  useEffect(() => {
    let cancelled = false;
    setSkillsLoading(true);
    skillsApi.getAll()
      .then(data => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : (data?.items || (data?.data && Array.isArray(data.data) ? data.data : []));
        setLocalSkills(list);
      })
      .catch(() => { if (!cancelled) setLocalSkills([]); })
      .finally(() => { if (!cancelled) setSkillsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Ưu tiên allSkills từ prop; nếu rỗng thì dùng localSkills
  const skillCatalog = allSkills && allSkills.length > 0 ? allSkills : localSkills;

  // Group tasks by dueDate (YYYY-MM-DD)
  const tasksByDate = useMemo(() => {
    const groups = {};
    tasks.forEach(t => {
      const raw = t.dueDate ? new Date(t.dueDate) : null;
      const key = raw ? raw.toISOString().split('T')[0] : 'no-date';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    const ordered = Object.entries(groups)
      .sort(([a], [b]) => (a === 'no-date' ? 1 : b === 'no-date' ? -1 : a.localeCompare(b)));
    return ordered;
  }, [tasks]);

  // Sort skill matches: ưu tiên matchScore cao + workload thấp
  // Trọng số: score (0..1) - 0.04 * totalTasks (giảm 4% mỗi task đã có)
  // Người có weightedScore cao nhất = match cao + ít việc → đánh dấu "Tối ưu nhất"
  // Lọc: chỉ giữ user có role Technician hoặc Student
  const rankedSkillMatches = useMemo(() => {
    if (!Array.isArray(skillMatches) || skillMatches.length === 0) return [];
    const enriched = skillMatches.map(m => {
      const wl = userWorkload[m.userId];
      const totalTasks = wl?.totalTasks ?? 0;
      const overdue = wl?.overdueTasks ?? 0;
      const pending = wl?.pendingTasks ?? 0;
      const inProgress = wl?.inProgressTasks ?? 0;
      const score = (m.matchScore || 0) / 100;
      // Trừ workload: 4% mỗi pending+inProgress task, thêm penalty cho overdue
      const workloadPenalty = 0.04 * (pending + inProgress) + 0.1 * overdue;
      const weightedScore = Math.max(0, score - workloadPenalty);
      const role = (m.roleName || wl?.roleName || '').toLowerCase();
      const isAssignable = role === 'technician' || role === 'student';
      return { ...m, totalTasks, pendingTasks: pending, inProgressTasks: inProgress, overdueTasks: overdue, weightedScore, isAssignable };
    })
    // Chỉ giữ user thuộc role Technician / Student (Researcher/Admin bị loại)
    .filter(m => m.isAssignable);
    enriched.sort((a, b) => b.weightedScore - a.weightedScore);
    return enriched;
  }, [skillMatches, userWorkload]);

  const dateKeys = tasksByDate.map(([k]) => k);
  const effectiveFilter = filterDate === 'all' ? dateKeys : (dateKeys.includes(filterDate) ? [filterDate] : []);

  const visibleGroups = effectiveFilter.length > 0
    ? tasksByDate.filter(([k]) => effectiveFilter.includes(k))
    : [];

  const formatDateLabel = (key) => {
    if (key === 'no-date') return { label: 'Chưa có hạn', sub: 'Tác vụ chưa đặt deadline' };
    const d = new Date(key + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((d - today) / 86400000);
    const viDate = d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
    let sub = '';
    if (diff === 0) sub = 'Hôm nay';
    else if (diff === 1) sub = 'Ngày mai';
    else if (diff === -1) sub = 'Hôm qua';
    else if (diff > 0) sub = `Còn ${diff} ngày`;
    else sub = `Trễ ${-diff} ngày`;
    return { label: viDate, sub };
  };

  const handleOpenAssign = async (task) => {
    setAssignModalTask(task);
    setAssignForm({ assigneeId: '', reason: '' });
    if (onSkillMatch) await onSkillMatch(task.id);
  };

  const handleConfirmAssign = async () => {
    if (!assignModalTask) return;
    await onAssign(assignModalTask.id);
    setAssignModalTask(null);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50 rounded-xl p-3 border border-indigo-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase text-indigo-700">Xem theo ngày:</span>
          <select value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="px-3 py-1.5 border border-indigo-200 rounded-lg text-xs bg-white font-semibold">
            <option value="all">Tất cả ({tasks.length})</option>
            {dateKeys.map(k => (
              <option key={k} value={k}>
                {k === 'no-date' ? 'Chưa có hạn' : new Date(k + 'T00:00:00').toLocaleDateString('vi-VN')} ({tasksByDate.find(([key]) => key === k)[1].length})
              </option>
            ))}
          </select>
          <input type="date" value={filterDate === 'all' ? '' : filterDate}
            onChange={e => setFilterDate(e.target.value || 'all')}
            className="px-3 py-1.5 border border-indigo-200 rounded-lg text-xs bg-white" />
          {filterDate !== 'all' && (
            <button onClick={() => setFilterDate('all')}
              className="text-xs text-indigo-600 font-bold hover:underline">↺ Reset</button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => onGenerate('experiment')}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow">
            ⚡ Tự Động
          </button>
          <button onClick={() => onGenerate('stage')}
            className="px-3 py-1.5 bg-white hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200">
            🔄 Theo Giai Đoạn
          </button>
          <button onClick={() => setShowCreateForm(s => !s)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow">
            {showCreateForm ? '✕ Đóng' : '+ Tạo Thủ Công'}
          </button>
        </div>
      </div>

      {/* Manual create form */}
      {showCreateForm && (() => {
        const handleStageChange = (stageId) => {
          const selected = stages.find(s => s.id === stageId);
          if (!selected) {
            setForm({ ...form, experimentStageId: stageId });
            return;
          }
          const updates = { ...form, experimentStageId: stageId };
          // Auto-fill dueDate từ stage.startDate nếu user chưa nhập
          if (!form.dueDate && selected.startDate) {
            updates.dueDate = selected.startDate.split('T')[0];
          }
          setForm(updates);
        };

        return (
        <div className="bg-white rounded-xl p-4 border border-indigo-200 space-y-3 animate-fade-in">
          <h4 className="text-xs font-bold text-indigo-700">Tạo Tác Vụ Thủ Công</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Giai Đoạn</label>
              <select value={form.experimentStageId} onChange={e => handleStageChange(e.target.value)}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white">
                <option value="">— Chọn giai đoạn —</option>
                {stages.map(s => {
                  const range = (s.startDate || s.endDate)
                    ? ` (${(s.startDate || '?').split('T')[0]} → ${(s.endDate || '?').split('T')[0]})`
                    : '';
                  return <option key={s.id} value={s.id}>{s.stageName}{range}</option>;
                })}
              </select>
              {form.experimentStageId && (() => {
                const sel = stages.find(s => s.id === form.experimentStageId);
                if (!sel?.startDate && !sel?.endDate) return null;
                return (
                  <p className="text-[10px] text-indigo-600 mt-1 italic">
                    💡 Giai đoạn: <span className="font-mono">{(sel.startDate || '—').split('T')[0]}</span> → <span className="font-mono">{(sel.endDate || '—').split('T')[0]}</span>
                  </p>
                );
              })()}
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Lô</label>
              <select value={form.batchId} onChange={e => setForm({ ...form, batchId: e.target.value })}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white">
                <option value="">— Chọn lô —</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.batchCode}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Lịch Chăm Sóc</label>
              <select value={form.careScheduleId} onChange={e => setForm({ ...form, careScheduleId: e.target.value })}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white">
                <option value="">— Tùy chọn —</option>
                {schedules.map(sc => (
                  <option key={sc.id} value={sc.id}>{sc.title || `Lịch #${sc.id}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Loại Tác Vụ</label>
              <select value={form.taskType} onChange={e => setForm({ ...form, taskType: e.target.value })}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white">
                {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Hạn Chót <span className="text-on-surface-variant/60 normal-case font-normal">* (hôm nay trở đi)</span></label>
              <input type="date" value={form.dueDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Tiêu Đề *</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="VD: Tưới nước ngày 01/07"
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Mô Tả</label>
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Mô tả chi tiết tác vụ"
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white" />
            </div>

            {/* Yêu cầu kỹ năng (chọn từ list Skill do Admin tạo) */}
            <div className="col-span-2 bg-indigo-50/40 border border-indigo-100 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase text-indigo-700 flex items-center gap-1.5">
                  🎯 Kỹ Năng Yêu Cầu (từ danh mục Skill)
                </label>
                <span className="text-[9px] text-indigo-500 italic">
                  {form.skillRequirements?.length || 0} skill đã chọn
                </span>
              </div>

              {/* List chip các skill đã chọn */}
              {form.skillRequirements?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.skillRequirements.map((sr, idx) => {
                    const skill = skillCatalog.find(s => s.id === sr.skillId);
                    return (
                      <div key={`${sr.skillId}-${idx}`}
                        className="inline-flex items-center gap-2 bg-white border border-indigo-200 rounded-full pl-2 pr-1 py-1 text-xs">
                        <span className="font-semibold text-indigo-900">{skill?.skillName || sr.skillId}</span>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 rounded-full">
                          Lv {sr.requiredLevel}
                        </span>
                        <button type="button" onClick={() => {
                          setForm({ ...form, skillRequirements: form.skillRequirements.filter((_, i) => i !== idx) });
                        }} className="text-indigo-400 hover:text-rose-500 px-1 font-bold leading-none">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Form thêm skill */}
              {skillsLoading && skillCatalog.length === 0 ? (
                <p className="text-[10px] text-indigo-600 italic">⏳ Đang tải danh sách skill...</p>
              ) : skillCatalog.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-amber-700 italic">
                    ⚠️ Chưa có skill nào trong hệ thống. Vào Admin → Quản lý Kỹ Năng để tạo trước.
                  </p>
                  <button type="button"
                    onClick={() => {
                      setSkillsLoading(true);
                      skillsApi.getAll()
                        .then(data => {
                          const list = Array.isArray(data) ? data : (data?.items || []);
                          setLocalSkills(list);
                        })
                        .catch(() => setLocalSkills([]))
                        .finally(() => setSkillsLoading(false));
                    }}
                    className="text-[10px] px-2 py-1 border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-100">
                    🔄 Thử lại
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-12 gap-2">
                  <select
                    value=""
                    onChange={e => {
                      const skillId = e.target.value;
                      if (!skillId) return;
                      if (form.skillRequirements?.some(sr => sr.skillId === skillId)) return; // đã có
                      setForm({
                        ...form,
                        skillRequirements: [...(form.skillRequirements || []), { skillId, requiredLevel: 3 }]
                      });
                    }}
                    className="col-span-7 px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white">
                    <option value="">+ Chọn skill từ danh mục...</option>
                    {skillCatalog
                      .filter(s => !form.skillRequirements?.some(sr => sr.skillId === s.id))
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.skillName}</option>
                      ))
                    }
                  </select>
                  <select
                    value=""
                    onChange={e => {
                      const lv = Number(e.target.value);
                      if (!lv) return;
                      // Nếu vừa chọn level trước → áp dụng cho skill mới nhất chưa có level
                      // Ở đây UX đơn giản: mỗi skill được chọn mặc định Lv 5, dùng dropdown này để đổi skill cuối
                      const lastIdx = (form.skillRequirements?.length || 0) - 1;
                      if (lastIdx < 0) return;
                      const next = [...(form.skillRequirements || [])];
                      next[lastIdx] = { ...next[lastIdx], requiredLevel: lv };
                      setForm({ ...form, skillRequirements: next });
                    }}
                    className="col-span-5 px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white">
                    <option value="">Đổi level (mặc định 3)</option>
                    {[1,2,3,4,5].map(n => (
                      <option key={n} value={n}>Level {n}{n >= 5 ? ' - Chuyên gia' : n >= 4 ? ' - Thành thạo' : n >= 3 ? ' - Khá' : n >= 2 ? ' - Cơ bản' : ' - Mới'}</option>
                    ))}
                  </select>
                </div>
              )}

              <input value={form.requiredSkillDescription}
                onChange={e => setForm({ ...form, requiredSkillDescription: e.target.value })}
                placeholder="Mô tả thêm (optional): VD: Cần 2 người phối hợp"
                className="w-full px-3 py-2 border border-outline-variant rounded-lg text-xs bg-white mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-bold hover:bg-surface-container/40">
              Hủy
            </button>
            <button onClick={async () => { await onCreate(); setShowCreateForm(false); }} disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-50">
              + Tạo Tác Vụ
            </button>
          </div>
        </div>
        );
      })()}

      {/* Grouped task list by date */}
      {loading ? (
        <p className="text-center text-sm text-on-surface-variant py-4">Đang tải...</p>
      ) : visibleGroups.length === 0 ? (
        <p className="text-center text-sm text-on-surface-variant py-8">Chưa có tác vụ nào trong khoảng đã chọn.</p>
      ) : (
        <div className="space-y-5">
          {visibleGroups.map(([dateKey, items]) => {
            const { label, sub } = formatDateLabel(dateKey);
            const completedCount = items.filter(t => t.status === 'Completed').length;
            const progress = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;
            return (
              <div key={dateKey} className="space-y-2">
                {/* Date header */}
                <div className="flex items-center justify-between gap-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shadow-sm ${
                      dateKey === 'no-date' ? 'bg-slate-100 text-slate-500'
                        : sub === 'Hôm nay' ? 'bg-amber-100 text-amber-700'
                        : sub.startsWith('Trễ') ? 'bg-rose-100 text-rose-700'
                        : sub === 'Ngày mai' ? 'bg-blue-100 text-blue-700'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      📅
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">{label}</p>
                      <p className="text-[10px] text-on-surface-variant">{sub} · {items.length} tác vụ · {completedCount} xong</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-xs font-bold text-on-surface-variant">{progress}%</span>
                  </div>
                </div>

                {/* Tasks of this date */}
                <div className="space-y-2 pl-2 border-l-2 border-indigo-100 ml-4">
                  {items.map(t => (
                    <div key={t.id}
                      className="flex items-center gap-3 p-3 bg-white border border-outline-variant rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                        t.taskType === 'Watering' ? 'bg-blue-50 text-blue-600'
                        : t.taskType === 'Fertilizing' ? 'bg-amber-50 text-amber-600'
                        : t.taskType === 'Observation' ? 'bg-purple-50 text-purple-600'
                        : t.taskType === 'Inspection' ? 'bg-indigo-50 text-indigo-600'
                        : t.taskType === 'Planting' ? 'bg-emerald-50 text-emerald-600'
                        : t.taskType === 'Harvest' ? 'bg-orange-50 text-orange-600'
                        : 'bg-slate-50 text-slate-600'
                      }`}>
                        {{
                          Planting: '🌱', Watering: '💧', Fertilizing: '🧪',
                          Observation: '👁️', Inspection: '🔍', Harvest: '🌾', Other: '📋'
                        }[t.taskType] || '📌'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className={`text-sm font-semibold truncate ${t.status === 'Completed' ? 'line-through text-slate-400' : 'text-on-surface'}`}>
                            {t.title || '—'}
                          </p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[t.status] || 'bg-slate-100 text-slate-600'}`}>
                            {t.status || '—'}
                          </span>
                        </div>
                        <p className="text-[10px] text-on-surface-variant truncate">
                          {[t.experimentStageName, t.batchCode].filter(Boolean).join(' · ') || 'Tác vụ thí nghiệm'}
                          {t.requiredSkillDescription ? ` · 🎯 ${t.requiredSkillDescription}` : ''}
                        </p>
                        {(getTaskAssignee(t).name || t.assignedToUserName) && (
                          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">👤 {getTaskAssignee(t).name || t.assignedToUserName}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isTaskAssigned(t) && t.status !== 'Completed' && (
                          <button onClick={() => handleOpenAssign(t)}
                            className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-[11px] font-bold">
                            🎯 Gán
                          </button>
                        )}
                        {(() => {
                          // Validate nghiệp vụ: chỉ hiện nút Reassign khi hợp lệ
                          // P0 fix: dùng isTaskAssigned() thay vì chỉ check t.assignedToName
                          const reassignCheck = canReassignTask(t, currentUserId);
                          if (!isTaskAssigned(t)) return null; // đã có nút "Gán" ở trên, không show 🔄
                          if (reassignCheck.allowed) {
                            return (
                              <button onClick={() => onReassign(t)}
                                className="px-2 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-[10px] font-bold"
                                title="Chuyển giao tác vụ">
                                🔄
                              </button>
                            );
                          }
                          return (
                            <button disabled
                              className="px-2 py-1.5 bg-slate-50 text-slate-300 rounded-lg text-[10px] font-bold cursor-not-allowed"
                              title={`Không thể chuyển giao: ${reassignCheck.reason}`}>
                              🔄
                            </button>
                          );
                        })()}
                        <button onClick={() => onDelete(t.id)}
                          className="px-2 py-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-[10px] font-bold">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Gán tác vụ */}
      {assignModalTask && (
        <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10400] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
              <div className="px-6 py-4 border-b border-outline-variant bg-gradient-to-r from-emerald-50 to-teal-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-hanken font-bold text-lg text-emerald-900">🎯 Gán Tác Vụ</h3>
                    <p className="text-xs text-emerald-700 mt-0.5 truncate">{assignModalTask.title || '—'}</p>
                  </div>
                  <button onClick={() => setAssignModalTask(null)} className="text-gray-400 hover:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Task info */}
                <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 border border-slate-200">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Loại:</span>
                    <span className="font-semibold">{assignModalTask.taskType || '—'}</span>
                  </div>
                  {assignModalTask.dueDate && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">Hạn:</span>
                      <span className="font-semibold">{new Date(assignModalTask.dueDate).toLocaleDateString('vi-VN')}</span>
                    </div>
                  )}
                  {assignModalTask.requiredSkillDescription && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">Kỹ năng:</span>
                      <span className="font-semibold">{assignModalTask.requiredSkillDescription}</span>
                    </div>
                  )}
                </div>

                {/* Skill matches — sort theo matchScore × workload */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant">
                      🎯 Người phù hợp (skill match × workload)
                    </p>
                    <span className="text-[9px] text-on-surface-variant italic">
                      Sắp xếp: match cao + ít task
                    </span>
                  </div>
                  {rankedSkillMatches.length === 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs text-on-surface-variant italic py-2">Đang tìm người phù hợp...</p>
                      <p className="text-[10px] text-amber-700 italic">
                        ⚠️ Chỉ hiển thị user thuộc role <b>Technician</b> hoặc <b>Student</b>.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rankedSkillMatches.map((m, idx) => {
                        const isTopPick = idx === 0 && m.weightedScore > 0;
                        const wl = userWorkload[m.userId];
                        const workloadBadge = (() => {
                          if (wl === undefined) {
                            return { label: '— workload', cls: 'bg-slate-100 text-slate-500' };
                          }
                          if (m.totalTasks === 0) {
                            return { label: '✨ Rảnh', cls: 'bg-emerald-100 text-emerald-700' };
                          }
                          if (m.overdueTasks > 0) {
                            return { label: `⚠️ ${m.totalTasks} task · ${m.overdueTasks} trễ`, cls: 'bg-rose-100 text-rose-700' };
                          }
                          if (m.pendingTasks + m.inProgressTasks >= 3) {
                            return { label: `🔴 ${m.totalTasks} task · ${m.pendingTasks + m.inProgressTasks} dở`, cls: 'bg-rose-100 text-rose-700' };
                          }
                          if (m.pendingTasks + m.inProgressTasks >= 1) {
                            return { label: `🟡 ${m.totalTasks} task · ${m.pendingTasks + m.inProgressTasks} dở`, cls: 'bg-amber-100 text-amber-700' };
                          }
                          return { label: `🟢 ${m.totalTasks} task`, cls: 'bg-emerald-100 text-emerald-700' };
                        })();

                        return (
                          <button key={m.userId} type="button"
                            onClick={() => setAssignForm({ ...assignForm, assigneeId: m.userId })}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                              assignForm.assigneeId === m.userId
                                ? 'border-emerald-500 bg-emerald-50 shadow-md'
                                : isTopPick
                                  ? 'border-amber-300 bg-amber-50/40 hover:border-amber-400'
                                  : 'border-outline-variant bg-white hover:border-emerald-200'
                            }`}>
                            <div className="relative">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-sm font-bold shrink-0">
                                {(m.fullName || m.userId || '?')[0]?.toUpperCase()}
                              </div>
                              {isTopPick && (
                                <span className="absolute -top-1 -right-1 text-[8px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                                  ⭐ TOP
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-on-surface truncate flex items-center gap-1.5">
                                {m.fullName || m.userId}
                                {isTopPick && <span className="text-[9px] text-amber-700 font-bold">TỐI ƯU</span>}
                              </p>
                              <p className="text-[10px] text-on-surface-variant">
                                {m.roleName || '—'}
                                {wl?.roleName && m.roleName !== wl.roleName ? ` · ${wl.roleName}` : ''}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${workloadBadge.cls}`}>
                                  {workloadBadge.label}
                                </span>
                                {wl && (m.pendingTasks > 0 || m.inProgressTasks > 0) && (
                                  <span className="text-[9px] text-on-surface-variant">
                                    ({m.pendingTasks} chờ · {m.inProgressTasks} đang làm)
                                  </span>
                                )}
                              </div>
                              {assignModalTask?.dueDate && (
                                <p className="text-[9px] text-on-surface-variant mt-1 italic">
                                  📅 Trong ngày {new Date(assignModalTask.dueDate).toLocaleDateString('vi-VN')}: <b className={m.totalTasks > 0 ? 'text-amber-700' : 'text-emerald-700'}>{m.totalTasks} task</b>
                                </p>
                              )}
                            </div>
                            <div className="shrink-0 text-right space-y-1">
                              <div className="text-xs font-bold text-emerald-700">{m.matchScore || 0}%</div>
                              <div className="text-[9px] text-on-surface-variant">match</div>
                              <div className={`text-[9px] font-bold ${isTopPick ? 'text-amber-700' : 'text-slate-500'}`}>
                                {Math.round(m.weightedScore * 100)}%
                              </div>
                              <div className="text-[8px] text-on-surface-variant">điểm</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Manual select */}
                <div>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-2">Hoặc chọn thủ công</p>
                  <select value={assignForm.assigneeId} onChange={e => setAssignForm({ ...assignForm, assigneeId: e.target.value })}
                    className="w-full px-3 py-2.5 border border-outline-variant rounded-xl text-sm bg-white">
                    <option value="">— Chọn người dùng —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.fullName || u.email}</option>)}
                  </select>
                </div>

                {/* Reason */}
                <div>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant mb-2">Lý do gán (tùy chọn)</p>
                  <input value={assignForm.reason} onChange={e => setAssignForm({ ...assignForm, reason: e.target.value })}
                    placeholder="VD: Người phụ trách khu vực này"
                    className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm bg-white" />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-outline-variant flex justify-end gap-2 bg-slate-50">
                <button onClick={() => setAssignModalTask(null)}
                  className="px-5 py-2 border border-outline-variant rounded-xl text-sm font-bold hover:bg-white">
                  Hủy
                </button>
                <button onClick={handleConfirmAssign} disabled={!assignForm.assigneeId}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50">
                  ✅ Xác Nhận Gán
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Modal Chuyển giao tác vụ */}
      {reassignModalTask && (
        <ReassignModal
          data={reassignModalTask}
          users={users}
          onFormChange={onReassignFormChange}
          onConfirm={onConfirmReassign}
          onClose={onCloseReassign}
        />
      )}
    </div>
  );
};

// ── Reassign Modal ─────────────────────────────────────────────────────────────────────

const ReassignModal = ({ data, users, onFormChange, onConfirm, onClose }) => {
  if (!data) return null;
  const { task, saving, form, skillMatches = [], userWorkload = {}, loading } = data;
  const { assigneeId, reason } = form || {};

  const currentUserId = getTaskAssignee(task).id;

  // Resolve userId → user object từ danh sách users để lấy fullName
  const resolveName = (userId) => {
    if (!userId) return null;
    return users.find(u => u.id === userId) || null;
  };

  const currentUser = resolveName(currentUserId);
  const currentName = getTaskAssignee(task).name ||
    (currentUser ? (currentUser.fullName || currentUser.email) : (currentUserId || ''));
  const currentRole = currentUser?.role || currentUser?.roleName || task?.assignedToRole || '';
  const initials = currentName ? currentName.charAt(0).toUpperCase() : '?';

  // Validate trong modal: nếu user chọn lại đúng người hiện tại → disable nút Confirm
  const isSameAssignee = !!(assigneeId && currentUserId && assigneeId === currentUserId);

  // Resolve skill-match userId → user object
  const resolveMatchUser = (m) => {
    const u = resolveName(m.userId);
    return {
      ...m,
      resolvedName: m.userName || m.assigneeName ||
        (u ? (u.fullName || u.email) : m.userId),
      resolvedRole: m.roleName || m.assigneeRole || (u?.role || u?.roleName || ''),
      resolvedFullName: u ? (u.fullName || u.email) : (m.userName || m.assigneeName || m.userId),
    };
  };

  const suggestUsers = skillMatches.map(resolveMatchUser);

  return (
    <Portal>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10400] flex items-center justify-center p-4 animate-fade-in"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-outline-variant bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg font-bold shadow-sm shrink-0">
                  🔄
                </div>
                <div className="min-w-0">
                  <h3 className="font-hanken font-bold text-base text-blue-900">Chuyển Giao Tác Vụ</h3>
                  <p className="text-xs text-blue-700 mt-0.5 truncate">{task?.title || '—'}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-white/60 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
            {/* Current assignee — nâng cấp: hiển thị badge + role + email */}
            {currentUserId && (
              <div className="relative overflow-hidden rounded-2xl border-2 border-rose-200 bg-rose-50/80">
                <div className="absolute top-2 right-2">
                  <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-rose-200 text-rose-700 border border-rose-300 uppercase tracking-wider">
                    Người Hiện Tại
                  </span>
                </div>
                <div className="flex items-center gap-4 p-4">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-400 to-red-500 text-white flex items-center justify-center text-xl font-bold shadow-md ring-4 ring-rose-200">
                      {initials}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[9px] font-black border-2 border-white">
                      ✕
                    </div>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0 pr-12">
                    <p className="text-sm font-bold text-rose-900 truncate">{currentName}</p>
                    {currentRole && (
                      <p className="text-[11px] text-rose-600 mt-0.5 truncate">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                          {currentRole}
                        </span>
                      </p>
                    )}
                    {currentUser?.email && (
                      <p className="text-[10px] text-rose-400 mt-0.5 truncate">{currentUser.email}</p>
                    )}
                  </div>
                </div>
                {/* Skill tags của người hiện tại */}
                {task?.assignedToSkills && task.assignedToSkills.length > 0 && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {task.assignedToSkills.map((sk, i) => (
                      <span key={i} className="text-[9px] px-2 py-1 bg-white border border-rose-200 text-rose-700 rounded-full font-medium">
                        {sk.skillName || sk}
                      </span>
                    ))}
                  </div>
                )}
                {/* Arrow chỉ sang phải */}
                <div className="absolute right-0 top-0 bottom-0 w-8 flex items-center justify-center">
                  <span className="text-rose-300 text-lg animate-pulse">→</span>
                </div>
              </div>
            )}

            {/* Task summary mini-card */}
            <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-slate-400 text-sm">📋</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{task?.title || '—'}</p>
                {task?.taskType && (
                  <p className="text-[10px] text-slate-400">{task.taskType} · {task?.experimentTitle || task?.experimentName || ''}</p>
                )}
              </div>
              {task?.dueDate && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg shrink-0">
                  📅 {new Date(task.dueDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </span>
              )}
            </div>

            {/* Skill-matched suggestions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                  ✨ Gợi Ý Theo Kỹ Năng
                </p>
                {loading && <span className="text-[10px] text-slate-400 italic animate-pulse">Đang tải…</span>}
                {!loading && suggestUsers.length > 0 && (
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{suggestUsers.length} người</span>
                )}
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : suggestUsers.length === 0 ? (
                <div className="text-center py-5 text-xs text-slate-500 italic bg-slate-50 rounded-xl border border-slate-200">
                  Không có gợi ý phù hợp — hãy chọn người dùng thủ công bên dưới.
                </div>
              ) : (
                <div className="space-y-2">
                  {suggestUsers.map(m => {
                    const workload = userWorkload[m.userId] || {};
                    const isSelected = assigneeId === m.userId;
                    const wlLabel = workload.totalTasks === undefined
                      ? ''
                      : workload.totalTasks === 0
                        ? '✨ Rảnh'
                        : `${workload.totalTasks} việc${workload.inProgressTasks > 0 ? ` · ${workload.inProgressTasks} đang làm` : ''}`;
                    const wlCls = workload.totalTasks === 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : (workload.overdueTasks > 0 || (workload.pendingTasks + workload.inProgressTasks) >= 3)
                        ? 'bg-rose-100 text-rose-700'
                        : (workload.pendingTasks + workload.inProgressTasks) >= 1
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700';
                    const nameInitial = m.resolvedName ? m.resolvedName.charAt(0).toUpperCase() : '?';
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => onFormChange({ assigneeId: m.userId })}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                        }`}
                      >
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm ${
                            isSelected
                              ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                              : 'bg-gradient-to-br from-slate-300 to-slate-400 text-white'
                          }`}>
                            {nameInitial}
                          </div>
                          {isSelected && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center border-2 border-white">
                              <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            </span>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{m.resolvedName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {m.resolvedRole && (
                              <span className="text-[10px] text-slate-500">{m.resolvedRole}</span>
                            )}
                            {m.matchScore !== undefined && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                m.matchScore >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                m.matchScore >= 50 ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {m.matchScore}% phù hợp
                              </span>
                            )}
                            {wlLabel && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${wlCls}`}>
                                {wlLabel}
                              </span>
                            )}
                          </div>
                          {m.skills && m.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {m.skills.slice(0, 3).map((sk, i) => (
                                <span key={i} className="text-[9px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 font-medium">
                                  {sk.skillName || sk.name || sk}
                                </span>
                              ))}
                              {m.skills.length > 3 && (
                                <span className="text-[9px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                                  +{m.skills.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Manual user select */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
                Hoặc Chọn Người Dùng Thủ Công
              </p>
              <select
                value={assigneeId || ''}
                onChange={e => onFormChange({ assigneeId: e.target.value })}
                className="w-full px-3 py-2.5 border border-outline-variant rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              >
                <option value="">— Chọn người dùng —</option>
                {users
                  .filter(u => u.id !== currentUserId)
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.fullName || u.email}{u.role ? ` (${u.role})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            {/* Reason */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Lý Do Chuyển Giao</p>
                <span className="text-[9px] text-slate-400 italic">Tùy chọn</span>
              </div>
              <textarea
                value={reason || ''}
                onChange={e => onFormChange({ reason: e.target.value })}
                placeholder="VD: Người phụ trách trước không đủ kỹ năng, thay đổi phân công…"
                rows={2}
                className="w-full px-3 py-2 border border-outline-variant rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
              />
            </div>

            {/* Inline validation: chọn cùng người hiện tại */}
            {isSameAssignee && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                <span className="text-rose-500 text-sm shrink-0 mt-0.5">⚠️</span>
                <p>
                  Bạn đã chọn <strong>chính người đang giữ</strong> tác vụ này.
                  Vui lòng chọn người <strong>khác</strong> để chuyển giao.
                </p>
              </div>
            )}

            {/* Confirm warning */}
            {assigneeId && !isSameAssignee && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <span className="text-amber-500 text-sm shrink-0 mt-0.5">⚠️</span>
                <p>
                  Bạn đang chuyển tác vụ <strong>"{task?.title}"</strong> sang người khác.
                  Người được gán cũ sẽ <strong>không còn</strong> phụ trách tác vụ này.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-outline-variant bg-slate-50 flex items-center justify-end gap-2">
            <button onClick={onClose} disabled={saving}
              className="px-5 py-2.5 border border-outline-variant rounded-xl text-sm font-bold hover:bg-white transition-colors disabled:opacity-50">
              Hủy
            </button>
            <button
              onClick={onConfirm}
              disabled={!assigneeId || saving || isSameAssignee}
              title={isSameAssignee ? 'Bạn đã chọn chính người đang giữ task' : ''}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Đang chuyển giao…
                </>
              ) : (
                <>🔄 Xác Nhận Chuyển Giao</>
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

// ── Create Experiment Modal ─────────────────────────────────────────────────────────

const CreateExpModal = ({ open, onClose, farms, cropVarieties, form, setForm, errors, onSubmit, loading }) => {
  if (!open) return null;
  return (
    <Portal>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10300] flex items-center justify-center p-4 animate-fade-in">
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
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Ngày Bắt Đầu <span className="text-rose-500">*</span></label>
                <input type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                  className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${errors.startDate ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`} />
                {errors.startDate && <p className="text-xs text-rose-600 mt-1">{errors.startDate}</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">Ngày Kết Thúc</label>
                <input type="date"
                  min={form.startDate || new Date().toISOString().split('T')[0]}
                  value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
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
    </Portal>
  );
};

export default ResearcherExperiments;
