import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { notificationsApi } from '../../api/notificationsApi';
import notificationSocket from '../../services/notificationSocket';
import { useToast } from '../../context/ToastContext';

// Custom router (app dùng window event 'navigate' + pushState, không có react-router)
const appNavigate = (path) => {
  if (!path) return;
  window.history.pushState(null, '', path);
  window.dispatchEvent(new Event('navigate'));
};

// ── Constants & helpers ───────────────────────────────────────────────────────

const TYPE_META = {
  Task:       { icon: '📋', color: 'bg-blue-100 text-blue-700',    label: 'Tác vụ' },
  Experiment: { icon: '🧪', color: 'bg-indigo-100 text-indigo-700', label: 'Thí nghiệm' },
  Alert:      { icon: '⚠️', color: 'bg-rose-100 text-rose-700',    label: 'Cảnh báo' },
  System:     { icon: '🔔', color: 'bg-slate-100 text-slate-700',  label: 'Hệ thống' }
};

const PRIORITY_META = {
  Critical: { color: 'bg-rose-600', text: 'Khẩn cấp' },
  High:     { color: 'bg-orange-500', text: 'Cao' },
  Medium:   { color: 'bg-amber-500', text: 'Trung bình' },
  Low:      { color: 'bg-slate-400', text: 'Thấp' }
};

const getTypeMeta = (t) => TYPE_META[t] || TYPE_META.System;
const getPriorityMeta = (p) => PRIORITY_META[p] || PRIORITY_META.Medium;

const timeAgoVi = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Vừa xong';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} ngày trước`;
  return d.toLocaleDateString('vi-VN');
};

// Map referenceTable → route trong app
const referenceToPath = (refTable, refId) => {
  if (!refTable || !refId) return null;
  switch (refTable) {
    case 'Tasks':
      return `/personal-tasks?taskId=${refId}`;
    case 'Experiments':
      return `/experiments/${refId}`;
    case 'Alerts':
      return `/alerts/${refId}`;
    default:
      return null;
  }
};

// ── Component ─────────────────────────────────────────────────────────────────

