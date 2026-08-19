import React, { useEffect, useState } from 'react';
import { notificationsApi } from '../../../api/notificationsApi';
import { useToast } from '../../../context/ToastContext';
import { Card, SectionTitle, StatusPill, EmptyState, OutlineButton, PrimaryButton } from '../components/ui';

const Notifications = ({ setUnreadCount }) => {
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  const pageSize = 15;

  const fetch = async (p = page) => {
    try {
      setLoading(true);
      const data = await notificationsApi.getPaged(p, pageSize);
      setNotifications(data?.items ?? []);
      setTotal(data?.totalCount ?? 0);
    } catch (err) {
      showToast(err.message || 'Không thể tải thông báo', 'error');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(1); setPage(1); }, []);

  const handleMarkRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      showToast('Đã đánh dấu tất cả đã đọc', 'success');
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật', 'error');
    }
  };

  const filtered = filter === 'unread'
    ? notifications.filter(n => !n.isRead)
    : notifications;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col animate-fade-in w-full">
      <div className="px-6 lg:px-12 py-6 lg:py-10 space-y-6 lg:space-y-10">
        <SectionTitle
          title="Thông Báo"
          description="Tất cả thông báo hệ thống gửi đến bạn"
          action={
            <PrimaryButton
              onClick={handleMarkAllRead}
              icon={<CheckIcon />}
            >
              Đánh Dấu Tất Cả Đã Đọc
            </PrimaryButton>
          }
        />

        <div className="flex gap-2 bg-white border border-outline-variant rounded-xl p-2 shadow-sm w-fit">
          <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>Tất Cả ({total})</FilterBtn>
          <FilterBtn
            active={filter === 'unread'}
            onClick={() => setFilter('unread')}
          >
            Chưa Đọc ({notifications.filter(n => !n.isRead).length})
          </FilterBtn>
        </div>

        <Card className="overflow-hidden">
          <div className="divide-y divide-outline-variant">
            {loading ? (
              <div className="p-8 text-center text-sm text-on-surface-variant">Đang tải...</div>
            ) : filtered.length === 0 ? (
              <EmptyState message="Không có thông báo nào." />
            ) : (
              filtered.map(n => (
                <div
                  key={n.id}
                  className={`p-5 flex items-start gap-4 hover:bg-surface-container/30 transition-colors ${!n.isRead ? 'bg-primary-container/10' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${!n.isRead ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                    <BellIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-on-surface">{n.title}</span>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary" />}
                        <StatusPill status={n.priority} />
                        {n.notificationType && (
                          <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider">{n.notificationType}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-on-surface-variant font-mono shrink-0">
                        {new Date(n.createdAt).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">{n.message}</p>
                    <div className="mt-3 flex items-center gap-2">
                      {!n.isRead && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="text-[10px] font-bold uppercase text-primary hover:underline tracking-wider"
                        >
                          Đánh dấu đã đọc
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="p-4 border-t border-outline-variant bg-surface-container-low/40 flex justify-between items-center">
              <span className="text-xs font-bold text-on-surface-variant">
                Trang {page} / {totalPages} • Tổng: {total}
              </span>
              <div className="flex gap-2">
                <OutlineButton
                  onClick={() => { const np = Math.max(1, page - 1); setPage(np); fetch(np); }}
                  disabled={page === 1}
                >
                  Trang Trước
                </OutlineButton>
                <div className="px-4 py-2 font-mono text-sm font-bold bg-white border border-outline-variant rounded-lg">
                  {page}
                </div>
                <OutlineButton
                  onClick={() => { const np = page + 1; setPage(np); fetch(np); }}
                  disabled={page >= totalPages}
                >
                  Trang Sau
                </OutlineButton>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

const FilterBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${active ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container'}`}
  >
    {children}
  </button>
);

const BellIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

export default Notifications;
