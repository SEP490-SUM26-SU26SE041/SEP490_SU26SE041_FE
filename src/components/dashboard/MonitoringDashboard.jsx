import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { farmsApi } from '../../api/managerResourcesApi';
import { dashboardApi } from '../../api/dashboardApi';
import {
  iotDevicesApi,
  classifyDevice,
  toChartPoints,
  classifySensorByCode
} from '../../api/iotDevicesApi';
import { experimentsApi, batchesApi } from '../../api/experimentApi';
import { LineChart, StatusHeatmap } from '../../components/dashboard/Charts';
import IoTQuickManageModal from '../iot/IoTQuickManageModal';

const HEALTH_STATUS = {
  healthy: { label: 'Khỏe mạnh', color: 'text-emerald-600', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  warning: { label: 'Cảnh báo', color: 'text-amber-600', bg: 'bg-amber-100', dot: 'bg-amber-500' },
  critical: { label: 'Nguy cấp', color: 'text-rose-600', bg: 'bg-rose-100', dot: 'bg-rose-500' },
  inactive: { label: 'Ngưng', color: 'text-slate-500', bg: 'bg-slate-100', dot: 'bg-slate-400' }
};

const POLL_INTERVAL_MS = 30_000; // 30s — khớp khuyến nghị từ docs BE
const REALTIME_INTERVAL_MS = 3_000; // 3s — realtime card refresh nhanh để user thấy "liên tục"

// ── Mini sparkline (SVG inline, 12 điểm gần nhất) ─────────────────────────────
const Sparkline = ({ values = [], color = '#486730', height = 24 }) => {
  if (!values.length || values.length < 2) return null;
  const w = 100; // viewBox width
  const h = height;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = w / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const lastX = (values.length - 1) * stepX;
  const lastY = h - ((values[values.length - 1] - min) / range) * (h - 4) - 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full mt-1" preserveAspectRatio="none" style={{ height }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2" fill={color}>
        <animate attributeName="r" values="2;3;2" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
};

const MonitoringDashboard = ({ scope = 'all', farmId = null }) => {
  const { showToast } = useToast();
  const [devices, setDevices] = useState([]);       // /api/iot-devices
  const [offlineDevices, setOfflineDevices] = useState([]); // /api/iot-devices/offline
  const [latestBySensor, setLatestBySensor] = useState({}); // {sensorCode: {value, recordedAt, sensorType}}
  const [historyBySensor, setHistoryBySensor] = useState({}); // {sensorCode: [{recordedAt, value}]}
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());
  const [selectedFarm, setSelectedFarm] = useState(farmId || 'all');
  const [selectedExperiment, setSelectedExperiment] = useState('all');
  // Map experimentId → tên thực nghiệm (lấy từ /api/experiments + /api/batches/{id})
  const [experimentNames, setExperimentNames] = useState({});
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

  // ── Polling riêng cho trạng thái thiết bị (online/offline) mỗi 30s ──────
  // Chỉ refresh devices + offline devices (không đụng farms vì ít thay đổi)
  // → đảm bảo heatmap + alert cập nhật realtime trạng thái thiết bị
  const loadDevicesStatus = useCallback(async () => {
    try {
      const [devRes, offlineRes] = await Promise.allSettled([
        iotDevicesApi.getAll(),
        iotDevicesApi.getOffline()
      ]);
      const newDevices = devRes.status === 'fulfilled'
        ? (Array.isArray(devRes.value) ? devRes.value : (devRes.value?.data || devRes.value?.items || []))
        : null;
      const newOffline = offlineRes.status === 'fulfilled'
        ? (Array.isArray(offlineRes.value) ? offlineRes.value : (offlineRes.value?.data || offlineRes.value?.items || []))
        : null;
      if (newDevices) setDevices(newDevices);
      if (newOffline) setOfflineDevices(newOffline);
      if (import.meta.env.DEV) console.log(`[IoT] Devices status refreshed: ${newDevices?.length ?? 0} devices, ${newOffline?.length ?? 0} offline`);
    } catch (err) {
      console.warn('[loadDevicesStatus]', err?.message || err);
    }
}, []);

  // ── Load tên thực nghiệm từ BE ───────────────────────────────────────────
  // Lấy tên thực nghiệm từ 2 nguồn:
  //   1) GET /api/experiments  → map experimentId → { code, title, name }
  //   2) GET /api/batches/{id} → response có sẵn `experimentTitle`
  // Cache lại trong `experimentNames` để dropdown hiển thị tên thực nghiệm
  // ngay cả khi BE IoT-devices không trả về batch.experimentName
  const loadExperimentNames = useCallback(async (currentDevices) => {
    try {
      // 1) Lấy tất cả experiments 1 request
      const expList = await experimentsApi.getAll().catch(() => []);
      const expArr = Array.isArray(expList) ? expList : [];
      const expMap = {};
      for (const e of expArr) {
        if (!e || !e.id) continue;
        expMap[e.id] = {
          id: e.id,
          code: e.experimentCode || e.code,
          name: e.title || e.name || e.experimentName || ''
        };
      }

      // 2) Với mỗi unique batchId từ devices mà chưa có trong map, gọi batch API
      //    (BE batch response có `experimentTitle` — đáng tin cậy hơn IoT devices)
      const batchIds = new Set();
      for (const d of currentDevices || []) {
        const id = d.batchId || d.batch?.id;
        if (id) batchIds.add(id);
      }
      const missing = Array.from(batchIds).filter(id => !expMap[id]);
      if (missing.length > 0) {
        const results = await Promise.allSettled(
          missing.map(id => batchesApi.getById(id).catch(() => null))
        );
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const batchId = missing[i];
          if (r.status !== 'fulfilled' || !r.value) continue;
          const b = r.value;
          // Unwrap nếu BE wrap
          let data = b;
          if (data && typeof data === 'object' && data.data && typeof data.data === 'object') {
            data = data.data;
          }
          const expTitle = data.experimentTitle || data.experimentName || data.experiment?.title || '';
          const expId = data.experimentId || data.experiment?.id;
          if (expTitle && expId && !expMap[expId]) {
            expMap[expId] = {
              id: expId,
              code: data.experimentCode || data.experiment?.experimentCode || '',
              name: expTitle
            };
          }
          // Fallback: nếu batchId == experimentId (1:1)
          if (expTitle && !expMap[batchId]) {
            expMap[batchId] = {
              id: batchId,
              code: data.batchCode || `Batch #${batchId.slice(0, 6)}`,
              name: expTitle
            };
          }
        }
      }
      if (import.meta.env.DEV) console.log('[IoT] experimentNames loaded:', Object.keys(expMap).length);
      setExperimentNames(expMap);
    } catch (err) {
      console.warn('[loadExperimentNames]', err?.message || err);
    }
  }, []);

  // Khi devices đổi → thử load tên thực nghiệm nếu chưa có
  useEffect(() => {
    if (devices.length === 0) return;
    loadExperimentNames(devices);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices.length]);

