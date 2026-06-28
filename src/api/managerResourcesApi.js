import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

export const farmsApi = {
  getMyFarms: () => apiClient.request('/farms/my-farms').then(u),
  getAll: () => apiClient.request('/farms').then(u),
  getById: (id) => apiClient.request('/farms/' + id).then(u),
  create: (payload) => apiClient.request('/farms', { method: 'POST', body: payload }),
  update: (id, payload) => apiClient.request('/farms/' + id, { method: 'PUT', body: payload }),
  assignManager: (farmId, managerId) =>
    apiClient.request('/farms/' + farmId + '/manager/' + managerId, { method: 'POST' }),
  remove: (id) => apiClient.request('/farms/' + id, { method: 'DELETE' })
};

export const areasApi = {
  getByFarm: (farmId) => apiClient.request('/farms/' + farmId + '/areas').then(u),
  getById: (id) => apiClient.request('/farms/areas/' + id).then(u),
  create: (payload) => apiClient.request('/farms/areas', { method: 'POST', body: payload }),
  update: (id, payload) => apiClient.request('/farms/areas/' + id, { method: 'PUT', body: payload }),
  remove: (id) => apiClient.request('/farms/areas/' + id, { method: 'DELETE' })
};

export const bedsApi = {
  getByArea: (areaId) => apiClient.request('/farms/areas/' + areaId + '/beds').then(u),
  getAvailableByFarm: (farmId) => apiClient.request('/farms/' + farmId + '/beds/available').then(u),
  getById: (id) => apiClient.request('/farms/beds/' + id).then(u),
  create: (payload) => apiClient.request('/farms/beds', { method: 'POST', body: payload }),
  update: (id, payload) => apiClient.request('/farms/beds/' + id, { method: 'PUT', body: payload }),
  remove: (id) => apiClient.request('/farms/beds/' + id, { method: 'DELETE' })
};

export const bedAssignmentsApi = {
  getByExperiment: (experimentId) =>
    apiClient.request('/farms/experiments/' + experimentId + '/bed-assignments').then(u),
  getById: (id) => apiClient.request('/farms/bed-assignments/' + id).then(u),
  create: (payload) =>
    apiClient.request('/farms/bed-assignments', { method: 'POST', body: payload }),
  update: (id, payload) =>
    apiClient.request('/farms/bed-assignments/' + id, { method: 'PUT', body: payload }),
  remove: (id) => apiClient.request('/farms/bed-assignments/' + id, { method: 'DELETE' })
};

export const unwrapList = unwrapData;
