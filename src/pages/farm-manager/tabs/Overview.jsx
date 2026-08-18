import React, { useEffect, useMemo, useState } from 'react';
import { farmsApi, areasApi, bedsApi } from '../../../api/managerResourcesApi';
import { experimentRequestsApi } from '../../../api/experimentApi';
import { notificationsApi } from '../../../api/notificationsApi';
import { StatCard, Card, SectionTitle, StatusPill } from '../components/ui';
import { useToast } from '../../../context/ToastContext';
import { LineChart, BarChart, Gauge } from '../../../components/dashboard/Charts';

const STATUS_COLORS = {
  Available: '#10b981',
  InUse: '#486730',
  Maintenance: '#f59e0b',
  Unavailable: '#f43f5e',
  Occupied: '#486730',
  Pending: '#f59e0b',
  Approved: '#3b82f6',
  Rejected: '#f43f5e'
};

const STATUS_LABELS = {
  Available: 'Trống',
  InUse: 'Đang Sử Dụng',
  Maintenance: 'Bảo Trì',
  Unavailable: 'Không Khả Dụng',
  Occupied: 'Đã Có',
  Pending: 'Chờ Duyệt',
  Approved: 'Đã Duyệt',
  Rejected: 'Từ Chối',
  Active: 'Hoạt Động',
  High: 'Cao',
  Medium: 'Trung Bình',
  Low: 'Thấp'
};

