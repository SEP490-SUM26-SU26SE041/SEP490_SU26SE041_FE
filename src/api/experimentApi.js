import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

// ── Experiment Requests (Manager: inbox + review) ────────────────────────────────

export const experimentRequestsApi = {
  // Manager inbox - filter by status and/or farmId
  getInbox: (params = {}) =>
    apiClient.request('/experiment-requests/manager/inbox', { params }).then(u),
  // Lấy tất cả / filter
  getAll: (params = {}) =>
    apiClient.request('/experiment-requests', { params }).then(u),
  getById: (id) => apiClient.request(`/experiment-requests/${id}`).then(u),
  getResourceSummary: (id) => apiClient.request(`/experiment-requests/${id}/resource-summary`).then(u),
  getReservedBeds: (id) => apiClient.request(`/experiment-requests/${id}/reserved-beds`).then(u),
  // Researcher tạo yêu cầu
  create: (payload) =>
    apiClient.request('/experiment-requests', { method: 'POST', body: payload }).then(u),
  update: (id, payload) =>
    apiClient.request(`/experiment-requests/${id}`, { method: 'PUT', body: payload }).then(u),
  cancel: (id) =>
    apiClient.request(`/experiment-requests/${id}/cancel`, { method: 'POST' }).then(u),
  // Manager duyệt/từ chối
  review: (id, payload) =>
    apiClient.request(`/experiment-requests/${id}/review`, { method: 'POST', body: payload }).then(u)
};

// ── Experiments (Manager: read-only, Researcher: full CRUD) ────────────────────

