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
  getByBatch: (batchId) =>
    apiClient.request(`/measurement-records/batch/${batchId}`).then(u),
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
  remove: (id) =>
    apiClient.request(`/task-images/${id}`, { method: 'DELETE' })
};
