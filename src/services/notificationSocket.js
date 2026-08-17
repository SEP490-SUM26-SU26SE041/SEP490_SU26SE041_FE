// ── Real-time Notification: Raw WebSocket Client ─────────────────────────────
// Theo spec BE:
//   - Endpoint: wss://<host>/ws?token=<JWT>
//   - Auth: JWT truyền qua query string `?token=`
//   - Server ping mỗi 30s (client tự keep-alive bằng cách giữ socket mở)
//   - Envelope:
//       { event: string, data: T, ts: ISO, tsVietnam: ISO+07:00 }
//
// Events đang push:
//   - "Connected"          → data: { userId }
//   - "ReceiveNotification" → data: NotificationDto
//
// Lưu ý:
//   - Server KHÔNG push lại notification cũ khi reconnect → FE phải
//     fetch lại unread-count qua REST sau khi reconnect.
//   - Token hết hạn → server close (401) → cần refresh token rồi reconnect.

import { API_ORIGIN } from '../api/apiClient';

const RECONNECT_DELAYS_MS = [3000, 5000, 15000, 30000, 60000, 120000, 300000]; // back-off: 3s → 5min
const MAX_RECONNECT_ATTEMPTS = 10; // sau 10 lần thất bại → dừng hẳn, tránh spam server đang down

class NotificationSocket {
  constructor() {
    this.ws = null;
    this.subscribers = new Set();
    this.statusListeners = new Set();
    this.shouldRun = false;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.connected = false;
    this.lastTokenUsed = null;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  // Bắt đầu kết nối. Idempotent — nếu token chưa đổi và socket đang Connected thì skip.
  // Sync API (không throw ra ngoài); lỗi được nuốt & tự schedule reconnect.
  start() {
    this.shouldRun = true;
    try {
      this._connect();
    } catch (err) {
      console.warn('[notificationSocket] start failed:', err?.message || err);
      this._scheduleReconnect();
    }
    return true;
  }

  async stop() {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(1000, 'client_stop'); } catch { /* noop */ }
      this.ws = null;
    }
    this._setConnected(false);
    this.lastTokenUsed = null;
  }

  // ── Subscribe API ─────────────────────────────────────────────────────────

  // Lắng nghe message (envelope). Trả về hàm unsubscribe.
  subscribe(handler) {
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  // Lắng nghe thay đổi trạng thái kết nối (boolean). Trả về hàm unsubscribe.
  onStatusChange(listener) {
    this.statusListeners.add(listener);
    listener(this.connected); // emit current state ngay
    return () => this.statusListeners.delete(listener);
  }

  isConnected() {
    return this.connected;
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  _setConnected(v) {
    if (this.connected === v) return;
    this.connected = v;
    this.statusListeners.forEach(fn => {
      try { fn(v); } catch { /* noop */ }
    });
  }

  _getToken() {
    try { return localStorage.getItem('token'); } catch { return null; }
  }

  _resolveUrl() {
    const token = this._getToken();
    if (!token) return null;
    const base = (import.meta.env.VITE_API_ORIGIN) || API_ORIGIN;
    const wsBase = base.replace(/^http/i, 'ws'); // http→ws, https→wss
    return `${wsBase}/ws?token=${encodeURIComponent(token)}`;
  }

  _connect() {
    if (!this.shouldRun) return;
    const token = this._getToken();
    if (!token) return;

    // Nếu socket đang mở với cùng token → skip
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.lastTokenUsed === token) return;
    // Đóng cái cũ nếu còn
    if (this.ws) {
      try { this.ws.close(); } catch { /* noop */ }
      this.ws = null;
    }

    const url = this._resolveUrl();
    if (!url) return;

    let ws;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.warn('[notificationSocket] WebSocket ctor failed:', err.message);
      this._scheduleReconnect();
      return;
    }

    this.ws = ws;
    this.lastTokenUsed = token;

    ws.onopen = () => {
      console.log('[WS] Connected');
      this.reconnectAttempt = 0;
      this._setConnected(true);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    ws.onmessage = (event) => {
      let env;
      try { env = JSON.parse(event.data); }
      catch (err) { console.warn('[WS] parse error:', err); return; }
      if (!env || typeof env !== 'object') return;
      this.subscribers.forEach(fn => {
        try { fn(env); } catch (err) { console.warn('[WS] subscriber error', err); }
      });
    };

    ws.onerror = (e) => {
      console.warn('[WS] error', e?.message || e);
    };

    ws.onclose = (e) => {
      console.log(`[WS] Closed (code=${e.code}, reason=${e.reason})`);
      this._setConnected(false);
      this.ws = null;
      if (this.shouldRun) this._scheduleReconnect();
    };
  }

  _scheduleReconnect() {
    if (!this.shouldRun) return;
    if (this.reconnectTimer) return;

    // P0 fix: sau nhiều lần fail → dừng reconnect, tránh làm treo browser + spam server đang down
    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(`[WS] Đã thử reconnect ${MAX_RECONNECT_ATTEMPTS} lần — dừng. Reload trang hoặc đợi server để thử lại.`);
      this.shouldRun = false;
      this._setConnected(false);
      return;
    }

    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, delay);
  }
}

// Singleton — chỉ tạo 1 instance cho cả app
const socket = new NotificationSocket();
// Alias disconnect() = stop() cho helper authLogout dùng
socket.disconnect = socket.stop.bind(socket);
export default socket;