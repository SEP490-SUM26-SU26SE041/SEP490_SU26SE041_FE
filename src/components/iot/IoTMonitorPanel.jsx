import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { batchesApi, experimentsApi } from '../../api/experimentApi';
import { tasksApi } from '../../api/sharedTaskApi';
import {
  iotDevicesApi,
  SENSOR_META,
  SensorType,
  classifyDevice,
  classifySensorByCode
} from '../../api/iotDevicesApi';
import { LineChart, StatusHeatmap } from '../dashboard/Charts';

const REFRESH_MS = 30_000; // 30s cho Student/Tech (đỡ tải server)

// ── Mini sparkline (12 điểm gần nhất) ─────────────────────────────────────────
const Sparkline = ({ values = [], color = '#486730', height = 22 }) => {
  if (!values || values.length < 2) return null;
  const w = 100, h = height;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = w / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('vi-VN', { hour12: false }); } catch { return '—'; }
};
const fmtTimeShort = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('vi-VN', { hour12: false }); } catch { return '—'; }
};

// Cảnh báo cơ bản theo sensorCode (giống MonitoringDashboard)
const getWarn = (code, value) => {
  if (value === null || value === undefined || isNaN(value)) return null;
  const upper = String(code).toUpperCase();
  if (upper.includes('PH')) {
    if (value < 5 || value > 9) return '🚨 pH ngoài ngưỡng!';
    if (value < 6 || value > 8.5) return '⚠ pH hơi lệch';
    return null;
  }
  if (upper.includes('TEMP')) {
    if (value < 10 || value > 40) return '🚨 Nhiệt độ bất thường!';
    return null;
  }
  if (upper.includes('HUM')) {
    if (value < 30 || value > 90) return '⚠ Độ ẩm KK bất thường';
    return null;
  }
  return null;
};

/**
 * Unwrap response sensor-data (giống BatchIoTRealtimeModal)
 */
function unwrapSensorData(v) {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== 'object') return [];
  if (v.success && v.data) return unwrapSensorData(v.data);
  if (Array.isArray(v.data)) return v.data;
  if (v.data && typeof v.data === 'object') {
    const inner = v.data;
    if (Array.isArray(inner)) return inner;
    return inner.sensorData || inner.records || inner.data || [];
  }
  if (Array.isArray(v.sensorData)) return v.sensorData;
  if (Array.isArray(v.records)) return v.records;
  if (Array.isArray(v.items)) return v.items;
  return [];
}

/**
 * IoTMonitorPanel
 * Read-only IoT monitoring cho Student & Technician:
 *   - Liệt kê tất cả batch có gán cho user (qua tasks API)
 *   - Khi chọn 1 batch → hiển thị devices + sensors + chart 24h
 *   - Auto-refresh 30s
 *
 * Props: (tất cả optional)
 *   - defaultBatchId: chọn sẵn 1 batch
 *   - scope: 'task' | 'all'  (mặc định 'task' = các batch của task cá nhân)
 */
