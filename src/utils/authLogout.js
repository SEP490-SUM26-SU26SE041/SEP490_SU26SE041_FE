// ── authLogout ─────────────────────────────────────────────────────────────────────
// Helper logout chuẩn: gọi API revoke token (nếu có) + clear localStorage + đóng socket
// + điều hướng về /login. Thay cho 5 ch� đang gọi localStorage.clear() rải rác.
//
// Lý do:
//  - Server có thể giữ refresh token → cần revoke để không bị reuse sau khi clear local
//  - WebSocket đang mở vẫn dùng JWT cũ → rò rỉ + có thể bị reject 401
//  - Cần thông báo React state (user context, socket, query cache) rằng user đã logout

import notificationSocket from '../services/notificationSocket';

export const authLogout = async ({ apiClient, navigate, reason } = {}) => {
  // 1. Đóng socket trước để không gửi nhầm message khi đã clear token
  try { notificationSocket?.disconnect?.(); } catch { /* silent */ }

  // 2. Gọi API logout (revoke server-side). Best-effort — fail vẫn cho logout local.
  try {
    if (apiClient?.request) {
      await apiClient.request('/Auth/logout', { method: 'POST' }).catch(() => {});
    }
  } catch { /* silent */ }

  // 3. Clear local state (chỉ xóa key cần thiết, không clear cache UI)
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  } catch { /* silent */ }

  // 4. Điều hướng về login
  if (navigate) {
    navigate('/login', { replace: true });
  } else {
    window.location.href = '/login';
  }

  return { success: true, reason: reason || 'manual' };
};

// Phiên bản đồng bộ (không chờ API) cho nút logout đơn giản
export const authLogoutSync = (navigate) => {
  try { notificationSocket?.disconnect?.(); } catch { /* silent */ }
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  } catch { /* silent */ }
  if (navigate) navigate('/login', { replace: true });
  else window.location.href = '/login';
};
