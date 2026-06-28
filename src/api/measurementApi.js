import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

// ── Measurement Records ──────────────────────────────────────────────────────────

export const measurementRecordsApi = {
  create: (payload) =>
    apiClient.request('/measurement-records', { method: 'POST', body: payload }),
  getByBatch: (batchId) =>
    apiClient.request(`/measurement-records/batch/${batchId}`).then(u),
  getById: (id) =>
    apiClient.request(`/measurement-records/${id}`).then(u),
  update: (id, payload) =>
    apiClient.request(`/measurement-records/${id}`, { method: 'PUT', body: payload }),
  remove: (id) =>
    apiClient.request(`/measurement-records/${id}`, { method: 'DELETE' })
};

// ── Task Images ───────────────────────────────────────────────────────────────

export const taskImagesApi = {
  upload: (payload) =>
    apiClient.request('/task-images/upload', { method: 'POST', body: payload }),
  getByTaskReport: (reportId) =>
    apiClient.request(`/task-images/task/${reportId}`).then(u),
  getByBatch: (batchId) =>
    apiClient.request(`/task-images/batch/${batchId}`).then(u),
  getById: (id) =>
    apiClient.request(`/task-images/${id}`).then(u),
  remove: (id) =>
    apiClient.request(`/task-images/${id}`, { method: 'DELETE' })
};