const NotificationBell = ({ variant = 'light' }) => {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Fetch ban đầu (page 1) + unread count
  const fetchInitial = useCallback(async () => {
    try {
      setLoading(true);
      const [page, count] = await Promise.all([
        notificationsApi.getPaged(1, 20).catch(() => ({ items: [], totalCount: 0 })),
        notificationsApi.getUnreadCount().catch(() => 0)
      ]);
      const list = Array.isArray(page) ? page : (page?.items || []);
      setItems(list);
      setUnreadCount(Number(count?.count ?? count ?? 0));
    } catch (err) {
      console.warn('[NotificationBell] fetchInitial error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Mount: connect WS + fetch + theo dõi trạng thái
  useEffect(() => {
    notificationSocket.start();
    fetchInitial();

    const unsubStatus = notificationSocket.onStatusChange(setConnected);
    const unsubMsg = notificationSocket.subscribe((env) => {
      if (env?.event === 'Connected') return; // bỏ qua heartbeat
      if (env?.event === 'ReceiveNotification' && env.data) {
        const notif = env.data;
        setItems(prev => {
          if (prev.some(n => n.id === notif.id)) return prev;
          return [notif, ...prev].slice(0, 50);
        });
        if (!notif.isRead) setUnreadCount(c => c + 1);

        // Toast popup theo priority
        const priority = notif.priority || 'Medium';
        const variant = priority === 'Critical' ? 'error' :
                        priority === 'High' ? 'warning' :
                        priority === 'Medium' ? 'info' : 'info';
        showToast(`${notif.title || 'Thông báo mới'}${notif.message ? `: ${notif.message}` : ''}`, variant);
      }
    });

    return () => { unsubStatus(); unsubMsg(); };
  }, [fetchInitial, showToast]);

  // Click outside đóng dropdown
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      const inBtn = buttonRef.current?.contains(e.target);
      const inDropdown = document.getElementById('notif-bell-dropdown')?.contains(e.target);
      if (!inBtn && !inDropdown) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const handleToggle = () => {
    const willOpen = !open;
    if (willOpen) {
      // Tính vị trí neo dưới chuông (trên document.body qua portal)
      const btn = buttonRef.current?.getBoundingClientRect();
      if (btn) {
        const dropdownW = 400;
        // Neo sát mép phải chuông; nếu tràn viewport trái thì dịch vào
        let left = btn.right - dropdownW;
        const margin = 8;
        if (left < margin) left = margin;
        if (left + dropdownW > window.innerWidth - margin) left = window.innerWidth - dropdownW - margin;
        setPos({ top: btn.bottom + 8, left });
      }
      fetchInitial();
    }
    setOpen(willOpen);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setItems(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
      showToast('Đã đánh dấu tất cả là đã đọc', 'success');
    } catch (err) {
      showToast(err.message || 'Lỗi', 'error');
    }
  };

  const handleMarkOneRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n));
      setUnreadCount(c => Math.max(0, c - 1));
    } catch { /* silent */ }
  };

  const handleItemClick = (item) => {
    if (!item.isRead) handleMarkOneRead(item.id);
    const path = referenceToPath(item.referenceTable, item.referenceId);
    if (path) {
      setOpen(false);
      appNavigate(path);
    }
  };

  // Khi reconnect → fetch lại unread count vì server không push lại
  useEffect(() => {
    if (connected) {
      notificationsApi.getUnreadCount()
        .then(c => setUnreadCount(Number(c?.count ?? c ?? 0)))
        .catch(() => {});
    }
  }, [connected]);

  const sortedItems = useMemo(() => {
    // Sort unread trước, rồi theo createdAt desc
    return [...items].sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [items]);

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell button */}
      <button ref={buttonRef} onClick={handleToggle}
        className={`relative p-2 rounded-full transition-colors ${
          variant === 'dark'
            ? 'text-indigo-100 hover:bg-indigo-900/40 hover:text-white'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
        title="Thông báo"
        aria-label="Thông báo">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        <span className={`absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
          connected ? 'bg-emerald-500' : 'bg-slate-400'
        }`} title={connected ? 'Realtime connected' : 'Offline'} />
      </button>

      {/* Dropdown - portal để tránh clipping/stacking-context từ ancestor (fixed sidebar, etc.) */}
      {open && createPortal(
        <div id="notif-bell-dropdown"
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-[400px] max-h-[540px] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-fade-in">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div>
              <p className="text-sm font-bold text-slate-900">Thông Báo</p>
              <p className="text-[10px] text-slate-500">
                {unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Tất cả đã đọc'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 uppercase">
                Đọc hết
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1 overscroll-contain" style={{ maxHeight: 460 }}>
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Đang tải...</div>
            ) : sortedItems.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-3xl mb-2">🔕</p>
                <p className="text-sm font-semibold text-slate-700">Không có thông báo</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Bạn sẽ nhận được thông báo khi có task mới, sắp hết hạn, v.v.
                </p>
              </div>
            ) : (
              sortedItems.map(n => {
                const typeMeta = getTypeMeta(n.notificationType);
                const prioMeta = getPriorityMeta(n.priority);
                const isClickable = !!(n.referenceTable && n.referenceId);
                return (
                  <div key={n.id}
                    onClick={() => handleItemClick(n)}
                    className={`group flex gap-3 px-4 py-3 border-b border-slate-50 transition-colors ${
                      isClickable ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
                    } ${!n.isRead ? 'bg-blue-50/40' : ''}`}>
                    <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base ${typeMeta.color}`}>
                      {typeMeta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm truncate ${!n.isRead ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                          {n.title || typeMeta.label}
                        </p>
                        {!n.isRead && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full mt-1 shrink-0" />
                        )}
                      </div>
                      {n.message && (
                        <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{n.message}</p>
                      )}
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white ${prioMeta.color}`}>
                            {prioMeta.text}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {timeAgoVi(n.createdAtVietnam || n.createdAt)}
                          </span>
                        </div>
                        {isClickable && (
                          <span className="text-[9px] text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity uppercase">
                            Mở →
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 italic">
              {connected ? '🟢 Realtime' : '⚪ Offline'}
            </span>
            <button onClick={() => { setOpen(false); appNavigate('/notifications'); }}
              className="text-[10px] font-bold text-slate-600 hover:text-blue-600 uppercase">
              Xem tất cả →
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default NotificationBell;