import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

// ── Experiments (read-only) ─────────────────────────────────────────────────────

export const experimentsApi = {
  getAll: (params = {}) =>
    apiClient.request('/experiments', { params }).then(u),
  getById: (id) =>
    apiClient.request(`/experiments/${id}`).then(u),
  getStages: (expId) =>
    apiClient.request(`/experiments/${expId}/stages`).then(u),
  getGroups: (expId) =>
    apiClient.request(`/experiments/${expId}/groups`).then(u),
  getDesign: (expId) =>
    apiClient.request(`/experiments/${expId}/design`).then(u),
  getMeasurements: (expId) =>
    apiClient.request(`/experiments/${expId}/measurements`).then(u),
  getSchedules: (expId) =>
    apiClient.request(`/experiments/${expId}/schedules`).then(u),
  getProcedureTemplates: () =>
    apiClient.request('/experiments/procedure-templates').then(u)
};

// ── Farms (read-only) ─────────────────────────────────────────────────────────

export const farmsApi = {
  getAll: () =>
    apiClient.request('/farms').then(u),
  getById: (id) =>
    apiClient.request(`/farms/farms/${id}`).then(u),
  getAreas: (farmId) =>
    apiClient.request(`/farms/farms/${farmId}/areas`).then(u),
  getBeds: (areaId) =>
    apiClient.request(`/farms/areas/${areaId}/beds`).then(u)
};

// ── Crops (read-only) ─────────────────────────────────────────────────────────

export const cropsApi = {
  getAll: () =>
    apiClient.request('/crops').then(u),
  getById: (id) =>
    apiClient.request(`/crops/${id}`).then(u),
  getVarieties: (cropId) =>
    apiClient.request(`/crops/crops/${cropId}/varieties`).then(u),
  getVarietyById: (id) =>
    apiClient.request(`/crops/varieties/${id}`).then(u)
};
