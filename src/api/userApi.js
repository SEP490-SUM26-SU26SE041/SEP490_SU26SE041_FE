import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

export const userApi = {
  getUsers: (params = {}) =>
    apiClient.request('/Users', { params }).then(u),
  getRoles: () =>
    apiClient.request('/Roles').then(u),
  createUser: (userData) =>
    apiClient.request('/Users', { method: 'POST', body: userData }),
  updateUser: (id, userData) =>
    apiClient.request(`/Users/${id}`, { method: 'PUT', body: userData }),
  toggleStatus: (id) =>
    apiClient.request(`/Users/${id}/toggle-status`, { method: 'PUT' }),
  deleteUser: (id) =>
    apiClient.request(`/Users/${id}`, { method: 'DELETE' })
};
