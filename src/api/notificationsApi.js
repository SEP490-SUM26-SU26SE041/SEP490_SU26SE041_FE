import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

export const notificationsApi = {
  getAll: (params = {}) => apiClient.request('/notifications', { params }).then(u),
  getUnreadCount: async () => {
    const result = await apiClient.request('/notifications/unread-count').then(u);
    return typeof result === 'number' ? result : result?.count ?? 0;
  },
  markRead: (id) => apiClient.request(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () => apiClient.request('/notifications/read-all', { method: 'PUT' })
};