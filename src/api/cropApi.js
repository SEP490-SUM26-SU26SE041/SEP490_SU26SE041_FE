// Crop and Variety API endpoints
import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

export const cropsApi = {
  getAll: () => apiClient.request('/crops').then(u),
  getById: (id) => apiClient.request(`/crops/${id}`).then(u),
  getVarieties: (cropId) =>
    apiClient.request(`/crops/crops/${cropId}/varieties`).then(u),
  getVarietyById: (id) =>
    apiClient.request(`/crops/varieties/${id}`).then(u)
};
