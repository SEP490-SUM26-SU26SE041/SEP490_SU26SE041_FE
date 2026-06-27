import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

export const experimentRequestsApi = {
  getInbox: (status) =>
    apiClient.request('/experiment-requests/manager/inbox', { params: status ? { status } : {} }).then(u),
  getAll: (params = {}) =>
    apiClient.request('/experiment-requests', { params }).then(u),
  getById: (id) => apiClient.request(`/experiment-requests/${id}`).then(u),
  getResourceSummary: (id) => apiClient.request(`/experiment-requests/${id}/resource-summary`).then(u),
  getReservedBeds: (id) => apiClient.request(`/experiment-requests/${id}/reserved-beds`).then(u),
  review: (id, payload) =>
    apiClient.request(`/experiment-requests/${id}/review`, { method: 'POST', body: payload })
};

export const experimentsApi = {
  getAll: (params = {}) => apiClient.request('/experiments', { params }).then(u),
  getById: (id) => apiClient.request(`/experiments/${id}`).then(u),
  getStages: (id) => apiClient.request(`/experiments/${id}/stages`).then(u),
  getGroups: (id) => apiClient.request(`/experiments/${id}/groups`).then(u),
  getDesign: (id) => apiClient.request(`/experiments/${id}/design`).then(u),
  getMeasurements: (id) => apiClient.request(`/experiments/${id}/measurements`).then(u),
  getSchedules: (id) => apiClient.request(`/experiments/${id}/schedules`).then(u),
  getProcedureTemplates: (params = {}) =>
    apiClient.request('/experiments/procedure-templates', { params }).then(u)
};

export const unwrapApiData = unwrapData;