const Overview = ({ setActiveTab, setUnreadCount }) => {
  const { showToast } = useToast();
  const [stats, setStats] = useState({ farms: 0, areas: 0, beds: 0, pending: 0 });
  const [farmList, setFarmList] = useState([]);
  const [allAreas, setAllAreas] = useState([]);
  const [allBeds, setAllBeds] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const farms = await farmsApi.getMyFarms();
        const farmArr = Array.isArray(farms) ? farms : [];
        setFarmList(farmArr);

        const areaResults = await Promise.allSettled(
          farmArr.map(f => areasApi.getByFarm(f.id))
        );
        const bedResults = await Promise.allSettled(
          farmArr.map(f => bedsApi.getAvailableByFarm(f.id))
        );

        const areas = [];
        areaResults.forEach(r => {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) areas.push(...r.value);
        });
        const beds = [];
        bedResults.forEach(r => {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) beds.push(...r.value);
        });
        setAllAreas(areas);
        setAllBeds(beds);

        const totalAreas = areas.length;

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
          farms: farmArr.length,
          areas: totalAreas,
          beds: beds.length,
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

  // ---- Chart data: bed allocation status ----
  const bedStatusDistribution = useMemo(() => {
    const counts = {};
    allBeds.forEach(b => {
      const status = b.allocationStatus || 'Available';
      counts[status] = (counts[status] || 0) + 1;
    });
    const order = ['Available', 'InUse', 'Maintenance', 'Unavailable'];
    return order
      .filter(s => counts[s])
      .map(s => ({
        label: STATUS_LABELS[s] || s,
        value: counts[s],
        color: STATUS_COLORS[s] || '#64748b'
      }));
  }, [allBeds]);

  // ---- Chart data: areas per farm ----
  const areasPerFarm = useMemo(() => {
    return farmList.map(f => ({
      label: f.farmName || f.name || 'Nông trại',
      value: allAreas.filter(a => a.farmId === f.id).length
    })).sort((a, b) => b.value - a.value);
  }, [farmList, allAreas]);

  // ---- Chart data: beds per farm ----
  const bedsPerFarm = useMemo(() => {
    return farmList.map(f => ({
      label: f.farmName || f.name || 'Nông trại',
      value: allBeds.filter(b => b.farmId === f.id).length || 0
    })).sort((a, b) => b.value - a.value);
  }, [farmList, allBeds]);

  // ---- Chart data: pending requests trend (last 7 days) ----
  const pendingTrend = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const count = pendingRequests.filter(r => {
        if (!r.createdAt) return false;
        const created = new Date(r.createdAt);
        return created >= dayStart && created < dayEnd;
      }).length;
      days.push({ label, value: count });
    }
    return days;
  }, [pendingRequests]);

  // ---- Gauge: bed utilization ----
  const bedUtilization = useMemo(() => {
    const total = allBeds.length;
    if (total === 0) return 0;
    const inUse = allBeds.filter(b => b.allocationStatus === 'InUse' || b.allocationStatus === 'Occupied').length;
    return Math.round((inUse / total) * 100);
  }, [allBeds]);

  // ---- Gauge: pending request pressure ----
  const pendingPressure = useMemo(() => {
    const total = stats.pending + 10;
    if (total === 0) return 0;
    return Math.min(100, Math.round((stats.pending / total) * 100));
  }, [stats.pending]);

  // ---- Custom donut chart (SVG) ----
  const DonutChart = ({ data, size = 160 }) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) {
      return (
        <div className="h-40 flex items-center justify-center text-xs text-on-surface-variant italic">
          Chưa có dữ liệu
        </div>
      );
    }
    const radius = (size - 16) / 2;
    const cx = size / 2;
    const cy = size / 2;
    let cumulative = 0;
    const slices = data.map((d, i) => {
      const fraction = d.value / total;
      const startAngle = cumulative * 360;
      cumulative += fraction;
      const endAngle = cumulative * 360;
      const startRad = (startAngle - 90) * Math.PI / 180;
      const endRad = (endAngle - 90) * Math.PI / 180;
      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);
      const largeArc = fraction > 0.5 ? 1 : 0;
      return (
        <path
          key={i}
          d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
          fill={d.color}
          className="hover:opacity-80 transition-opacity cursor-pointer"
        >
          <title>{d.label}: {d.value} ({Math.round(fraction * 100)}%)</title>
        </path>
      );
    });
    return (
      <div className="flex items-center gap-4">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices}
          <circle cx={cx} cy={cy} r={radius * 0.6} fill="white" />
          <text x={cx} y={cy - 2} textAnchor="middle" fontSize="20" fontWeight="700"
            fill="#1a1c1c" fontFamily="Hanken Grotesk, sans-serif">
            {total}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="8" fontWeight="700"
            fill="#64748b" fontFamily="Inter, sans-serif" letterSpacing="1">
            TỔNG
          </text>
        </svg>
        <div className="flex-1 space-y-1.5">
          {data.map((d, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: d.color }}></span>
                <span className="truncate font-semibold text-on-surface">{d.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-on-surface">{d.value}</span>
                <span className="text-on-surface-variant text-[10px]">
                  ({Math.round((d.value / total) * 100)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col animate-fade-in w-full">
      <div className="px-6 lg:px-12 py-6 lg:py-10 space-y-6 lg:space-y-10">
        {/* Stats */}
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

        {/* Charts Row 1: Donut + Gauges */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bed Allocation Status */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🛏️</span>
              <h3 className="font-hanken font-bold text-on-surface">Trạng Thái Luống</h3>
            </div>
            {loading ? (
              <div className="h-40 flex items-center justify-center text-sm text-on-surface-variant">Đang tải...</div>
            ) : (
              <DonutChart data={bedStatusDistribution} />
            )}
          </Card>

          {/* Bed Utilization Gauge */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📊</span>
              <h3 className="font-hanken font-bold text-on-surface">Tỷ Lệ Sử Dụng Luống</h3>
            </div>
            {loading ? (
              <div className="h-32 flex items-center justify-center text-sm text-on-surface-variant">Đang tải...</div>
            ) : (
              <div className="flex justify-center py-2">
                <Gauge value={bedUtilization} max={100} color="#486730" size={130} label="Đang dùng / Tổng số" />
              </div>
            )}
            <p className="text-center text-xs text-on-surface-variant mt-3">
              {allBeds.filter(b => b.allocationStatus === 'InUse' || b.allocationStatus === 'Occupied').length} / {allBeds.length} luống
            </p>
          </Card>

          {/* Pending Request Gauge */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">⏳</span>
              <h3 className="font-hanken font-bold text-on-surface">Áp Lực Yêu Cầu</h3>
            </div>
            {loading ? (
              <div className="h-32 flex items-center justify-center text-sm text-on-surface-variant">Đang tải...</div>
            ) : (
              <div className="flex justify-center py-2">
                <Gauge value={stats.pending} max={Math.max(20, stats.pending)} color="#f59e0b" size={130} label="Yêu cầu đang chờ" />
              </div>
            )}
            <p className="text-center text-xs text-on-surface-variant mt-3">
              {stats.pending} yêu cầu cần duyệt
            </p>
          </Card>
        </div>

        {/* Charts Row 2: Distribution by farm */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🏡</span>
              <h3 className="font-hanken font-bold text-on-surface">Khu Vực Theo Nông Trại</h3>
            </div>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-sm text-on-surface-variant">Đang tải...</div>
            ) : areasPerFarm.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-on-surface-variant italic">
                Chưa có dữ liệu
              </div>
            ) : (
              <BarChart data={areasPerFarm} color="#486730" height={180} />
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🛏️</span>
              <h3 className="font-hanken font-bold text-on-surface">Luống Trống Theo Nông Trại</h3>
            </div>
            {loading ? (
              <div className="h-48 flex items-center justify-center text-sm text-on-surface-variant">Đang tải...</div>
            ) : bedsPerFarm.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-on-surface-variant italic">
                Chưa có dữ liệu
              </div>
            ) : (
              <BarChart data={bedsPerFarm} color="#10b981" height={180} />
            )}
          </Card>
        </div>

        {/* Charts Row 3: Pending requests trend */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📈</span>
            <h3 className="font-hanken font-bold text-on-surface">Yêu Cầu Trong 7 Ngày Qua</h3>
          </div>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-sm text-on-surface-variant">Đang tải...</div>
          ) : (
            <LineChart data={pendingTrend} color="#f59e0b" height={180} />
          )}
          <p className="text-[10px] text-on-surface-variant text-center mt-2">
            Tổng: {pendingTrend.reduce((s, d) => s + d.value, 0)} yêu cầu trong 7 ngày
          </p>
        </Card>

        {/* Recent activity lists */}
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
