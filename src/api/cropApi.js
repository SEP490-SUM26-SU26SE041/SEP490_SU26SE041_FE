// Crop and Variety API endpoints
import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

export const cropsApi = {
  getAll: () => apiClient.request('/crops').then(u),
  getById: (id) => apiClient.request(`/crops/${id}`).then(u),
  create: (payload) => apiClient.request('/crops', { method: 'POST', body: payload }).then(u),
  delete: (id) => apiClient.request(`/crops/${id}`, { method: 'DELETE' }),

  // Varieties
  getVarieties: (cropId) =>
    apiClient.request(`/crops/crops/${cropId}/varieties`).then(u),
  getVarietyById: (id) =>
    apiClient.request(`/crops/varieties/${id}`).then(u),
  createVariety: (payload) =>
    apiClient.request('/crops/varieties', { method: 'POST', body: payload }).then(u),
  deleteVariety: (id) =>
    apiClient.request(`/crops/varieties/${id}`, { method: 'DELETE' })
};