export const experimentsApi = {
  getAll: (params = {}) => apiClient.request('/experiments', { params }).then(u),
  // Lấy chi tiết experiment BẰNG ID — dùng cho detail view
  getById: (id) => apiClient.request(`/experiments/${id}`).then(u),
  createFromRequest: (requestId) =>
    apiClient.request(`/experiments/from-request/${requestId}`, { method: 'POST' }),
  create: (payload) => apiClient.request('/experiments', { method: 'POST', body: payload }),
  update: (id, payload) =>
    apiClient.request(`/experiments/${id}`, { method: 'PUT', body: payload }),
  updateStatus: (id, status) =>
    apiClient.request(`/experiments/${id}/status`, { method: 'PATCH', body: { status } }),
  remove: (id) => apiClient.request(`/experiments/${id}`, { method: 'DELETE' }),

  // Stages
  getStages: (id) => apiClient.request(`/experiments/${id}/stages`).then(u),
  createStage: (id, payload) =>
    apiClient.request(`/experiments/${id}/stages`, { method: 'POST', body: payload }),
  updateStage: (stageId, payload) =>
    apiClient.request(`/experiments/stages/${stageId}`, { method: 'PUT', body: payload }),
  removeStage: (stageId) =>
    apiClient.request(`/experiments/stages/${stageId}`, { method: 'DELETE' }),

  // Groups
  getGroups: (id) => apiClient.request(`/experiments/${id}/groups`).then(u),
  createGroup: (id, payload) =>
    apiClient.request(`/experiments/${id}/groups`, { method: 'POST', body: payload }),
  updateGroup: (groupId, payload) =>
    apiClient.request(`/experiments/groups/${groupId}`, { method: 'PUT', body: payload }),
  removeGroup: (groupId) =>
    apiClient.request(`/experiments/groups/${groupId}`, { method: 'DELETE' }),

  // Design
  getDesign: (id) => apiClient.request(`/experiments/${id}/design`).then(u),
  createDesign: (id, payload) =>
    apiClient.request(`/experiments/${id}/design`, { method: 'POST', body: payload }),
  updateDesign: (id, payload) =>
    apiClient.request(`/experiments/${id}/design`, { method: 'PUT', body: payload }),
  removeDesign: (id) =>
    apiClient.request(`/experiments/${id}/design`, { method: 'DELETE' }),

  // Measurements
  getMeasurements: (id) => apiClient.request(`/experiments/${id}/measurements`).then(u),
  createMeasurement: (id, payload) =>
    apiClient.request(`/experiments/${id}/measurements`, { method: 'POST', body: payload }),
  updateMeasurement: (mId, payload) =>
    apiClient.request(`/experiments/measurements/${mId}`, { method: 'PUT', body: payload }),
  removeMeasurement: (mId) =>
    apiClient.request(`/experiments/measurements/${mId}`, { method: 'DELETE' }),

  // Care Schedules
  getSchedules: (id) => apiClient.request(`/experiments/${id}/schedules`).then(u),
  createSchedule: (id, payload) =>
    apiClient.request(`/experiments/${id}/schedules`, { method: 'POST', body: payload }),
  updateSchedule: (sId, payload) =>
    apiClient.request(`/experiments/schedules/${sId}`, { method: 'PUT', body: payload }),
  removeSchedule: (sId) =>
    apiClient.request(`/experiments/schedules/${sId}`, { method: 'DELETE' }),

  // Procedure Templates
  getProcedureTemplates: (params = {}) =>
    apiClient.request('/experiments/procedure-templates', { params }).then(u),
  getProcedureTemplateById: (id) =>
    apiClient.request(`/experiments/procedure-templates/${id}`).then(u),
  createProcedureTemplate: (payload) =>
    apiClient.request('/experiments/procedure-templates', { method: 'POST', body: payload }),
  removeProcedureTemplate: (id) =>
    apiClient.request(`/experiments/procedure-templates/${id}`, { method: 'DELETE' }),

  // Auto-Setup Experiment (tạo Groups + Batches tự động)
  autoSetup: (id) =>
    apiClient.request(`/experiments/${id}/auto-setup`, { method: 'POST' }),

  // Randomize Beds (BE cũ: /randomize-beds; BE mới: /randomize - hỗ trợ cả 2)
  randomizeBeds: (id) =>
    apiClient.request(`/experiments/${id}/randomize-beds`, { method: 'POST' })
      .catch(() => apiClient.request(`/experiments/${id}/randomize`, { method: 'POST' })),

  // Supplement Groups (BE mới) - thêm/sửa groups sau auto-setup
  supplementGroups: (id, payload) =>
    apiClient.request(`/experiments/${id}/supplement-groups`, { method: 'POST', body: payload })
};

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const tasksApi = {
  getMy: () => apiClient.request('/tasks/my').then(u),
  getToday: () => apiClient.request('/tasks/today').then(u),
  getUpcoming: (days = 7) =>
    apiClient.request('/tasks/upcoming', { params: { days } }).then(u),
  getOverdue: () => apiClient.request('/tasks/overdue').then(u),
  getByResearcherCreated: (params = {}) =>
    apiClient.request('/tasks/researcher/created', { params }).then(u),
  getById: (id) => apiClient.request(`/tasks/${id}`).then(u),
  getByExperiment: (id) => apiClient.request(`/tasks/experiment/${id}`).then(u),
  getByStage: (id) => apiClient.request(`/tasks/stage/${id}`).then(u),
  getByBatch: (id) => apiClient.request(`/tasks/batch/${id}`).then(u),
  getByUser: (id) => apiClient.request(`/tasks/user/${id}`).then(u),
  getAssignmentsMy: () => apiClient.request('/tasks/assignments/my').then(u),
  getTaskAssignments: (taskId) => apiClient.request(`/tasks/${taskId}/assignments`).then(u),
  getSkillMatches: (taskId) => apiClient.request(`/tasks/${taskId}/skill-matches`).then(u),

  create: (payload) => apiClient.request('/tasks', { method: 'POST', body: payload }),
  update: (id, payload) => apiClient.request(`/tasks/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => apiClient.request(`/tasks/${id}`, { method: 'DELETE' }),
  start: (id) => apiClient.request(`/tasks/${id}/start`, { method: 'PATCH' }),
  complete: (id) => apiClient.request(`/tasks/${id}/complete`, { method: 'PATCH' }),
  cancel: (id) => apiClient.request(`/tasks/${id}/cancel`, { method: 'PATCH' }),
  updateStatus: (id, status) =>
    apiClient.request(`/tasks/${id}/status`, { method: 'PATCH', body: { status } }),
  assign: (payload) => apiClient.request('/tasks/assign', { method: 'POST', body: payload }),
  reassign: (payload) => apiClient.request('/tasks/reassign', { method: 'POST', body: payload }),
  updateAssignmentStatus: (payload) =>
    apiClient.request('/tasks/assignments/status', { method: 'PATCH', body: payload }),
  generateByExperiment: (id) =>
    apiClient.request(`/tasks/generate-by-experiment/${id}`, { method: 'POST' }),
  generateByStage: (id) =>
    apiClient.request(`/tasks/generate-by-stage/${id}`, { method: 'POST' })
};

// ── Batches ─────────────────────────────────────────────────────────────────

export const batchesApi = {
  create: (payload) => apiClient.request('/batches', { method: 'POST', body: payload }),
  getByExperiment: (id) => apiClient.request(`/batches/experiments/${id}`).then(u),
  getById: (id) => apiClient.request(`/batches/${id}`).then(u),
  update: (id, payload) => apiClient.request(`/batches/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => apiClient.request(`/batches/${id}`, { method: 'DELETE' })
};

// ── Task Reports ─────────────────────────────────────────────────────────────

export const taskReportsApi = {
  create: (payload) => apiClient.request('/task-reports', { method: 'POST', body: payload }),
  getByTask: (taskId) => apiClient.request(`/task-reports/task/${taskId}`).then(u),
  getByBatch: (batchId) => apiClient.request(`/task-reports/batch/${batchId}`).then(u),
  update: (id, payload) => apiClient.request(`/task-reports/${id}`, { method: 'PUT', body: payload })
};

// ── Measurement Records ──────────────────────────────────────────────────────

export const measurementRecordsApi = {
  // Tạo một record (legacy — dùng cho trường hợp đơn lẻ)
  create: (payload) =>
    apiClient.request('/measurement-records', { method: 'POST', body: payload }),

  // Tạo nhiều record cùng lúc (bulk) — dùng cho form đo lường chuẩn
  bulk: (payload) =>
    apiClient.request('/measurement-records/bulk', { method: 'POST', body: payload }),

  getByBatch: (batchId) =>
    apiClient.request(`/measurement-records/batch/${batchId}`).then(u),

  // Lấy tất cả measurement của một experiment (dùng cho tab thống kê)
  getByExperiment: (experimentId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const url = `/measurement-records/experiment/${experimentId}${qs ? `?${qs}` : ''}`;
    return apiClient.request(url).then(u);
  },

  update: (id, payload) =>
    apiClient.request(`/measurement-records/${id}`, { method: 'PUT', body: payload }),
  remove: (id) =>
    apiClient.request(`/measurement-records/${id}`, { method: 'DELETE' })
};

// Measurement Definitions (định nghĩa metric: tên, đơn vị, target value)
export const measurementDefinitionsApi = {
  /**
   * Lấy tất cả MeasurementDefinition của experiment.
   * Dùng route /experiments/{experimentId}/measurements (chuẩn Swagger).
   * Vì mỗi experiment có các nhóm giống nhau → chỉ số đo lường giống nhau.
   * @param {string} experimentId
   * @returns {Promise<Array<{id, groupId, groupName, metricName, unit, targetValue, description}>>}
   */
  getByExperiment: (experimentId) =>
    apiClient.request(`/experiments/${experimentId}/measurements`).then(u),

  /**
   * Legacy route /measurement-definitions?experimentId=X (giữ tương thích ngược).
   * Prefer dùng getByExperiment() ở trên.
   */
  getByExperimentLegacy: (experimentId) =>
    apiClient.request(`/measurement-definitions?experimentId=${experimentId}`).then(u),

  getById: (id) =>
    apiClient.request(`/measurement-definitions/${id}`).then(u),
  validate: (definitionId, value) =>
    apiClient.request(`/measurement-definitions/${definitionId}/validate?value=${encodeURIComponent(value)}`).then(u),
  create: (payload) =>
    apiClient.request('/measurement-definitions', { method: 'POST', body: payload }),
  update: (id, payload) =>
    apiClient.request(`/measurement-definitions/${id}`, { method: 'PUT', body: payload }),
  remove: (id) =>
    apiClient.request(`/measurement-definitions/${id}`, { method: 'DELETE' })
};

// Stage / Experiment Statistics (cho researcher tổng hợp)
export const statisticsApi = {
  // Thống kê theo giai đoạn
  byStage: (stageId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.request(`/experiments/stages/${stageId}/statistics${qs ? `?${qs}` : ''}`).then(u);
  },
  // Thống kê toàn experiment
  byExperiment: (experimentId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.request(`/experiments/${experimentId}/statistics${qs ? `?${qs}` : ''}`).then(u);
  },
  // Export CSV / XLSX
  export: (stageId, body) =>
    apiClient.request(`/experiments/stages/${stageId}/statistics/export`, {
      method: 'POST',
      body,
      // yêu cầu trả raw blob, không parse JSON
      responseType: 'blob'
    })
};

// ── Task Images ─────────────────────────────────────────────────────────────
// Multipart upload với File + đầy đủ metadata (experimentId, batchId, taskReportId, taskId, ...)

export const taskImagesApi = {
  upload: ({ file, imageUrl, caption, capturedAt, experimentId, batchId, taskReportId, taskId, tags, exif }) => {
    const formData = new FormData();
    if (file) formData.append('File', file);
    if (imageUrl) formData.append('imageUrl', imageUrl);
    if (caption) formData.append('caption', caption);
    if (capturedAt) formData.append('capturedAt', capturedAt);
    if (experimentId) formData.append('experimentId', experimentId);
    if (batchId) formData.append('batchId', batchId);
    if (taskReportId) formData.append('taskReportId', taskReportId);
    if (taskId) formData.append('taskId', taskId);
    if (tags) formData.append('tags', tags);
    if (exif) formData.append('exif', typeof exif === 'string' ? exif : JSON.stringify(exif));
    return apiClient.request('/task-images/upload', { method: 'POST', body: formData }).then(u);
  },
  create: (payload) =>
    apiClient.request('/task-images', { method: 'POST', body: payload }).then(u),
  getByTaskReport: (reportId) =>
    apiClient.request(`/task-images/task/${reportId}`).then(u),
  getByBatch: (batchId) =>
    apiClient.request(`/task-images/batch/${batchId}`).then(u),
  remove: (id) =>
    apiClient.request(`/task-images/${id}`, { method: 'DELETE' })
};

export const unwrapApiData = unwrapData;
