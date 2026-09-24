import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { farmsApi } from '../../api/managerResourcesApi';
import {
  iotDevicesApi,
  SENSOR_META,
  SensorType,
  classifyDevice,
  groupLatestByType,
  groupHistoryByType,
  toChartPoints
} from '../../api/iotDevicesApi';
import { LineChart, StatusHeatmap } from '../../components/dashboard/Charts';
import IoTQuickManageModal from '../iot/IoTQuickManageModal';

const HEALTH_STATUS = {
  healthy: { label: 'Khỏe mạnh', color: 'text-emerald-600', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  warning: { label: 'Cảnh báo', color: 'text-amber-600', bg: 'bg-amber-100', dot: 'bg-amber-500' },
  critical: { label: 'Nguy cấp', color: 'text-rose-600', bg: 'bg-rose-100', dot: 'bg-rose-500' },
  inactive: { label: 'Ngưng', color: 'text-slate-500', bg: 'bg-slate-100', dot: 'bg-slate-400' }
};

const POLL_INTERVAL_MS = 30_000; // 30s — khớp khuyến nghị từ docs BE

const MonitoringDashboard = ({ scope = 'all', farmId = null }) => {
  const { showToast } = useToast();
  const [devices, setDevices] = useState([]);       // /api/iot-devices
  const [offlineDevices, setOfflineDevices] = useState([]); // /api/iot-devices/offline
  const [latestByDevice, setLatestByDevice] = useState({}); // {deviceId: {sensorType: {value, recordedAt, sensorCode}}}
  const [historyByDevice, setHistoryByDevice] = useState({}); // {deviceId: {sensorType: [r1,r2...]}}
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());
  const [selectedFarm, setSelectedFarm] = useState(farmId || 'all');
  const [showIoTModal, setShowIoTModal] = useState(false);

  // ── Load danh sách thiết bị + offline + farms ──────────────────────────────
  const loadCore = useCallback(async () => {
    const [devRes, offlineRes, farmRes] = await Promise.allSettled([
      iotDevicesApi.getAll(),
      iotDevicesApi.getOffline(),
      farmsApi.getAll()
    ]);
    setDevices(
      devRes.status === 'fulfilled'
        ? (Array.isArray(devRes.value) ? devRes.value : (devRes.value?.data || devRes.value?.items || []))
        : []
    );
    setOfflineDevices(
      offlineRes.status === 'fulfilled'
        ? (Array.isArray(offlineRes.value) ? offlineRes.value : (offlineRes.value?.data || offlineRes.value?.items || []))
        : []
    );
    setFarms(
      farmRes.status === 'fulfilled'
        ? (Array.isArray(farmRes.value) ? farmRes.value : [])
        : []
    );
  }, []);

  // ── Poll latest sensor values cho tất cả thiết bị (mỗi 30s) ──────────────
  const pollLatest = useCallback(async (deviceList) => {
    const list = deviceList && deviceList.length ? deviceList : devices;
    if (!list.length) return;
    const results = await Promise.allSettled(
      list.map(d => iotDevicesApi.getSensorDataLatest(d.id))
    );
    const next = {};
    const sensorDataArr = results.map((r, i) => {
      if (r.status !== 'fulfilled') return { deviceId: list[i].id, sensorData: [] };
      const v = r.value;
      // unwrap { data: { sensorData: [...] } } or { sensorData: [...] } or array
      let sensorData = [];
      if (Array.isArray(v)) sensorData = v;
      else if (v && typeof v === 'object') {
        sensorData = v.sensorData || (v.data && v.data.sensorData) || [];
      }
      return { deviceId: list[i].id, sensorData: Array.isArray(sensorData) ? sensorData : [] };
    });
    for (const { deviceId, sensorData } of sensorDataArr) {
      next[deviceId] = groupLatestByType(sensorData);
    }
    setLatestByDevice(next);
    setLastSync(new Date());
  }, [devices]);

  // ── Load history cho thiết bị đầu tiên đang active (để vẽ chart 24h) ──────
  const loadHistoryForFirstActive = useCallback(async (deviceList) => {
    const activeDevices = deviceList.filter(d => classifyDevice(d) !== 'inactive');
    if (activeDevices.length === 0) return;
    const deviceId = activeDevices[0].id;
    const toDate = new Date();
    const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
      const v = await iotDevicesApi.getSensorData(deviceId, {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        limit: 500
      });
      let sensorData = [];
      if (Array.isArray(v)) sensorData = v;
      else if (v && typeof v === 'object') {
        sensorData = v.sensorData || (v.data && v.data.sensorData) || [];
      }
      setHistoryByDevice({ [deviceId]: groupHistoryByType(sensorData) });
    } catch (err) {
      console.warn('[loadHistoryForFirstActive]', err?.message || err);
      setHistoryByDevice({});
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        setLoading(true);
        await loadCore();
        if (cancelled) return;
        // Sau khi có devices → poll latest + load history
        // Dùng microtask để đảm bảo devices state đã được React cập nhật
        setTimeout(async () => {
          if (cancelled) return;
          const list = await iotDevicesApi.getAll().catch(() => []);
          const arr = Array.isArray(list) ? list : (list?.data || []);
          await pollLatest(arr);
          await loadHistoryForFirstActive(arr);
        }, 50);
      } catch (err) {
        if (!cancelled) showToast('Không thể tải dữ liệu giám sát', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-poll mỗi 30s (chỉ latest, không load lại toàn bộ)
  useEffect(() => {
    const interval = setInterval(() => {
      if (devices.length > 0) pollLatest(devices);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [devices, pollLatest]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadCore();
      await pollLatest();
      await loadHistoryForFirstActive(devices);
      showToast('Đã làm mới dữ liệu giám sát', 'success');
    } catch {
      showToast('Lỗi làm mới dữ liệu', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // ── Tính toán KPI từ data thật (bỏ random fallback) ──────────────────────
  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.isOnline).length;
  const activeDevices = devices.filter(d => classifyDevice(d) === 'healthy').length;
  const offlineCount = offlineDevices.length;

  // Active farms (farm nào có ít nhất 1 thiết bị gán)
  const farmsInUse = new Set(devices.filter(d => d.batchId).map(d => d.batchId)).size;

  // Sức khỏe tổng thể = % thiết bị đang hoạt động bình thường
  const overallHealth = totalDevices > 0
    ? Math.round((activeDevices / totalDevices) * 100)
    : 0;
  const healthStatus = offlineCount > 0
    ? (offlineCount / Math.max(1, totalDevices) > 0.3 ? 'critical' : 'warning')
    : (overallHealth >= 80 ? 'healthy' : overallHealth >= 50 ? 'warning' : 'critical');

  // ── Chart series từ history ───────────────────────────────────────────────
  // Lấy thiết bị đầu tiên có history (ưu tiên thiết bị active)
  const chartDeviceId = Object.keys(historyByDevice)[0] || devices.find(d => classifyDevice(d) === 'healthy')?.id;
  const chartHistory = chartDeviceId ? historyByDevice[chartDeviceId] : null;

  const buildSeries = (sensorType) => {
    const records = chartHistory?.[sensorType] || [];
    if (records.length === 0) {
      // Empty chart (không random — để user hiểu là chưa có data)
      return Array.from({ length: 24 }, (_, i) => ({
        label: `${(23 - i)}h`,
        value: 0
      }));
    }
    return toChartPoints(records, 24);
  };

  const temperature = buildSeries(SensorType.Temperature);
  const humidity = buildSeries(SensorType.Humidity);
  const soilMoisture = buildSeries(SensorType.SoilMoisture);
  const light = buildSeries(SensorType.Light);

  // Latest current values (lấy trung bình các thiết bị)
  const latestTemps = Object.values(latestByDevice).map(g => g[SensorType.Temperature]?.value).filter(v => typeof v === 'number');
  const latestHumid = Object.values(latestByDevice).map(g => g[SensorType.Humidity]?.value).filter(v => typeof v === 'number');
  const latestSoil = Object.values(latestByDevice).map(g => g[SensorType.SoilMoisture]?.value).filter(v => typeof v === 'number');
  const latestLight = Object.values(latestByDevice).map(g => g[SensorType.Light]?.value).filter(v => typeof v === 'number');

  const avg = arr => arr.length ? +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1) : null;
  const currentTemp = avg(latestTemps);
  const currentHumid = avg(latestHumid);
  const currentSoil = avg(latestSoil);
  const currentLight = avg(latestLight);

  // ── Heatmap cells: 1 cell = 1 thiết bị (theo status) ──────────────────────
  const heatmapCells = devices.length > 0
    ? devices.map((d, i) => ({
      label: d.deviceCode || `Device ${i + 1}`,
      status: classifyDevice(d),
      value: Math.round(d.healthScore || (d.isOnline ? 95 : 30))
    }))
    : [];

  // ── Alerts từ offline devices ─────────────────────────────────────────────
  const offlineAlerts = offlineDevices.slice(0, 6).map(d => ({
    title: `Thiết bị "${d.deviceCode || d.deviceName}" mất kết nối`,
    severity: d.lastActiveAt && (Date.now() - new Date(d.lastActiveAt).getTime() > 30 * 60 * 1000) ? 'High' : 'Medium',
    createdAt: d.lastActiveAt,
    experimentCode: d.batchCode,
    deviceId: d.id
  }));

  const criticalAlerts = offlineAlerts.filter(a => a.severity === 'High' || a.severity === 'Critical').length;
  const warningAlerts = offlineAlerts.filter(a => a.severity === 'Medium' || a.severity === 'Warning' || a.severity === 'Low').length;

  // ── Farms summary: dùng farmsApi thật + filter có device ─────────────────
  const farmsSummary = farms.map(f => {
    const farmDevices = devices.filter(d => d.farmId === f.id || d.farmId === f.farmId || (d.batch && d.batch.farmId === f.id));
    const online = farmDevices.filter(d => d.isOnline).length;
    const total = farmDevices.length;
    const score = total > 0 ? Math.round((online / total) * 100) : (f.isActive !== false ? 95 : 0);
    const status = score >= 80 ? 'Healthy' : score >= 60 ? 'Warning' : 'Critical';
    return {
      ...f,
      farmCode: f.farmCode || f.code,
      farmName: f.farmName || f.name,
      location: f.location || f.address,
      deviceCount: total,
      healthScore: score,
      status
    };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            offlineCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              offlineCount > 0 ? 'bg-rose-500' : 'bg-emerald-500'
            } animate-pulse`}></span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {offlineCount > 0 ? 'Có thiết bị offline' : 'Trực tiếp'}
            </span>
          </div>
          <span className="text-xs text-on-surface-variant">
            Cập nhật lần cuối: {lastSync.toLocaleTimeString('vi-VN')} · Auto-poll 30s
          </span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedFarm}
            onChange={e => setSelectedFarm(e.target.value)}
            className="px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">Tất cả nông trại</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.farmName || f.name}</option>)}
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
          <button
            type="button"
            onClick={() => setShowIoTModal(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-emerald-200"
            title="Tạo thiết bị IoT mới và gán vào batch"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>📡 Quản lý IoT</span>
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
            <div className={`h-full rounded-full transition-all ${
              healthStatus === 'healthy' ? 'bg-emerald-500' :
              healthStatus === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
            }`} style={{ width: `${overallHealth}%` }} />
          </div>
        </div>

        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Thiết Bị Trực Tuyến</span>
          <div className="font-hanken text-3xl font-bold text-primary mt-3">
            {onlineDevices}<span className="text-base text-on-surface-variant">/{totalDevices}</span>
          </div>
          <p className="text-[10px] text-on-surface-variant mt-1">
            <span className="text-emerald-600 font-bold">{activeDevices} đang hoạt động</span> · {offlineCount} offline
          </p>
        </div>

        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Nông Trại Hoạt Động</span>
          <div className="font-hanken text-3xl font-bold text-emerald-600 mt-3">{farmsInUse}</div>
          <p className="text-[10px] text-on-surface-variant mt-1">Có ít nhất 1 thiết bị IoT</p>
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

      {/* Environmental sensors — chart từ /sensor-data history */}
      <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-hanken text-lg font-bold text-on-surface">Chỉ Số Môi Trường 24h</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {chartDeviceId
                ? <>Thiết bị: <span className="font-mono font-bold">{devices.find(d => d.id === chartDeviceId)?.deviceCode}</span></>
                : 'Chưa có thiết bị active nào'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className={`px-2 py-1 rounded-full font-bold ${
              offlineCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {offlineCount > 0 ? `${offlineCount} offline` : 'Ổn định'}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { type: SensorType.Temperature, data: temperature, current: currentTemp },
            { type: SensorType.Humidity, data: humidity, current: currentHumid },
            { type: SensorType.SoilMoisture, data: soilMoisture, current: currentSoil },
            { type: SensorType.Light, data: light, current: currentLight }
          ].map(({ type, data, current }) => {
            const meta = SENSOR_META[type];
            const lastVal = data[data.length - 1]?.value ?? 0;
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
                    <span className="text-base">{meta.icon}</span> {meta.label}{meta.unit ? ` (${meta.unit})` : ''}
                  </span>
                  <span className="text-sm font-mono font-bold text-primary">
                    {current !== null ? `${current}${meta.unit}` : `${lastVal}${meta.unit}`}
                  </span>
                </div>
                <LineChart data={data} color={meta.color} fillColor={meta.fillColor} unit={meta.unit} height={140} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Device status heatmap + offline alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-hanken text-lg font-bold text-on-surface">Trạng Thái Thiết Bị IoT</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {totalDevices} thiết bị · {onlineDevices} đang online · {offlineCount} offline
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span> Online</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500"></span> Mất kết nối</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-400"></span> Ngưng</span>
            </div>
          </div>
          {heatmapCells.length === 0 ? (
            <div className="py-10 text-center text-xs text-on-surface-variant">
              <div className="text-3xl mb-2">📡</div>
              <p>Chưa có thiết bị IoT nào. Hãy tạo thiết bị đầu tiên trong trang chi tiết batch.</p>
            </div>
          ) : (
            <>
              <StatusHeatmap cells={heatmapCells} />
              <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-outline-variant">
                <div className="text-center">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase">Online</p>
                  <p className="font-hanken text-xl font-bold text-emerald-600">{heatmapCells.filter(c => c.status === 'healthy').length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase">Mất kết nối</p>
                  <p className="font-hanken text-xl font-bold text-amber-600">{heatmapCells.filter(c => c.status === 'warning').length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase">Ngưng</p>
                  <p className="font-hanken text-xl font-bold text-slate-600">{heatmapCells.filter(c => c.status === 'inactive').length}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
          <h3 className="font-hanken text-lg font-bold text-on-surface mb-1">Cảnh Báo Offline</h3>
          <p className="text-xs text-on-surface-variant mb-4">Thiết bị mất kết nối (từ /iot-devices/offline)</p>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-surface-container-low rounded-xl animate-pulse" />
              ))}
            </div>
          ) : offlineAlerts.length === 0 ? (
            <div className="py-10 text-center text-xs text-on-surface-variant">
              <div className="text-3xl mb-2">✅</div>
              <p>Tất cả thiết bị đang hoạt động</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {offlineAlerts.map((a, i) => (
                <div key={i} className={`p-3 rounded-xl border-l-4 ${
                  a.severity === 'High' || a.severity === 'Critical'
                    ? 'border-rose-500 bg-rose-50'
                    : 'border-amber-500 bg-amber-50'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-on-surface line-clamp-2">{a.title}</p>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded whitespace-nowrap ${
                      a.severity === 'High' || a.severity === 'Critical' ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-800'
                    }`}>
                      {a.severity}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    {a.createdAt ? `Lần cuối: ${new Date(a.createdAt).toLocaleString('vi-VN')}` : 'Vừa mất kết nối'}
                    {a.experimentCode && <span className="ml-2">· Batch: {a.experimentCode}</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Farms summary */}
      <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-hanken text-lg font-bold text-on-surface">Nông Trại Đang Giám Sát</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Sức khỏe dựa trên tỷ lệ thiết bị online</p>
          </div>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-on-surface-variant">Đang tải...</div>
        ) : farmsSummary.length === 0 ? (
          <div className="py-10 text-center text-xs text-on-surface-variant">
            <div className="text-3xl mb-2">🌾</div>
            <p>Chưa có nông trại nào.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {farmsSummary.slice(0, 6).map((farm, idx) => (
              <div key={farm.id || idx} className="border border-outline-variant rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] font-bold text-primary">{farm.farmCode || 'N/A'}</span>
                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                    farm.status === 'Healthy' ? 'bg-emerald-100 text-emerald-700' :
                    farm.status === 'Warning' ? 'bg-amber-100 text-amber-700' :
                    'bg-rose-100 text-rose-700'
                  }`}>
                    {farm.status}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-on-surface line-clamp-1 mb-1">{farm.farmName || 'Nông trại'}</h4>
                <p className="text-[10px] text-on-surface-variant mb-3">
                  📍 {farm.location || '—'} · {farm.deviceCount} thiết bị IoT
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-on-surface-variant">Sức khỏe</span>
                    <span className="font-bold text-primary">{Math.round(farm.healthScore || 0)}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        farm.healthScore >= 80 ? 'bg-emerald-500' :
                        farm.healthScore >= 60 ? 'bg-amber-500' :
                        'bg-rose-500'
                      }`}
                      style={{ width: `${farm.healthScore || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* IoT Quick Manage Modal */}
      <IoTQuickManageModal
        open={showIoTModal}
        onClose={() => setShowIoTModal(false)}
        onSuccess={() => handleRefresh()}
      />
    </div>
  );
};

export default MonitoringDashboard;
