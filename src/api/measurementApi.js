import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

// ── Measurement Records ──────────────────────────────────────────────────────────

export const measurementRecordsApi = {
  create: (payload) =>
    apiClient.request('/measurement-records', { method: 'POST', body: payload }),

  // Tạo nhiều record cùng lúc (bulk) — dùng cho form đo lường chuẩn theo MeasurementDefinition
  bulk: (payload) =>
    apiClient.request('/measurement-records/bulk', { method: 'POST', body: payload }).then(u),

  getByBatch: (batchId) =>
    apiClient.request(`/measurement-records/batch/${batchId}`).then(u),
  getById: (id) =>
    apiClient.request(`/measurement-records/${id}`).then(u),
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

// ── Task Images ───────────────────────────────────────────────────────────────
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
  getById: (id) =>
    apiClient.request(`/task-images/${id}`).then(u),
  remove: (id) =>
    apiClient.request(`/task-images/${id}`, { method: 'DELETE' })
};
