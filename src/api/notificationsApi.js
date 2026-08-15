import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

// ── Notifications REST API ────────────────────────────────────────────────────
// Theo spec BE (Real-time Notification):
//   GET    /api/notifications?pageNumber=1&pageSize=20     — paged list
//   GET    /api/notifications/unread-count                 — { count: number }
//   PUT    /api/notifications/{id}/read                    — mark 1 as read
//   PUT    /api/notifications/read-all                     — mark all as read
//   POST   /api/notifications/test-push                    — test push (dev only)

export const notificationsApi = {
  getPaged: (pageNumber = 1, pageSize = 20) =>
    apiClient.request(`/notifications?pageNumber=${pageNumber}&pageSize=${pageSize}`).then(u),

  getUnreadCount: () =>
    apiClient.request('/notifications/unread-count').then(u),

  markAsRead: (id) =>
    apiClient.request(`/notifications/${id}/read`, { method: 'PUT' }),

  markAllAsRead: () =>
    apiClient.request('/notifications/read-all', { method: 'PUT' }),

  testPush: () =>
    apiClient.request('/notifications/test-push', { method: 'POST' })
};