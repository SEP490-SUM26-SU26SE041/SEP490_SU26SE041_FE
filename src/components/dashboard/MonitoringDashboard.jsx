import React, { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { experimentsApi } from '../../api/experimentApi';
import { farmsApi } from '../../api/managerResourcesApi';
import { notificationsApi } from '../../api/notificationsApi';
import { LineChart, MultiLineChart, Gauge, StatusHeatmap } from '../../components/dashboard/Charts';

const HEALTH_STATUS = {
  healthy: { label: 'Khỏe mạnh', color: 'text-emerald-600', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  warning: { label: 'Cảnh báo', color: 'text-amber-600', bg: 'bg-amber-100', dot: 'bg-amber-500' },
  critical: { label: 'Nguy cấp', color: 'text-rose-600', bg: 'bg-rose-100', dot: 'bg-rose-500' },
  inactive: { label: 'Ngưng', color: 'text-slate-500', bg: 'bg-slate-100', dot: 'bg-slate-400' }
};

const generateSensorSeries = (base, variance, points = 24) => {
  const now = new Date();
  const data = [];
  for (let i = points - 1; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60 * 60 * 1000);
    data.push({
      label: `${t.getHours()}h`,
      value: Math.max(0, +(base + (Math.random() - 0.5) * variance + Math.sin(i / 3) * (variance / 2)).toFixed(1))
    });
  }
  return data;
};

const MonitoringDashboard = ({ scope = 'all', farmId = null }) => {
  const { showToast } = useToast();
  const [experiments, setExperiments] = useState([]);
  const [farms, setFarms] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());
  const [selectedFarm, setSelectedFarm] = useState(farmId || 'all');

  useEffect(() => {
    loadData();
    const interval = setInterval(() => setLastSync(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [expData, farmData, notifData] = await Promise.allSettled([
        experimentsApi.getAll(),
        farmsApi.getAll(),
        notificationsApi.getAll({ pageNumber: 1, pageSize: 10 })
      ]);
      setExperiments(expData.status === 'fulfilled' ? (Array.isArray(expData.value) ? expData.value : []) : []);
      setFarms(farmData.status === 'fulfilled' ? (Array.isArray(farmData.value) ? farmData.value : []) : []);
      const notifs = notifData.status === 'fulfilled' ? (notifData.value?.items || []) : [];
      setAlerts(notifs);
      setLastSync(new Date());
    } catch (err) {
      showToast('Không thể tải dữ liệu giám sát', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    showToast('Đã làm mới dữ liệu giám sát', 'success');
  };

  // Mock environmental sensor data (in a real app these would come from IoT endpoints)
  const temperature = generateSensorSeries(26.5, 4, 24);
  const humidity = generateSensorSeries(68, 12, 24);
  const soilMoisture = generateSensorSeries(62, 15, 24);
  const light = generateSensorSeries(18500, 6000, 24);

  // KPI calculations
  const activeExperiments = experiments.filter(e => e.status === 'Active').length;
  const healthyFarms = farms.length;
  const sensorCount = farms.length * 24; // mock: 24 sensors per farm
  const onlineSensors = Math.max(1, Math.floor(sensorCount * 0.94));

  // Farm health heatmap
  const heatmapCells = Array.from({ length: 48 }, (_, i) => {
    const r = Math.random();
    let status = 'healthy';
    if (r < 0.08) status = 'critical';
    else if (r < 0.22) status = 'warning';
    return {
      label: `Bed ${i + 1}`,
      status,
      value: Math.floor(Math.random() * 90) + 10
    };
  });

  // Alert summary
  const criticalAlerts = alerts.filter(a => a.severity === 'Critical' || a.severity === 'High').length;
  const warningAlerts = alerts.filter(a => a.severity === 'Medium' || a.severity === 'Warning').length;

  // Overall farm health
  const overallHealth = sensorCount > 0 ? Math.round((onlineSensors / sensorCount) * 100) : 0;
  const healthStatus = overallHealth >= 90 ? 'healthy' : overallHealth >= 70 ? 'warning' : 'critical';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Trực tiếp</span>
          </div>
          <span className="text-xs text-on-surface-variant">
            Cập nhật lần cuối: {lastSync.toLocaleTimeString('vi-VN')}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedFarm}
            onChange={e => setSelectedFarm(e.target.value)}
            className="px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Tất cả nông trại</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.name || f.farmName}</option>)}
          </select>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[#3d5728] transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            <svg className={refreshing ? 'animate-spin' : ''} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            {refreshing ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Sức Khỏe Tổng Thể</span>
            <span className={`w-2 h-2 rounded-full ${HEALTH_STATUS[healthStatus].dot} animate-pulse`}></span>
          </div>
          <div className="flex items-end gap-2">
            <span className="font-hanken text-3xl font-bold text-primary">{overallHealth}%</span>
            <span className={`text-[10px] font-bold uppercase mb-1 ${HEALTH_STATUS[healthStatus].color}`}>
              {HEALTH_STATUS[healthStatus].label}
            </span>
          </div>
          <div className="mt-3 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${overallHealth}%` }} />
          </div>
        </div>

        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Cảm Biến Hoạt Động</span>
          <div className="font-hanken text-3xl font-bold text-primary mt-3">
            {onlineSensors}<span className="text-base text-on-surface-variant">/{sensorCount}</span>
          </div>
          <p className="text-[10px] text-on-surface-variant mt-1">Đang trực tuyến</p>
        </div>

        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">TN Đang Chạy</span>
          <div className="font-hanken text-3xl font-bold text-emerald-600 mt-3">{activeExperiments}</div>
          <p className="text-[10px] text-on-surface-variant mt-1">Thí nghiệm hoạt động</p>
        </div>

        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Cảnh Báo Mới</span>
          <div className="font-hanken text-3xl font-bold text-rose-600 mt-3">
            {criticalAlerts + warningAlerts}
          </div>
          <p className="text-[10px] text-on-surface-variant mt-1">
            <span className="text-rose-600 font-bold">{criticalAlerts} nguy cấp</span> · {warningAlerts} cảnh báo
          </p>
        </div>
      </div>

      {/* Environmental sensors */}
      <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-hanken text-lg font-bold text-on-surface">Chỉ Số Môi Trường 24h</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Nhiệt độ · Độ ẩm · Độ ẩm đất · Ánh sáng</p>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full font-bold">Ổn định</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
                <span className="text-base">🌡️</span> Nhiệt độ (°C)
              </span>
              <span className="text-sm font-mono font-bold text-primary">
                {temperature[temperature.length - 1].value}°C
              </span>
            </div>
            <LineChart data={temperature} color="#ef4444" fillColor="rgba(239,68,68,0.1)" unit="°" height={140} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
                <span className="text-base">💧</span> Độ ẩm không khí (%)
              </span>
              <span className="text-sm font-mono font-bold text-primary">
                {humidity[humidity.length - 1].value}%
              </span>
            </div>
            <LineChart data={humidity} color="#3b82f6" fillColor="rgba(59,130,246,0.1)" unit="%" height={140} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
                <span className="text-base">🌱</span> Độ ẩm đất (%)
              </span>
              <span className="text-sm font-mono font-bold text-primary">
                {soilMoisture[soilMoisture.length - 1].value}%
              </span>
            </div>
            <LineChart data={soilMoisture} color="#486730" fillColor="rgba(72,103,48,0.1)" unit="%" height={140} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
                <span className="text-base">☀️</span> Cường độ sáng (lux)
              </span>
              <span className="text-sm font-mono font-bold text-primary">
                {Math.round(light[light.length - 1].value)}
              </span>
            </div>
            <LineChart data={light} color="#f59e0b" fillColor="rgba(245,158,11,0.1)" unit="" height={140} />
          </div>
        </div>
      </div>

      {/* Farm layout heatmap + experiments running */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-hanken text-lg font-bold text-on-surface">Bản Đồ Sức Khỏe Luống Trồng</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">48 luống · Cập nhật trực tiếp</p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span> Khỏe</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500"></span> Cảnh báo</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500"></span> Nguy cấp</span>
            </div>
          </div>
          <StatusHeatmap cells={heatmapCells} />
          <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-outline-variant">
            <div className="text-center">
              <p className="text-[10px] text-on-surface-variant font-bold uppercase">Khỏe mạnh</p>
              <p className="font-hanken text-xl font-bold text-emerald-600">
                {heatmapCells.filter(c => c.status === 'healthy').length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-on-surface-variant font-bold uppercase">Cảnh báo</p>
              <p className="font-hanken text-xl font-bold text-amber-600">
                {heatmapCells.filter(c => c.status === 'warning').length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-on-surface-variant font-bold uppercase">Nguy cấp</p>
              <p className="font-hanken text-xl font-bold text-rose-600">
                {heatmapCells.filter(c => c.status === 'critical').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
          <h3 className="font-hanken text-lg font-bold text-on-surface mb-1">Cảnh Báo Gần Đây</h3>
          <p className="text-xs text-on-surface-variant mb-4">Top sự kiện cần chú ý</p>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-surface-container-low rounded-xl animate-pulse" />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-10 text-center text-xs text-on-surface-variant">
              <div className="text-3xl mb-2">✅</div>
              <p>Không có cảnh báo nào</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {alerts.slice(0, 6).map((a, i) => (
                <div key={i} className={`p-3 rounded-xl border-l-4 ${
                  a.severity === 'Critical' || a.severity === 'High'
                    ? 'border-rose-500 bg-rose-50'
                    : 'border-amber-500 bg-amber-50'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-on-surface line-clamp-2">{a.title || a.message || 'Cảnh báo hệ thống'}</p>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      a.severity === 'Critical' || a.severity === 'High' ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-800'
                    }`}>
                      {a.severity || 'Warn'}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    {a.createdAt ? new Date(a.createdAt).toLocaleString('vi-VN') : 'Vừa xong'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active experiments summary */}
      <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-hanken text-lg font-bold text-on-surface">Thí Nghiệm Đang Theo Dõi</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Trạng thái thời gian thực các thí nghiệm đang chạy</p>
          </div>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-on-surface-variant">Đang tải...</div>
        ) : experiments.filter(e => e.status === 'Active').length === 0 ? (
          <div className="py-10 text-center text-xs text-on-surface-variant">
            <div className="text-3xl mb-2">🧪</div>
            <p>Không có thí nghiệm nào đang chạy.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {experiments.filter(e => e.status === 'Active').slice(0, 6).map(exp => (
              <div key={exp.id} className="border border-outline-variant rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] font-bold text-primary">{exp.experimentCode}</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full uppercase">
                    {exp.status}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-on-surface line-clamp-1 mb-1">{exp.title}</h4>
                <p className="text-[10px] text-on-surface-variant mb-3">
                  📍 {exp.farmName || '—'}
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-on-surface-variant">Tiến độ</span>
                    <span className="font-bold text-primary">{Math.floor(Math.random() * 60) + 30}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.floor(Math.random() * 60) + 30}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MonitoringDashboard;