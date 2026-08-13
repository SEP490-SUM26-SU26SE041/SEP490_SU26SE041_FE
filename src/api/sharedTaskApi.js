// Shared API endpoints used by Technician, Student, and Researcher
// (Tasks, Reports, Measurements, Images, Notifications)
import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

// ── Tasks (Technician / Student) ────────────────────────────────────────────────

export const tasksApi = {
  getMy: () => apiClient.request('/tasks/my').then(u),
  getToday: () => apiClient.request('/tasks/today').then(u),
  getUpcoming: (days = 7) =>
    apiClient.request('/tasks/upcoming', { params: { days } }).then(u),
  getOverdue: () => apiClient.request('/tasks/overdue').then(u),
  getById: (id) => apiClient.request(`/tasks/${id}`).then(u),
  getByExperiment: (experimentId) =>
    apiClient.request(`/tasks/experiment/${experimentId}`).then(u),
  getByStage: (stageId) =>
    apiClient.request(`/tasks/stage/${stageId}`).then(u),
  getByBatch: (batchId) =>
    apiClient.request(`/tasks/batch/${batchId}`).then(u),
  getAssignmentsMy: () =>
    apiClient.request('/tasks/assignments/my').then(u),

  // Trạng thái task
  start: (id) => apiClient.request(`/tasks/${id}/start`, { method: 'PATCH' }),
  complete: (id) => apiClient.request(`/tasks/${id}/complete`, { method: 'PATCH' }),
  cancel: (id) => apiClient.request(`/tasks/${id}/cancel`, { method: 'PATCH' })
};

// ── Task Reports ───────────────────────────────────────────────────────────────

export const taskReportsApi = {
  create: (payload) => apiClient.request('/task-reports', { method: 'POST', body: payload }),
  getByTask: (taskId) =>
    apiClient.request(`/task-reports/task/${taskId}`).then(u),
  getByBatch: (batchId) =>
    apiClient.request(`/task-reports/batch/${batchId}`).then(u),
  update: (id, payload) =>
    apiClient.request(`/task-reports/${id}`, { method: 'PUT', body: payload })
};

// ── Measurement Records ──────────────────────────────────────────────────────

export const measurementRecordsApi = {
  create: (payload) =>
    apiClient.request('/measurement-records', { method: 'POST', body: payload }),

  // Tạo nhiều record cùng lúc (bulk) — dùng cho form đo lường chuẩn theo MeasurementDefinition
  bulk: (payload) =>
    apiClient.request('/measurement-records/bulk', { method: 'POST', body: payload }).then(u),

  getByBatch: (batchId) =>
    apiClient.request(`/measurement-records/batch/${batchId}`).then(u),
  getByExperiment: (experimentId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const url = `/measurement-records/experiment/${experimentId}${qs ? `?${qs}` : ''}`;
    return apiClient.request(url).then(u);
  },
  update: (payload) =>
    apiClient.request(`/measurement-records/${payload.id}`, { method: 'PUT', body: payload }).then(u),
  remove: (id) =>
    apiClient.request(`/measurement-records/${id}`, { method: 'DELETE' })
};

// ── Task Images ───────────────────────────────────────────────────────────────

/**
 * Tạo TaskImage qua multipart/form-data.
 * BE yêu cầu (theo Swagger):
 *  - File (binary, multipart)
 *  - experimentId, batchId, taskReportId, taskId (text)
 *  - imageUrl (text, optional - nếu muốn dùng URL có sẵn)
 *  - caption (text, optional)
 *  - capturedAt (date-time, optional)
 *
 * @param {Object} params
 * @param {File}   params.file          File binary (multipart)
 * @param {string} params.imageUrl      URL Cloudinary (optional)
 * @param {string} params.caption
 * @param {string} params.capturedAt    ISO string
 * @param {string} params.experimentId
 * @param {string} params.batchId
 * @param {string} params.taskReportId
 * @param {string} params.taskId
 * @param {string} params.tags          (optional)
 * @param {Object} params.exif          (optional, JSON string)
 */
export const taskImagesApi = {
  /**
   * Upload multipart (BE sẽ parse File + metadata)
   */
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

  /**
   * Tạo TaskImage với JSON (cho case không cần upload file mới)
   */
  create: (payload) =>
    apiClient.request('/task-images', { method: 'POST', body: payload }).then(u),

  getByTaskReport: (reportId) =>
    apiClient.request(`/task-images/task/${reportId}`).then(u),
  getByBatch: (batchId) =>
    apiClient.request(`/task-images/batch/${batchId}`).then(u),
  remove: (id) =>
    apiClient.request(`/task-images/${id}`, { method: 'DELETE' })
};