const IoTMonitorPanel = ({ defaultBatchId = null, scope = 'task' }) => {
  const { showToast } = useToast();
  const [availableBatches, setAvailableBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState(defaultBatchId || '');

  // Data cho batch đang chọn
  const [devices, setDevices] = useState([]);
  const [latestBySensor, setLatestBySensor] = useState({});
  const [historyBySensor, setHistoryBySensor] = useState({});
  const [loadingData, setLoadingData] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());

  const isMountedRef = useRef(true);
  const pollRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── 1) Lấy danh sách batch user được assign (qua tasks + experiments) ──
  const loadBatches = useCallback(async () => {
    try {
      setLoadingBatches(true);
      let batchMap = new Map(); // id → { id, code, experimentTitle }

      if (scope === 'task') {
        // Lấy tất cả tasks của user → unique batchIds
        const myTasks = await tasksApi.getMy().catch(() => []);
        const arr = Array.isArray(myTasks) ? myTasks : [];
        for (const t of arr) {
          const id = t.batchId || t.batch?.id;
          if (!id) continue;
          if (!batchMap.has(id)) {
            batchMap.set(id, {
              id,
              code: t.batchCode || t.batch?.batchCode || `Batch #${String(id).slice(0, 6)}`,
              experimentTitle: t.experimentTitle || t.batch?.experimentTitle || '',
              experimentId: t.experimentId || t.batch?.experimentId || null,
              taskCount: 0
            });
          }
          batchMap.get(id).taskCount++;
        }
      } else {
        // Lấy tất cả experiments → batches
        const exps = await experimentsApi.getAll().catch(() => []);
        const expList = Array.isArray(exps) ? exps : (exps?.data || []);
        for (const exp of expList) {
          try {
            const batches = await batchesApi.getByExperiment(exp.id).catch(() => []);
            const arr = Array.isArray(batches) ? batches : (batches?.data || []);
            for (const b of arr) {
              if (!b?.id) continue;
              if (!batchMap.has(b.id)) {
                batchMap.set(b.id, {
                  id: b.id,
                  code: b.batchCode || b.code || `Batch #${String(b.id).slice(0, 6)}`,
                  experimentTitle: exp.title || exp.experimentTitle || exp.name || '',
                  experimentId: exp.id,
                  taskCount: null
                });
              }
            }
          } catch { /* silent */ }
        }
      }

      const list = Array.from(batchMap.values()).sort((a, b) => {
        if (a.experimentTitle && b.experimentTitle) return a.experimentTitle.localeCompare(b.experimentTitle);
        return (a.code || '').localeCompare(b.code || '');
      });
      if (isMountedRef.current) {
        setAvailableBatches(list);
        // Auto-select: ưu tiên defaultBatchId → batch đầu tiên
        if (!selectedBatchId) {
          if (defaultBatchId && list.find(b => b.id === defaultBatchId)) {
            setSelectedBatchId(defaultBatchId);
          } else if (list.length > 0) {
            setSelectedBatchId(list[0].id);
          }
        }
      }
    } catch (err) {
      showToast(err?.message || 'Không thể tải danh sách batch', 'error');
    } finally {
      if (isMountedRef.current) setLoadingBatches(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, defaultBatchId]);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  // ── 2) Load devices + sensor history cho batch đang chọn ───────────────
  const loadBatchData = useCallback(async () => {
    if (!selectedBatchId) {
      setDevices([]);
      setLatestBySensor({});
      setHistoryBySensor({});
      return;
    }
    try {
      setRefreshing(true);
      const list = await iotDevicesApi.getByBatch(selectedBatchId).catch(() => []);
      const arr = Array.isArray(list) ? list : (list?.data || list?.items || []);
      if (isMountedRef.current) setDevices(arr);

      const active = arr.filter(d => classifyDevice(d) !== 'inactive');
      if (active.length === 0) {
        if (isMountedRef.current) {
          setLatestBySensor({});
          setHistoryBySensor({});
          setLastSync(new Date());
        }
        return;
      }

      const toDate = new Date();
      const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const results = await Promise.allSettled(
        active.map(d => iotDevicesApi.getSensorData(d.id, {
          fromDate: fromDate.toISOString(),
          toDate: toDate.toISOString(),
          limit: 2000
        })
          .then(v => {
            const sensorData = unwrapSensorData(v);
            return { deviceId: d.id, deviceCode: d.deviceCode, sensorData };
          })
          .catch(() => ({ deviceId: d.id, deviceCode: d.deviceCode, sensorData: [] })))
      );

      // Group theo sensorCode
      const merged = {};
      const latestMap = {};
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;

      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        const { deviceId, deviceCode, sensorData } = r.value;
        for (const rec of sensorData) {
          if (!rec) continue;
          const code = rec.sensorCode || rec.sensorId || rec.code;
          if (!code) continue;
          const recordedAt = rec.recordedAt || rec.timestamp;
          if (!recordedAt) continue;
          const recTime = new Date(recordedAt).getTime();
          if (recTime < cutoff) continue;
          const value = rec.value ?? rec.sensorValue;
          if (value === null || value === undefined) continue;
          if (!merged[code]) merged[code] = [];
          merged[code].push({
            recordedAt,
            value: Number(value),
            sensorCode: code,
            sensorType: rec.sensorType,
            minThreshold: rec.minThreshold,
            maxThreshold: rec.maxThreshold,
            unit: rec.unit,
            deviceId,
            deviceCode
          });
          const existing = latestMap[code];
          if (!existing || recTime > new Date(existing.recordedAt).getTime()) {
            latestMap[code] = {
              value: Number(value),
              recordedAt,
              sensorType: rec.sensorType,
              minThreshold: rec.minThreshold,
              maxThreshold: rec.maxThreshold,
              unit: rec.unit,
              deviceId,
              deviceCode,
              sensorCode: code
            };
          }
        }
      }
      for (const k of Object.keys(merged)) {
        merged[k].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
      }
      if (isMountedRef.current) {
        setHistoryBySensor(merged);
        setLatestBySensor(latestMap);
        setLastSync(new Date());
      }
    } catch (err) {
      console.warn('[IoTMonitorPanel] loadBatchData', err?.message || err);
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    if (isMountedRef.current) setLoadingData(true);
    loadBatchData().finally(() => {
      if (isMountedRef.current) setLoadingData(false);
    });
  }, [loadBatchData]);

  // ── Auto-poll mỗi 30s ─────────────────────────────────────────────────
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selectedBatchId) return;
    pollRef.current = setInterval(() => {
      loadBatchData();
    }, REFRESH_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedBatchId, loadBatchData]);

  // ── Derived data ──────────────────────────────────────────────────────
  const allSensorCodes = useMemo(() => Array.from(new Set([
    ...Object.keys(latestBySensor),
    ...Object.keys(historyBySensor)
  ])).sort(), [latestBySensor, historyBySensor]);

  const sensorMetaMap = useMemo(() => allSensorCodes.map(code => {
    const latest = latestBySensor[code] || {};
    const meta = classifySensorByCode(code, latest.sensorType);
    return { code, ...meta, latest };
  }), [allSensorCodes, latestBySensor]);

  const onlineCount = devices.filter(d => classifyDevice(d) === 'healthy').length;
  const offlineCount = devices.filter(d => !d.isOnline).length;
  const alertCount = sensorMetaMap.filter(s => {
    const v = s.latest?.value;
    return getWarn(s.code, v);
  }).length;

  const selectedBatch = availableBatches.find(b => b.id === selectedBatchId);

  // helper: build chart points
  const toChartPoints = (records) => {
    if (!records || records.length === 0) return [];
    return records.map(r => {
      const d = new Date(r.recordedAt);
      return {
        label: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        value: Number(r.value)
      };
    });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header chọn batch */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-hanken text-base font-bold text-slate-900 flex items-center gap-2">
              <span>📡</span> Giám sát IoT
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {scope === 'task'
                ? 'Chỉ hiển thị các batch được giao cho bạn.'
                : 'Tất cả các batch trong hệ thống.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              disabled={loadingBatches}
              className="px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px] disabled:bg-slate-50"
            >
              {loadingBatches ? (
                <option>Đang tải batch...</option>
              ) : availableBatches.length === 0 ? (
                <option value="">— Chưa có batch —</option>
              ) : (
                <>
                  <option value="">— Chọn batch —</option>
                  {availableBatches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.experimentTitle
                        ? `🌱 ${b.experimentTitle} · ${b.code}${b.taskCount ? ` (${b.taskCount} việc)` : ''}`
                        : `📦 ${b.code}`}
                    </option>
                  ))}
                </>
              )}
            </select>
            <button
              onClick={loadBatchData}
              disabled={!selectedBatchId || refreshing}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {refreshing ? (
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : '🔄'}
              {refreshing ? 'Đang tải' : 'Làm mới'}
            </button>
          </div>
        </div>
        {selectedBatch && (
          <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px]">
            <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-bold">📦 {selectedBatch.code}</span>
            {selectedBatch.experimentTitle && (
              <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-bold">🌱 {selectedBatch.experimentTitle}</span>
            )}
            <span className="text-slate-400 font-mono">
              Cập nhật: {lastSync.toLocaleTimeString('vi-VN')} · Auto-refresh 30s
            </span>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!selectedBatchId && !loadingBatches && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-3">📡</div>
          <p className="text-sm text-slate-500 font-bold">Chọn một batch phía trên để xem dữ liệu IoT</p>
          <p className="text-xs text-slate-400 mt-2">
            Bạn có thể xem chỉ số cảm biến mới nhất và biểu đồ 24h để tham khảo khi viết báo cáo công việc.
          </p>
        </div>
      )}

      {/* Khi đã chọn batch */}
      {selectedBatchId && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              label="Tổng thiết bị"
              value={devices.length}
              icon="📱"
              color="blue"
            />
            <KpiCard
              label="Đang hoạt động"
              value={onlineCount}
              icon="✅"
              color="emerald"
            />
            <KpiCard
              label="Mất kết nối"
              value={offlineCount}
              icon="📴"
              color={offlineCount > 0 ? 'rose' : 'slate'}
            />
            <KpiCard
              label="Cảnh báo"
              value={alertCount}
              icon="🚨"
              color={alertCount > 0 ? 'rose' : 'slate'}
            />
          </div>

          {loadingData ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
              <div className="text-3xl mb-2 animate-pulse">⏳</div>
              <p className="text-sm">Đang tải dữ liệu cảm biến...</p>
            </div>
          ) : (
            <>
              {/* Section 1: Sensor values realtime */}
              <section className="bg-gradient-to-r from-cyan-50 via-sky-50 to-indigo-50 border border-cyan-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="font-hanken text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>📊</span> Chỉ số môi trường mới nhất ({sensorMetaMap.length})
                  </h3>
                  <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                </div>
                {sensorMetaMap.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500 bg-white/50 rounded-xl border border-dashed border-cyan-200">
                    Chưa có dữ liệu cảm biến. Hãy chờ thiết bị gửi về...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {sensorMetaMap.map(({ code, label, icon, unit, color, latest }) => {
                      const val = latest?.value;
                      const warn = getWarn(code, val);
                      const history = (historyBySensor[code] || []).slice(-12);
                      return (
                        <div key={code} className={`bg-white rounded-xl p-3 border-2 shadow-sm transition-all hover:scale-[1.02] ${warn ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-base">{icon}</span>
                            <code className="text-[9px] font-mono text-slate-400">{code}</code>
                          </div>
                          <p className="text-[10px] font-bold uppercase text-slate-500 leading-tight mb-1">{label}</p>
                          <div className="flex items-end gap-1">
                            <p className={`text-xl font-black tracking-tight ${warn ? 'text-rose-700' : 'text-slate-900'}`}>
                              {val !== null && val !== undefined ? val : '—'}
                              <span className="text-[10px] font-bold text-slate-500 ml-0.5">{unit || ''}</span>
                            </p>
                            {warn && <span className="text-[10px] animate-pulse">🚨</span>}
                          </div>
                          {history.length > 1 && (
                            <Sparkline
                              values={history.map(r => r.value)}
                              color={warn ? '#e11d48' : color}
                              height={20}
                            />
                          )}
                          <p className="text-[9px] text-slate-400 mt-1 truncate">
                            🕒 {fmtTimeShort(latest?.recordedAt)}
                          </p>
                          {warn && <p className="text-[9px] font-bold text-rose-700 mt-0.5">{warn}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Section 2: Devices list */}
              <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-hanken text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <span>📱</span> Thiết bị IoT của batch ({devices.length})
                </h3>
                {devices.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Batch này chưa có thiết bị IoT nào.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {devices.map(d => {
                      const status = classifyDevice(d);
                      const sensors = Array.isArray(d.sensors) ? d.sensors : [];
                      return (
                        <div key={d.id} className={`bg-white border rounded-lg p-3 ${status === 'healthy' ? 'border-emerald-200' : 'border-slate-200'}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="font-mono text-[11px] font-bold text-blue-700 truncate">{d.deviceCode}</span>
                              <span className="font-bold text-sm text-slate-900 truncate">{d.deviceName}</span>
                            </div>
                            <DeviceStatusBadge status={status} isOnline={d.isOnline} />
                          </div>
                          <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-2 gap-y-0.5">
                            {d.isOnline === false && <span className="text-rose-600 font-bold">Offline</span>}
                            {d.macAddress && <span>MAC: {d.macAddress}</span>}
                            <span>{d.deviceType || 'ESP32-C3'}</span>
                            {sensors.length > 0 && <span>{sensors.length} cảm biến</span>}
                            {d.lastActiveAt && <span>Cuối: {fmtTimeShort(d.lastActiveAt)}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Section 3: Charts 24h */}
              {sensorMetaMap.length > 0 && (
                <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-hanken text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <span>📈</span> Biểu đồ 24h ({sensorMetaMap.length} cảm biến)
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {sensorMetaMap.map(({ code, label, icon, unit, color, fillColor, latest }) => {
                      const points = toChartPoints(historyBySensor[code] || []);
                      const val = latest?.value;
                      const warn = getWarn(code, val);
                      return (
                        <div key={code} className={`rounded-xl p-3 border ${warn ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50/30 border-slate-100'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <span className="text-base">{icon}</span> {label}{unit ? ` (${unit})` : ''}
                            </span>
                            <div className="flex items-center gap-2">
                              <code className="text-[9px] font-mono text-slate-400">{code}</code>
                              <span className={`text-sm font-mono font-bold ${warn ? 'text-rose-700' : 'text-blue-700'}`}>
                                {val !== null && val !== undefined ? `${val}${unit || ''}` : '—'}
                              </span>
                            </div>
                          </div>
                          {points.length > 0 ? (
                            <LineChart data={points} color={color} fillColor={fillColor} unit={unit} height={140} />
                          ) : (
                            <div className="h-[140px] flex items-center justify-center text-xs text-slate-400 bg-white rounded">
                              📭 Chưa có dữ liệu 24h
                            </div>
                          )}
                          <p className="text-[9px] text-slate-400 mt-1">
                            🕒 {fmtTime(latest?.recordedAt)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Section 4: Heatmap */}
              {sensorMetaMap.length > 0 && (
                <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <h3 className="font-hanken text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <span>🟦</span> Bản đồ nhiệt cảm biến
                  </h3>
                  <StatusHeatmap
                    sensors={sensorMetaMap.map(({ code, label, icon, unit, color, latest }) => {
                      const points = historyBySensor[code] || [];
                      return {
                        code,
                        label,
                        icon,
                        unit,
                        color,
                        type: latest?.sensorType,
                        values: points.map(p => ({
                          time: p.recordedAt,
                          value: Number(p.value)
                        }))
                      };
                    })}
                  />
                </section>
              )}

              {/* Section 5: Truy vấn dữ liệu theo khoảng thời gian tùy ý */}
              <TimeRangeQuery
                devices={devices}
                sensorMetaMap={sensorMetaMap}
              />

              {/* Footer hướng dẫn */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800">
                <p className="font-bold flex items-center gap-1.5">💡 Mẹo dùng cho báo cáo công việc</p>
                <p className="mt-1">
                  Khi làm việc với batch <strong>{selectedBatch?.code}</strong>, bạn có thể dùng phần <strong>📊 Truy vấn dữ liệu theo khoảng thời gian</strong> ở trên để so sánh chỉ số trước/sau khi thực hiện tác vụ (ví dụ: trước/sau khi tưới nước, bón phân...). Kết quả có thể dùng làm số liệu tham khảo khi viết báo cáo.
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

// ── TimeRangeQuery: truy vấn dữ liệu cảm biến theo khoảng thời gian tùy ý ──
// Dùng để so sánh trước/sau khi thực hiện tác vụ (vd: trước/sau tưới nước).
// Có sẵn các khoảng preset (1h, 6h, 24h, 7 ngày) + cho phép chọn tùy ý.
const PRESETS = [
  { id: '1h',  label: '1 giờ qua',  hours: 1 },
  { id: '6h',  label: '6 giờ qua',  hours: 6 },
  { id: '24h', label: '24 giờ qua', hours: 24 },
  { id: '7d',  label: '7 ngày qua', hours: 24 * 7 },
  { id: '30d', label: '30 ngày qua', hours: 24 * 30 }
];

const toLocalInput = (date) => {
  // YYYY-MM-DDTHH:mm (cho <input type="datetime-local">)
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const TimeRangeQuery = ({ devices, sensorMetaMap }) => {
  const { showToast } = useToast();
  const [preset, setPreset] = useState('24h');
  const [fromDate, setFromDate] = useState(() => toLocalInput(new Date(Date.now() - 24 * 60 * 60 * 1000)));
  const [toDate, setToDate] = useState(() => toLocalInput(new Date()));
  const [loading, setLoading] = useState(false);
  // { sensorCode: [{ recordedAt, value, unit, deviceCode }] }
  const [rangeData, setRangeData] = useState({});

  // Khi user đổi preset → tự tính lại fromDate/toDate
  useEffect(() => {
    if (preset === 'custom') return;
    const p = PRESETS.find(x => x.id === preset);
    if (!p) return;
    const to = new Date();
    const from = new Date(Date.now() - p.hours * 60 * 60 * 1000);
    setFromDate(toLocalInput(from));
    setToDate(toLocalInput(to));
  }, [preset]);

  // Tự động query khi fromDate/toDate thay đổi (debounce 600ms)
  useEffect(() => {
    if (!devices || devices.length === 0) {
      setRangeData({});
      return;
    }
    const t = setTimeout(() => {
      fetchRange();
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, devices.length]);

  const fetchRange = useCallback(async () => {
    if (!devices || devices.length === 0) return;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      showToast('Khoảng thời gian không hợp lệ', 'error');
      return;
    }
    if (from >= to) {
      showToast('Thời điểm bắt đầu phải trước thời điểm kết thúc', 'error');
      return;
    }
    const spanMs = to.getTime() - from.getTime();
    if (spanMs > 60 * 24 * 60 * 60 * 1000) {
      showToast('Vui lòng chọn khoảng thời gian ≤ 60 ngày', 'warning');
      return;
    }

    try {
      setLoading(true);
      const active = devices.filter(d => classifyDevice(d) !== 'inactive');
      const results = await Promise.allSettled(
        active.map(d => iotDevicesApi.getSensorData(d.id, {
          fromDate: from.toISOString(),
          toDate: to.toISOString(),
          limit: 5000
        })
          .then(v => {
            const sensorData = unwrapSensorData(v);
            return { deviceId: d.id, deviceCode: d.deviceCode, sensorData };
          })
          .catch(() => ({ deviceId: d.id, deviceCode: d.deviceCode, sensorData: [] })))
      );

      const merged = {};
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        const { deviceId, deviceCode, sensorData } = r.value;
        for (const rec of sensorData) {
          if (!rec) continue;
          const code = rec.sensorCode || rec.sensorId || rec.code;
          if (!code) continue;
          const recordedAt = rec.recordedAt || rec.timestamp;
          if (!recordedAt) continue;
          const t = new Date(recordedAt).getTime();
          if (t < from.getTime() || t > to.getTime()) continue;
          const value = rec.value ?? rec.sensorValue;
          if (value === null || value === undefined) continue;
          if (!merged[code]) merged[code] = [];
          merged[code].push({
            recordedAt,
            value: Number(value),
            sensorCode: code,
            sensorType: rec.sensorType,
            unit: rec.unit,
            minThreshold: rec.minThreshold,
            maxThreshold: rec.maxThreshold,
            deviceId,
            deviceCode
          });
        }
      }
      // Sort theo thời gian tăng dần
      for (const k of Object.keys(merged)) {
        merged[k].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
      }
      setRangeData(merged);
    } catch (err) {
      console.warn('[TimeRangeQuery]', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [devices, fromDate, toDate, showToast]);

  // Tính summary cho mỗi sensor: first/last/avg/min/max
  const summary = useMemo(() => {
    const rows = [];
    for (const code of Object.keys(rangeData)) {
      const arr = rangeData[code];
      if (!arr.length) continue;
      const values = arr.map(r => r.value);
      const sum = values.reduce((a, b) => a + b, 0);
      const first = arr[0];
      const last = arr[arr.length - 1];
      const meta = sensorMetaMap.find(s => s.code === code) || classifySensorByCode(code);
      rows.push({
        code,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        unit: first.unit || meta.unit || '',
        count: arr.length,
        first: first.value,
        firstAt: first.recordedAt,
        last: last.value,
        lastAt: last.recordedAt,
        avg: sum / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        delta: last.value - first.value,
        deltaPct: first.value !== 0 ? ((last.value - first.value) / first.value) * 100 : null
      });
    }
    return rows.sort((a, b) => a.label.localeCompare(b.label));
  }, [rangeData, sensorMetaMap]);

  const totalRecords = Object.values(rangeData).reduce((s, arr) => s + arr.length, 0);
  const spanHours = ((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (60 * 60 * 1000)).toFixed(1);

  const exportCSV = () => {
    if (summary.length === 0) {
      showToast('Không có dữ liệu để xuất', 'warning');
      return;
    }
    // CSV: header + mỗi sensor 1 dòng summary + raw rows
    let csv = '';
    csv += `# Khoảng thời gian: ${new Date(fromDate).toLocaleString('vi-VN')} → ${new Date(toDate).toLocaleString('vi-VN')}\n`;
    csv += `# Tổng ${totalRecords} bản ghi, ${summary.length} cảm biến\n\n`;
    csv += `STT,Cảm biến,Code,Số bản ghi,Đầu kỳ,Cuối kỳ,Trung bình,Min,Max,Delta,Delta %,Đơn vị,Thiết bị\n`;
    summary.forEach((r, i) => {
      csv += [
        i + 1,
        `"${r.label}"`,
        r.code,
        r.count,
        r.first.toFixed(2),
        r.last.toFixed(2),
        r.avg.toFixed(2),
        r.min.toFixed(2),
        r.max.toFixed(2),
        r.delta.toFixed(2),
        r.deltaPct !== null ? r.deltaPct.toFixed(2) + '%' : '',
        r.unit,
        r.count > 0 ? rangeData[r.code][0].deviceCode : ''
      ].join(',') + '\n';
    });
    // Raw data
    csv += '\n\n# Dữ liệu chi tiết\n';
    csv += 'Thời gian,Cảm biến (Code),Giá trị,Đơn vị,Thiết bị\n';
    for (const code of Object.keys(rangeData)) {
      for (const rec of rangeData[code]) {
        csv += [
          `"${new Date(rec.recordedAt).toLocaleString('vi-VN')}"`,
          rec.code,
          rec.value,
          rec.unit || '',
          rec.deviceCode
        ].join(',') + '\n';
      }
    }
    // BOM cho Excel nhận diện UTF-8
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iot-${new Date(fromDate).toISOString().slice(0, 10)}-to-${new Date(toDate).toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất CSV', 'success');
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-hanken text-base font-bold text-slate-900 flex items-center gap-2">
          <span>📊</span> Truy vấn dữ liệu theo khoảng thời gian
        </h3>
        {false && summary.length > 0 && (
          <button
            type="button"
            onClick={exportCSV}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5"
          >
            <span>⬇</span> Xuất CSV
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-4">
        So sánh chỉ số môi trường trước/sau khi thực hiện tác vụ (tưới nước, bón phân, kiểm tra...) để tham khảo khi viết báo cáo.
      </p>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
        {/* Preset buttons */}
        <div className="md:col-span-5">
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Khoảng nhanh</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESETS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  preset === p.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPreset('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                preset === 'custom'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tùy chỉnh
            </button>
          </div>
        </div>
        {/* From */}
        <div className="md:col-span-3">
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Từ</label>
          <input
            type="datetime-local"
            value={fromDate}
            disabled={preset !== 'custom'}
            onChange={e => { setPreset('custom'); setFromDate(e.target.value); }}
            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </div>
        {/* To */}
        <div className="md:col-span-3">
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Đến</label>
          <input
            type="datetime-local"
            value={toDate}
            disabled={preset !== 'custom'}
            onChange={e => { setPreset('custom'); setToDate(e.target.value); }}
            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-400"
          />
        </div>
        {/* Reload */}
        <div className="md:col-span-1 flex items-end">
          <button
            type="button"
            onClick={fetchRange}
            disabled={loading}
            className="w-full px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-50 flex items-center justify-center"
            title="Truy vấn lại"
          >
            {loading ? (
              <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : '🔍'}
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-3 flex-wrap">
        <span className="px-2 py-0.5 bg-slate-100 rounded font-bold uppercase">Khoảng: {spanHours} giờ</span>
        <span className="px-2 py-0.5 bg-slate-100 rounded font-bold uppercase">Bản ghi: {totalRecords}</span>
        <span className="px-2 py-0.5 bg-slate-100 rounded font-bold uppercase">Cảm biến: {summary.length}</span>
        {loading && <span className="text-blue-600 font-bold">⏳ Đang tải...</span>}
      </div>

      {/* Summary table */}
      {summary.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-600">Cảm biến</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-600">Số mẫu</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-600">Đầu kỳ</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-600">Cuối kỳ</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-600">Δ (thay đổi)</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-600">Δ %</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-600">Trung bình</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-600">Min / Max</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-600">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row) => {
                const deltaColor = Math.abs(row.delta) < 0.001
                  ? 'text-slate-500'
                  : row.delta > 0
                    ? 'text-emerald-600'
                    : 'text-rose-600';
                const deltaSign = row.delta > 0 ? '+' : '';
                const pctSign = row.deltaPct !== null && row.deltaPct > 0 ? '+' : '';
                return (
                  <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{row.icon}</span>
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-tight">{row.label}</p>
                          <code className="text-[9px] font-mono text-slate-400">{row.code}</code>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-mono text-slate-600">{row.count}</td>
                    <td className="px-3 py-2 text-right">
                      <p className="text-xs font-bold text-slate-700 font-mono">{row.first.toFixed(2)}<span className="text-[9px] text-slate-400 ml-0.5">{row.unit}</span></p>
                      <p className="text-[9px] text-slate-400 font-mono">{fmtTimeShort(row.firstAt)}</p>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <p className="text-xs font-bold text-slate-900 font-mono">{row.last.toFixed(2)}<span className="text-[9px] text-slate-400 ml-0.5">{row.unit}</span></p>
                      <p className="text-[9px] text-slate-400 font-mono">{fmtTimeShort(row.lastAt)}</p>
                    </td>
                    <td className={`px-3 py-2 text-right text-xs font-bold font-mono ${deltaColor}`}>
                      {deltaSign}{row.delta.toFixed(2)}<span className="text-[9px] ml-0.5">{row.unit}</span>
                    </td>
                    <td className={`px-3 py-2 text-right text-xs font-bold font-mono ${deltaColor}`}>
                      {row.deltaPct !== null ? `${pctSign}${row.deltaPct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-mono text-slate-700">
                      {row.avg.toFixed(2)}<span className="text-[9px] text-slate-400 ml-0.5">{row.unit}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-[10px] font-mono text-slate-500">
                      {row.min.toFixed(1)} / {row.max.toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-[9px] text-slate-500 font-mono">
                      {fmtTime(row.firstAt)}<br />→ {fmtTime(row.lastAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          {loading
            ? '⏳ Đang truy vấn dữ liệu...'
            : devices.length === 0
              ? 'Batch này chưa có thiết bị IoT hoạt động.'
              : '📭 Không có dữ liệu cảm biến trong khoảng thời gian này. Thử chọn khoảng rộng hơn.'}
        </div>
      )}

      {/* Charts cho từng sensor trong range */}
      {summary.length > 0 && (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {summary.map((row) => {
            const points = (rangeData[row.code] || []).map(r => {
              const d = new Date(r.recordedAt);
              return {
                label: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
                value: Number(r.value)
              };
            });
            return (
              <div key={row.code} className="rounded-xl p-3 border border-slate-200 bg-slate-50/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{row.icon}</span>
                    <span className="text-xs font-bold text-slate-700">{row.label}</span>
                    <code className="text-[9px] font-mono text-slate-400">({row.code})</code>
                  </div>
                  <div className="text-right text-[10px] font-mono">
                    <span className="text-slate-500">{row.first.toFixed(1)} → </span>
                    <span className="font-bold text-slate-900">{row.last.toFixed(1)}</span>
                    <span className="text-slate-500 ml-1">{row.unit}</span>
                  </div>
                </div>
                <LineChart data={points} color={row.color} fillColor={`${row.color}20`} unit={row.unit} height={120} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color = 'blue' }) => {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-600'
  };
  return (
    <div className={`${colorMap[color] || colorMap.blue} border rounded-2xl p-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-hanken text-2xl font-bold">{value}</p>
    </div>
  );
};

const DeviceStatusBadge = ({ status, isOnline }) => {
  const map = {
    healthy: { label: 'Hoạt động', cls: 'bg-emerald-100 text-emerald-700' },
    warning: { label: 'Mất kết nối', cls: 'bg-amber-100 text-amber-700' },
    critical: { label: 'Lỗi', cls: 'bg-rose-100 text-rose-700' },
    inactive: { label: 'Ngưng', cls: 'bg-slate-100 text-slate-600' }
  };
  // Sửa logic: nếu device.isActive=false → inactive; nếu isOnline=false (và đang active) → warning
  let s = status;
  if (isOnline === false && s === 'healthy') s = 'warning';
  const m = map[s] || map.inactive;
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${m.cls}`}>
      {m.label}
    </span>
  );
};

export default IoTMonitorPanel;
