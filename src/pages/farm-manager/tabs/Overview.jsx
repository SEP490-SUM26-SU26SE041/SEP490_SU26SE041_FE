import React, { useEffect, useState } from 'react';
import { farmsApi, areasApi, bedsApi } from '../../../api/managerResourcesApi';
import { experimentRequestsApi } from '../../../api/experimentApi';
import { notificationsApi } from '../../../api/notificationsApi';
import { StatCard, Card, SectionTitle, StatusPill, LoadingRows } from '../components/ui';
import { useToast } from '../../../context/ToastContext';

const Overview = ({ setActiveTab, setUnreadCount }) => {
  const { showToast } = useToast();
  const [stats, setStats] = useState({ farms: 0, areas: 0, beds: 0, pending: 0 });
  const [pendingRequests, setPendingRequests] = useState([]);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const farms = await farmsApi.getMyFarms();
        const farmList = Array.isArray(farms) ? farms : [];
        const areaResults = await Promise.allSettled(
          farmList.map(f => areasApi.getByFarm(f.id))
        );
        const bedResults = await Promise.allSettled(
          farmList.map(f => bedsApi.getAvailableByFarm(f.id))
        );
        const totalAreas = areaResults.reduce((acc, r) => acc + (Array.isArray(r.value) ? r.value.length : 0), 0);
        const availableBeds = bedResults.reduce((acc, r) => acc + (Array.isArray(r.value) ? r.value.length : 0), 0);

        let pending = [];
        try {
          const inbox = await experimentRequestsApi.getInbox('Pending');
          const data = inbox?.data ?? inbox ?? [];
          pending = Array.isArray(data) ? data : [];
        } catch {
          pending = [];
        }

        let notifs = [];
        try {
          const res = await notificationsApi.getAll({ pageNumber: 1, pageSize: 5 });
          notifs = res?.items ?? [];
        } catch {
          notifs = [];
        }

        setStats({
          farms: farmList.length,
          areas: totalAreas,
          beds: availableBeds,
          pending: pending.length
        });
        setPendingRequests(pending.slice(0, 5));
        setRecentNotifications(notifs);
      } catch (err) {
        showToast(err.message || 'Không thể tải dữ liệu tổng quan', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="flex flex-col animate-fade-in w-full">
      <div className="px-6 lg:px-12 py-6 lg:py-10 space-y-6 lg:space-y-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <StatCard label="Nông Trại Của Tôi" value={loading ? '...' : stats.farms} sub="Đang quản lý" />
          <StatCard label="Khu Vực" value={loading ? '...' : stats.areas} sub="Tổng cộng" />
          <StatCard label="Luống Trống" value={loading ? '...' : stats.beds} sub="Sẵn sàng sử dụng" />
          <StatCard
            label="Yêu Cầu Chờ Duyệt"
            value={loading ? '...' : stats.pending}
            color="text-tertiary"
            sub="Cần xử lý ngay"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <SectionTitle
              title="Yêu Cầu Thí Nghiệm Mới"
              description="Các yêu cầu đang chờ bạn phê duyệt"
              action={
                <button
                  onClick={() => setActiveTab('requests')}
                  className="text-[10px] font-bold uppercase text-primary hover:underline tracking-wider"
                >
                  Xem tất cả →
                </button>
              }
            />
            <div className="mt-6 space-y-3">
              {loading ? (
                <div className="text-xs text-on-surface-variant py-4">Đang tải...</div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-xs text-on-surface-variant py-4">Không có yêu cầu nào đang chờ.</div>
              ) : (
                pendingRequests.map(req => (
                  <button
                    key={req.id}
                    onClick={() => setActiveTab('requests')}
                    className="w-full text-left p-4 rounded-xl border border-outline-variant hover:border-primary hover:bg-surface-container/40 transition-all group"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">{req.title}</div>
                        <div className="text-[10px] text-on-surface-variant mt-1">
                          {req.researcherName} • {req.farmName}
                        </div>
                      </div>
                      <StatusPill status={req.status} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle
              title="Thông Báo Gần Đây"
              description="Cập nhật từ hệ thống"
              action={
                <button
                  onClick={async () => {
                    try {
                      await notificationsApi.markAllRead();
                      setUnreadCount(0);
                      showToast('Đã đánh dấu tất cả đã đọc', 'success');
                      setRecentNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                    } catch (err) {
                      showToast(err.message || 'Lỗi', 'error');
                    }
                  }}
                  className="text-[10px] font-bold uppercase text-primary hover:underline tracking-wider"
                >
                  Đánh dấu tất cả đã đọc
                </button>
              }
            />
            <div className="mt-6 space-y-3">
              {loading ? (
                <div className="text-xs text-on-surface-variant py-4">Đang tải...</div>
              ) : recentNotifications.length === 0 ? (
                <div className="text-xs text-on-surface-variant py-4">Chưa có thông báo nào.</div>
              ) : (
                recentNotifications.map(n => (
                  <div
                    key={n.id}
                    className={`p-4 rounded-xl border transition-all ${n.isRead ? 'border-outline-variant bg-white' : 'border-primary/30 bg-primary-container/20'}`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="font-bold text-sm text-on-surface flex items-center gap-2">
                          {n.title}
                          {!n.isRead && <span className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <div className="text-xs text-on-surface-variant mt-1 line-clamp-2">{n.message}</div>
                        <div className="text-[10px] text-on-surface-variant mt-2 font-mono">
                          {new Date(n.createdAt).toLocaleString('vi-VN')}
                        </div>
                      </div>
                      <StatusPill status={n.priority} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Overview;