// ── Poll latest sensor values (1 call thay vì N calls) ────────────────────
  // Dùng /dashboard/sensors/latest của BE → trả về tất cả sensors trong 1 request.
  const pollLatest = useCallback(async () => {
    try {
      const data = await dashboardApi.getLatestSensorReadings({ limit: 200 });
      if (import.meta.env.DEV) console.log('[IoT] /dashboard/sensors/latest →', Array.isArray(data) ? data.length : 'obj', data && data[0] ? data[0] : '');
      // BE có thể trả { success, data: [...] } hoặc [...] trực tiếp (đã unwrap)
      let sensorData = [];
      if (Array.isArray(data)) sensorData = data;
      else if (data && typeof data === 'object') {
        sensorData = data.sensorData || data.data || (Array.isArray(data.items) ? data.items : []);
      }
      // Gộp theo sensorCode (vì 2 sensor có cùng sensorType nhưng code khác nhau
      // → cần giữ riêng để phân loại TEMP_AIR vs TEMP_WATER)
      const map = {};
      for (const r of sensorData || []) {
        if (!r) continue;
        // ⚠️ BE /dashboard/sensors/latest trả field `latestValue` + `lastRecordedAt`
        // (không phải `value`/`recordedAt`) → unwrap về shape thống nhất
        const value = r.latestValue ?? r.value ?? r.sensorValue;
        if (value === null || value === undefined) continue;
        const recordedAt = r.lastRecordedAt || r.recordedAt || r.timestamp || new Date().toISOString();
        const code = r.sensorCode || r.sensorId || r.sensorType || 'unknown';
        const existing = map[code];
        if (!existing || new Date(recordedAt) > new Date(existing.recordedAt)) {
          map[code] = {
            ...r,
            sensorCode: code,
            value: Number(value),
            recordedAt,
            unit: r.unit || r.sensorType || '',
            sensorType: r.sensorType,
            status: r.status,
            minThreshold: r.minThreshold,
            maxThreshold: r.maxThreshold,
            sensorId: r.sensorId
          };
        }
      }
      if (import.meta.env.DEV) console.log('[IoT] latestBySensor keys:', Object.keys(map));
      setLatestBySensor(map);
      setLastSync(new Date());
    } catch (err) {
      console.warn('[pollLatest]', err?.message || err);
    }
  }, []);

  // ── Load history cho TẤT CẢ thiết bị đang active ────────────────────────────
  // Dùng /iot-devices/{id}/sensor-data (BE đã verify response shape ổn định):
  //   { success, data: { deviceId, deviceCode, batchCode, totalRecords, sensorData: [...] } }
  // Load cho TẤT CẢ devices active rồi gộp theo sensorCode.
  const loadAllHistory = useCallback(async () => {
    const list = await iotDevicesApi.getAll().catch(() => []);
    const arr = Array.isArray(list) ? list : (list?.data || []);
    const active = arr.filter(d => classifyDevice(d) !== 'inactive');
    if (active.length === 0) {
      setHistoryBySensor({});
      return;
    }
    const toDate = new Date();
    const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const results = await Promise.allSettled(
      active.map(d => iotDevicesApi.getSensorData(d.id, {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        limit: 2000   // Lấy nhiều nhất có thể để chart 24h dày dặn
      }).then(v => {
        // Unwrap nhiều lớp:
        // 1) { success, data: { sensorData: [...] } } (BE mới)
        // 2) { data: { sensorData: [...] } } (BE cũ hơn)
        // 3) { sensorData: [...] } (BE rất cũ)
        // 4) [...] (mảng trực tiếp)
        let sensorData = [];
        if (Array.isArray(v)) sensorData = v;
        else if (v && typeof v === 'object') {
          const inner = v.data && typeof v.data === 'object' ? v.data : v;
          sensorData = inner.sensorData || inner.records || inner.data || [];
        }
        return { deviceId: d.id, sensorData: Array.isArray(sensorData) ? sensorData : [] };
      }).catch(() => ({ deviceId: d.id, sensorData: [] })))
    );
    // Gộp tất cả records theo sensorCode (nhiều device cùng code → chỉ giữ 1 bộ)
    const merged = {};
    let totalRecords = 0;
    let deviceCount = 0;
    // Window thời gian: giữ 24h để chart "Chỉ Số Môi Trường 24h" luôn có data
    // (trước đây 30 phút làm chart rỗng khi BE chỉ có data cũ hơn 30 phút)
    const WINDOW_MS = 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - WINDOW_MS;
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const recCount = r.value.sensorData.length;
      if (recCount > 0) {
        deviceCount++;
        totalRecords += recCount;
      }
      for (const rec of r.value.sensorData) {
        const code = rec.sensorCode || rec.sensorId || '';
        if (!code) continue;
        // Bỏ qua records cũ hơn window (auto reset chart)
        const recTime = new Date(rec.recordedAt).getTime();
        if (recTime < cutoff) continue;
        if (!merged[code]) merged[code] = [];
        merged[code].push({
          recordedAt: rec.recordedAt,
          // value === 0 là hợp lệ (pH=0, 0°C...) → KHÔNG thay bằng 0 mặc định
          value: rec.value === null || rec.value === undefined ? 0 : Number(rec.value),
          sensorCode: rec.sensorCode
        });
      }
    }
    for (const k of Object.keys(merged)) {
      merged[k].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    }
    if (import.meta.env.DEV) {
      console.log(`[IoT] Merged history: ${deviceCount} devices, ${totalRecords} records → ${Object.keys(merged).length} sensors (window ${WINDOW_MS / 3600000}h)`);
    }
    setHistoryBySensor(merged);
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        setLoading(true);
        await loadCore();
        if (cancelled) return;
        // Dùng microtask để đảm bảo devices state đã được React cập nhật
        setTimeout(async () => {
          if (cancelled) return;
          await pollLatest();
          await loadAllHistory();
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

  // Khi có sensor mới từ pollLatest → load history cho sensor mới đó
  useEffect(() => {
    if (Object.keys(latestBySensor).length === 0) return;
    loadAllHistory();
  }, [latestBySensor, loadAllHistory]);

  // Khi user chọn experiment → load latest sensors từ các devices thuộc experiment đó
  // (Để realtime cards hiển thị data tương ứng với experiment đang filter)
  useEffect(() => {
    if (selectedExperiment === 'all') return;
    // Lấy devices thuộc experiment ngay tại đây (không phụ thuộc filteredDevices
    // để tránh lỗi TDZ khi component khởi tạo)
    const expDevices = devices.filter(d => {
      const id = d.batchId || d.batch?.id;
      return String(id) === String(selectedExperiment);
    });
    if (expDevices.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        // Gọi API getSensorDataLatest cho từng device → đảm bảo lấy sensor mới nhất
        // theo batchId đang chọn
        const results = await Promise.allSettled(
          expDevices.map(d => iotDevicesApi.getSensorDataLatest(d.id).catch(() => null))
        );
        if (cancelled) return;
        setLatestBySensor(prev => {
          const map = { ...prev };
          let updated = false;
          for (let i = 0; i < results.length; i++) {
            const r = results[i];
            if (r.status !== 'fulfilled' || !r.value) continue;
            const d = expDevices[i];
            // BE trả { success, data: { ... } } hoặc { data: [...] } - unwrap
            let payload = r.value;
            if (payload && payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
              payload = payload.data;
            }
            // Có thể trả 1 record hoặc mảng
            const records = Array.isArray(payload) ? payload
              : (payload.sensorData ? (Array.isArray(payload.sensorData) ? payload.sensorData : [payload.sensorData]) : [payload]);
            for (const rec of records) {
              if (!rec) continue;
              if (rec.value === null || rec.value === undefined) continue;
              const code = rec.sensorCode || rec.sensorId || d.deviceCode || `device_${d.id}`;
              const existing = map[code];
              const recTime = rec.recordedAt ? new Date(rec.recordedAt).getTime() : Date.now();
              if (!existing || recTime > new Date(existing.recordedAt).getTime()) {
                map[code] = {
                  ...rec,
                  deviceId: d.id,
                  deviceCode: d.deviceCode,
                  batchCode: d.batchCode
                };
                updated = true;
              }
            }
          }
          if (import.meta.env.DEV && updated) {
            console.log('[IoT] Merged experiment-specific latest sensors');
          }
          return updated ? map : prev;
        });
      } catch (err) {
        console.warn('[experimentLatest]', err?.message || err);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExperiment, devices.length]);

  // ── Hiển thị toast ngắn gọn khi cảm biến vượt ngưỡng cảnh báo ─────────────
  // Chỉ fire toast khi value MỚI chuyển sang warning (so với lần check trước)
  const alertedSensorsRef = useRef(new Set());
  useEffect(() => {
    if (Object.keys(latestBySensor).length === 0) return;
    for (const code of Object.keys(latestBySensor)) {
      const val = latestBySensor[code]?.value;
      if (val === null || val === undefined) continue;
      const warn = getWarn(code, val);
      const key = `${code}-${val}`;
      if (warn && !alertedSensorsRef.current.has(key)) {
        // Đánh dấu đã alert giá trị này
        alertedSensorsRef.current.add(key);
        // Map code → label ngắn gọn cho toast
        const upper = code.toUpperCase();
        let shortLabel = code;
        if (upper.includes('PH')) shortLabel = 'pH';
        else if (upper.includes('TEMP_AIR')) shortLabel = 'Nhiệt độ KK';
        else if (upper.includes('TEMP_WATER')) shortLabel = 'Nhiệt độ nước';
        else if (upper.includes('TEMP')) shortLabel = 'Nhiệt độ';
        else if (upper.includes('HUM')) shortLabel = 'Độ ẩm';
        // Rút gọn thông báo: chỉ icon + ngưỡng
        let shortMsg = warn;
        if (warn.includes('pH ngoài ngưỡng')) shortMsg = `⚠ ${shortLabel} ${val} ngoài ngưỡng`;
        else if (warn.includes('pH hơi lệch')) shortMsg = `⚠ ${shortLabel} ${val} hơi lệch`;
        else if (warn.includes('Nhiệt độ bất thường')) shortMsg = `🚨 ${shortLabel} ${val}° bất thường`;
        else if (warn.includes('Độ ẩm KK bất thường')) shortMsg = `⚠ ${shortLabel} ${val}% bất thường`;
        showToast(shortMsg, warn.startsWith('🚨') ? 'error' : 'warning', 3500);
      }
    }
    // Cleanup key cũ hơn 100 entries để tránh memory leak
    if (alertedSensorsRef.current.size > 100) {
      alertedSensorsRef.current = new Set([...alertedSensorsRef.current].slice(-50));
    }
  }, [latestBySensor, showToast]);

  // Auto-poll mỗi 30s:
  //   + refresh trạng thái thiết bị (online/offline)
  //   + refresh latest sensors (cho chart 24h)
  //   + refresh history (cho chart 24h)
  useEffect(() => {
    const interval = setInterval(async () => {
      await loadDevicesStatus();
      await pollLatest();
      await loadAllHistory();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pollLatest, loadAllHistory, loadDevicesStatus]);

  // Auto-poll mỗi 3s cho REALTIME cards (giá trị mới nhất hiển thị liên tục)
  // Dùng endpoint /dashboard/sensors/latest đã tối ưu → 1 request duy nhất
  useEffect(() => {
    const interval = setInterval(async () => {
      await pollLatest();
    }, REALTIME_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pollLatest]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadCore();
      await pollLatest();
      await loadAllHistory();
      showToast('Đã làm mới dữ liệu giám sát', 'success');
    } catch {
      showToast('Lỗi làm mới dữ liệu', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // Sức khỏe tổng thể (= % healthy) sẽ được tính từ filteredDevices bên dưới

  // ── Helpers cho chart/series ──────────────────────────────────────────────
  const buildSeries = (code) => {
    const records = fHistoryBySensor[code] || [];
    if (records.length === 0) {
      return Array.from({ length: 24 }, (_, i) => ({
        label: `${(23 - i)}h`,
        value: 0
      }));
    }
    return toChartPoints(records, 24);
  };

  // Latest current values: lấy theo sensorCode
  const getLatestValue = (code) => {
    const r = fLatestBySensor[code];
    return r && typeof r.value === 'number' ? r.value : null;
  };

  // Helper: kiểm tra cảnh báo
  const getWarn = (code, value) => {
    const upper = code.toUpperCase();
    if (upper.includes('PH')) {
      if (value === null) return null;
      if (value < 5 || value > 9) return '🚨 pH ngoài ngưỡng!';
      if (value < 6 || value > 8.5) return '⚠ pH hơi lệch';
      return null;
    }
    if (upper.includes('TEMP')) {
      if (value === null) return null;
      if (value < 10 || value > 40) return '🚨 Nhiệt độ bất thường!';
      return null;
    }
    if (upper.includes('HUM')) {
      if (value === null) return null;
      if (value < 30 || value > 90) return '⚠ Độ ẩm KK bất thường';
      return null;
    }
    return null;
  };

  // ── Alerts từ offline devices ─────────────────────────────────────────────

  // ── Experiments list (từ devices.batchCode/batchId) ──────────────────────
  // Kết hợp dữ liệu từ `experimentNames` (map id → name từ BE) + fallback từ batch object
  const experimentsList = useMemo(() => {
    const map = new Map();
    for (const d of devices) {
      const id = d.batchId || d.batch?.id;
      if (!id) continue;
      const code = d.batchCode || d.batch?.batchCode || d.batch?.code || `Batch #${id}`;

      // Ưu tiên 1: experimentNames[id] (đã fetch từ /experiments hoặc /batches/{id})
      let name = experimentNames[id]?.name || '';

      // Ưu tiên 2: từ device.batch object (BE có thể inline)
      if (!name) {
        name = d.batch?.experimentTitle
          || d.batch?.experimentName
          || d.batch?.experiment?.name
          || d.batch?.experiment?.experimentName
          || d.batch?.cropVarietyName
          || '';
      }
      // Ưu tiên 3: nếu vẫn rỗng → dùng code (fallback)
      const displayName = name || code;

      if (!map.has(id)) {
        map.set(id, {
          id,
          code,
          name: displayName,
          // Có thông tin tên thực nghiệm thật (không phải fallback code)?
          hasRealName: !!name && name !== code,
          deviceCount: 0
        });
      }
      map.get(id).deviceCount++;
    }
    return Array.from(map.values()).sort((a, b) => {
      // Ưu tiên sắp xếp theo tên thực nghiệm
      const aKey = a.hasRealName ? a.name : `zzz_${a.code}`;
      const bKey = b.hasRealName ? b.name : `zzz_${b.code}`;
      return aKey.localeCompare(bKey);
    });
  }, [devices, experimentNames]);

  // ── Filter devices theo thí nghiệm được chọn ─────────────────────────────
  const filteredDevices = useMemo(() => {
    if (selectedExperiment === 'all') return devices;
    return devices.filter(d => {
      const id = d.batchId || d.batch?.id;
      return String(id) === String(selectedExperiment);
    });
  }, [devices, selectedExperiment]);

  const filteredOfflineDevices = useMemo(() => {
    if (selectedExperiment === 'all') return offlineDevices;
    return offlineDevices.filter(d => {
      const id = d.batchId || d.batch?.id;
      return String(id) === String(selectedExperiment);
    });
  }, [offlineDevices, selectedExperiment]);

  // Recompute KPIs/summary từ filtered devices
  const fTotalDevices = filteredDevices.length;
  const fOnlineDevices = filteredDevices.filter(d => d.isOnline).length;
  const fActiveDevices = filteredDevices.filter(d => classifyDevice(d) === 'healthy').length;
  const fOfflineCount = filteredOfflineDevices.length;
  const fOverallHealth = fTotalDevices > 0 ? Math.round((fActiveDevices / fTotalDevices) * 100) : 0;
  const fHealthStatus = fOfflineCount > 0
    ? (fOfflineCount / Math.max(1, fTotalDevices) > 0.3 ? 'critical' : 'warning')
    : (fOverallHealth >= 80 ? 'healthy' : fOverallHealth >= 50 ? 'warning' : 'critical');

  const fHeatmapCells = filteredDevices.map((d, i) => ({
    label: d.deviceCode || `Device ${i + 1}`,
    status: classifyDevice(d),
    isOffline: !d.isOnline,
    value: Math.round(d.healthScore || (d.isOnline ? 95 : 30))
  }));

  const fOfflineAlerts = filteredOfflineDevices.slice(0, 6).map(d => ({
    title: `Thiết bị "${d.deviceCode || d.deviceName}" mất kết nối`,
    severity: d.lastActiveAt && (Date.now() - new Date(d.lastActiveAt).getTime() > 30 * 60 * 1000) ? 'High' : 'Medium',
    createdAt: d.lastActiveAt,
    experimentCode: d.batchCode,
    deviceId: d.id
  }));

  const fCriticalAlerts = fOfflineAlerts.filter(a => a.severity === 'High' || a.severity === 'Critical').length;
  const fWarningAlerts = fOfflineAlerts.filter(a => a.severity === 'Medium' || a.severity === 'Warning' || a.severity === 'Low').length;

  // Lấy tất cả sensorCode thuộc filteredDevices
  // Sensor code ↔ experiment: không có mapping chính xác từ BE (sensorCode có thể
// là "TEMP_AIR" / "PH_01" không mang batchId). Do đó khi filter theo experiment
// vẫn hiển thị TẤT CẢ sensors đang có - chỉ filter devices/alerts/heatmap.
// Việc này tránh chart "Chỉ Số Môi Trường 24h" bị rỗng khi user filter.

  const fLatestBySensor = useMemo(() => latestBySensor, [latestBySensor]);
  const fHistoryBySensor = useMemo(() => historyBySensor, [historyBySensor]);

  const fAllSensorCodes = useMemo(() => Array.from(new Set([
    ...Object.keys(fLatestBySensor),
    ...Object.keys(fHistoryBySensor)
  ])).sort(), [fLatestBySensor, fHistoryBySensor]);

  const fSensorMetaMap = fAllSensorCodes.map(code => {
    const latest = fLatestBySensor[code] || {};
    const meta = classifySensorByCode(code, latest.sensorType);
    return { code, ...meta, latest };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            fOfflineCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              fOfflineCount > 0 ? 'bg-rose-500' : 'bg-emerald-500'
            } animate-pulse`}></span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {fOfflineCount > 0 ? 'Có thiết bị offline' : 'Trực tiếp'}
            </span>
          </div>
          <span className="text-xs text-on-surface-variant">
            Cập nhật lần cuối: {lastSync.toLocaleTimeString('vi-VN')} · Auto-poll 30s
          </span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedExperiment}
            onChange={e => setSelectedExperiment(e.target.value)}
            className="px-3 py-2 border border-outline-variant rounded-lg text-sm bg-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">🔬 Tất cả thí nghiệm ({devices.length} TB)</option>
            {experimentsList.map(exp => (
              <option key={exp.id} value={exp.id}>
                {exp.hasRealName
                  ? `🌱 ${exp.name} · Batch ${exp.code} (${exp.deviceCount} TB)`
                  : `📦 ${exp.code} (${exp.deviceCount} TB)`}
              </option>
            ))}
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
            <span className={`w-2 h-2 rounded-full ${HEALTH_STATUS[fHealthStatus].dot} animate-pulse`}></span>
          </div>
          <div className="flex items-end gap-2">
            <span className="font-hanken text-3xl font-bold text-primary">{fOverallHealth}%</span>
            <span className={`text-[10px] font-bold uppercase mb-1 ${HEALTH_STATUS[fHealthStatus].color}`}>
              {HEALTH_STATUS[fHealthStatus].label}
            </span>
          </div>
          <div className="mt-3 h-1.5 bg-surface-container-low rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${
              fHealthStatus === 'healthy' ? 'bg-emerald-500' :
              fHealthStatus === 'warning' ? 'bg-amber-500' : 'bg-rose-500'
            }`} style={{ width: `${fOverallHealth}%` }} />
          </div>
        </div>

        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Thiết Bị Trực Tuyến</span>
          <div className="font-hanken text-3xl font-bold text-primary mt-3">
            {fOnlineDevices}<span className="text-base text-on-surface-variant">/{fTotalDevices}</span>
          </div>
          <p className="text-[10px] text-on-surface-variant mt-1">
            <span className="text-emerald-600 font-bold">{fActiveDevices} đang hoạt động</span> · {fOfflineCount} offline
          </p>
        </div>

        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Thí Nghiệm Hoạt Động</span>
          <div className="font-hanken text-3xl font-bold text-emerald-600 mt-3">{experimentsList.length}</div>
          <p className="text-[10px] text-on-surface-variant mt-1">Có ít nhất 1 thiết bị IoT</p>
        </div>

        <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Cảnh Báo Mới</span>
          <div className="font-hanken text-3xl font-bold text-rose-600 mt-3">
            {fCriticalAlerts + fWarningAlerts}
          </div>
          <p className="text-[10px] text-on-surface-variant mt-1">
            <span className="text-rose-600 font-bold">{fCriticalAlerts} nguy cấp</span> · {fWarningAlerts} cảnh báo
          </p>
        </div>
      </div>

      {/* Realtime sensor cards — hiển thị giá trị mới nhất cho từng sensorCode */}
      {fAllSensorCodes.length > 0 && (
        <div className="bg-gradient-to-r from-cyan-50 via-sky-50 to-indigo-50 border border-cyan-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-hanken text-lg font-bold text-on-surface flex items-center gap-2">
                📡 Realtime giá trị cảm biến
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Từ <code className="font-mono">/dashboard/sensors/latest</code> · cập nhật mỗi 30s
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
              ● LIVE
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {fSensorMetaMap.map(({ code, label, icon, unit, color, latest }) => {
              const currentVal = getLatestValue(code);
              const warn = getWarn(code, currentVal);
              // Mini sparkline: lấy 12 điểm gần nhất từ history
              const historyArr = (fHistoryBySensor[code] || []).slice(-12);
              return (
                <div key={code} className={`bg-white rounded-xl p-3 border-2 shadow-sm transition-all hover:scale-[1.02] ${
                  warn ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base">{icon}</span>
                    <code className="text-[9px] font-mono text-slate-400">{code}</code>
                  </div>
                  <p className="text-[10px] font-bold uppercase text-slate-500 leading-tight mb-1">{label}</p>
                  <div className="flex items-end gap-2">
                    <p className={`text-2xl font-black tracking-tight ${warn ? 'text-rose-700' : 'text-slate-900'}`}>
                      {currentVal !== null ? `${currentVal}` : '—'}
                      <span className="text-xs font-bold text-slate-500 ml-0.5">{unit || ''}</span>
                    </p>
                    {warn && <span className="text-[10px] animate-pulse">🚨</span>}
                  </div>
                  {/* Mini sparkline - 12 điểm gần nhất */}
                  {historyArr.length > 1 && (
                    <Sparkline
                      values={historyArr.map(r => r.value)}
                      color={warn ? '#e11d48' : color}
                      height={24}
                    />
                  )}
                  {warn && <p className="text-[9px] font-bold text-rose-700 mt-1">{warn}</p>}
                  {latest?.recordedAt && (
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      🕒 {new Date(latest.recordedAt).toLocaleTimeString('vi-VN')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Environmental sensors — chart từ /dashboard/sensors/latest + /iot-devices/{id}/sensor-data history */}
      <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-hanken text-lg font-bold text-on-surface">Chỉ Số Môi Trường 24h</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {fAllSensorCodes.length > 0
                ? <><b>{fAllSensorCodes.length} cảm biến</b> · Realtime từ <code className="font-mono">/dashboard/sensors/latest</code></>
                : 'Chưa có dữ liệu cảm biến'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className={`px-2 py-1 rounded-full font-bold ${
              fOfflineCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {fOfflineCount > 0 ? `${fOfflineCount} offline` : 'Ổn định'}
            </span>
          </div>
        </div>
        {fAllSensorCodes.length === 0 ? (
          <div className="py-10 text-center text-xs text-on-surface-variant">
            <div className="text-3xl mb-2">📡</div>
            <p>Chưa nhận được dữ liệu cảm biến. Kiểm tra MQTT hoặc thiết bị IoT.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fSensorMetaMap.map(({ code, label, icon, unit, color, fillColor, latest }) => {
              const series = buildSeries(code);
              const currentVal = getLatestValue(code);
              const warn = getWarn(code, currentVal);
              return (
                <div key={code} className={`relative rounded-xl p-3 border transition-all ${
                  warn ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50/30 border-slate-100'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-on-surface-variant flex items-center gap-1.5">
                      <span className="text-base">{icon}</span> {label}{unit ? ` (${unit})` : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      <code className="text-[9px] font-mono text-slate-400">{code}</code>
                      <span className={`text-sm font-mono font-bold ${
                        warn ? 'text-rose-700' : 'text-primary'
                      }`}>
                        {currentVal !== null ? `${currentVal}${unit || ''}` : '—'}
                      </span>
                    </div>
                  </div>
                  <LineChart data={series} color={color} fillColor={fillColor} unit={unit} height={120} />
                  {warn && (
                    <p className="text-[10px] font-bold text-rose-700 mt-1">⚠ {warn}</p>
                  )}
                  {latest?.recordedAt && (
                    <p className="text-[9px] text-slate-400 mt-1">
                      🕒 {new Date(latest.recordedAt).toLocaleString('vi-VN')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Device status heatmap + offline alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-outline-variant rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-hanken text-lg font-bold text-on-surface">Trạng Thái Thiết Bị IoT</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {fTotalDevices} thiết bị · {fOnlineDevices} đang online · {fOfflineCount} offline
              </p>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span> Online</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500"></span> Mất kết nối</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-400"></span> Ngưng</span>
            </div>
          </div>
          {fHeatmapCells.length === 0 ? (
            <div className="py-10 text-center text-xs text-on-surface-variant">
              <div className="text-3xl mb-2">📡</div>
              <p>Chưa có thiết bị IoT nào. Hãy tạo thiết bị đầu tiên trong trang chi tiết batch.</p>
            </div>
          ) : (
            <>
              <StatusHeatmap cells={fHeatmapCells} />
              <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-outline-variant">
                <div className="text-center">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase">Online</p>
                  <p className="font-hanken text-xl font-bold text-emerald-600">{fHeatmapCells.filter(c => c.status === 'healthy').length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase">Mất kết nối</p>
                  {/* Đếm TẤT CẢ device không phải healthy (warning + critical + inactive offline) */}
                  <p className="font-hanken text-xl font-bold text-amber-600">
                    {fHeatmapCells.filter(c => c.status !== 'healthy' && c.isOffline).length}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase">Ngưng</p>
                  <p className="font-hanken text-xl font-bold text-slate-600">
                    {fHeatmapCells.filter(c => c.status === 'inactive').length}
                  </p>
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
          ) : fOfflineAlerts.length === 0 ? (
            <div className="py-10 text-center text-xs text-on-surface-variant">
              <div className="text-3xl mb-2">✅</div>
              <p>Tất cả thiết bị đang hoạt động</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {fOfflineAlerts.map((a, i) => (
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
