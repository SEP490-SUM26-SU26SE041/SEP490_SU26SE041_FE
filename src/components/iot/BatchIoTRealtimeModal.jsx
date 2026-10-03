import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  iotDevicesApi,
  SENSOR_META,
  SensorType,
  classifyDevice,
  classifySensorByCode,
  normalizeSensorKey
} from '../../api/iotDevicesApi';
import { LineChart, StatusHeatmap } from '../dashboard/Charts';

// ── Status badge style cho thiết bị ─────────────────────────────────────────────
const DEVICE_STATUS = {
  healthy:  { label: 'Hoạt động', cls: 'bg-emerald-100 text-emerald-700' },
  warning:  { label: 'Mất kết nối', cls: 'bg-amber-100 text-amber-700' },
  critical: { label: 'Lỗi', cls: 'bg-rose-100 text-rose-700' },
  inactive: { label: 'Ngưng', cls: 'bg-slate-100 text-slate-600' }
};

const sensorMetaByCode = (code, sensorTypeName) => {
  return classifySensorByCode(code, sensorTypeName) || SENSOR_META[SensorType.Other];
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('vi-VN', { hour12: false }); }
  catch { return '—'; }
};

const fmtTimeShort = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('vi-VN', { hour12: false }); }
  catch { return '—'; }
};

const isOutOfRange = (value, min, max) => {
  if (value === null || value === undefined || isNaN(value)) return false;
  const n = Number(value);
  if (min !== null && min !== undefined && n < Number(min)) return true;
  if (max !== null && max !== undefined && n > Number(max)) return true;
  return false;
};

/**
 * Unwrap response từ BE theo nhiều format - thử từng lớp.
 * Hỗ trợ: array trực tiếp, {data: array}, {data: {sensorData: array}}, {sensorData: array}, {records: array}
 */
function unwrapSensorData(v) {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== 'object') return [];
  // { success, data: ... } → unwrap data
  if (v.success && v.data) {
    return unwrapSensorData(v.data);
  }
  // { data: [...] } flat array
  if (Array.isArray(v.data)) return v.data;
  // { data: { sensorData: [...] } } hoặc { data: { records: [...] } }
  if (v.data && typeof v.data === 'object') {
    const inner = v.data;
    if (Array.isArray(inner)) return inner;
    return inner.sensorData || inner.records || inner.data || [];
  }
  // { sensorData: [...] }, { records: [...] }, { items: [...] }
  if (Array.isArray(v.sensorData)) return v.sensorData;
  if (Array.isArray(v.records)) return v.records;
  if (Array.isArray(v.items)) return v.items;
  if (Array.isArray(v.results)) return v.results;
  // Nếu v là { deviceId, deviceCode, sensorData: [...] } (format đã chuẩn hóa)
  if (Array.isArray(v.sensorData)) return v.sensorData;
  return [];
}

/**
 * MiniChart — Inline SVG sparkline với hover tooltip
 * Self-contained, không phụ thuộc Charts.jsx
 */
const MiniChart = ({ data = [], color = '#486730', unit = '', label = '' }) => {
  const [hoverIdx, setHoverIdx] = React.useState(null);
  const ref = React.useRef(null);

  if (!data || data.length === 0) {
    return <div className="h-full flex items-center justify-center text-xs text-slate-400">📭 No data</div>;
  }

  const width = 600;
  const height = 200;
  const padding = { top: 12, right: 12, bottom: 24, left: 38 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const values = data.map(d => d.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const stepX = innerW / Math.max(data.length - 1, 1);

  const points = data.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + innerH - ((d.value - min) / range) * innerH,
    value: d.value,
    time: d.x,
    idx: i
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padding.top + innerH).toFixed(1)} Z`;

  // Y-axis ticks
  const yTicks = [0, 0.5, 1].map(f => ({
    v: min + range * (1 - f),
    y: padding.top + innerH * f
  }));

  // X-axis labels (max 5)
  const xLabelCount = Math.min(5, data.length);
  const xLabels = [];
  for (let i = 0; i < xLabelCount; i++) {
    const idx = Math.floor(i * (data.length - 1) / Math.max(xLabelCount - 1, 1));
    const ts = new Date(data[idx].x);
    const timeStr = `${ts.getHours().toString().padStart(2, '0')}:${ts.getMinutes().toString().padStart(2, '0')}`;
    xLabels.push({ x: points[idx].x, label: timeStr });
  }

  // Hover crosshair
  const hoverPoint = hoverIdx !== null && hoverIdx >= 0 && hoverIdx < points.length ? points[hoverIdx] : null;

  // Format hover time
  const fmtHoverTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.toLocaleDateString('vi-VN')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  const handleMouseMove = (e) => {
    const svg = ref.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = width / rect.width;
    const vbX = (e.clientX - rect.left) * ratio;
    if (vbX < padding.left || vbX > width - padding.right) {
      setHoverIdx(null);
      return;
    }
    const idx = Math.round((vbX - padding.left) / stepX);
    const clamped = Math.max(0, Math.min(points.length - 1, idx));
    setHoverIdx(clamped);
  };

  return (
    <div className="w-full h-full relative" style={{ zIndex: hoverPoint ? 20 : 'auto' }}>
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full cursor-crosshair block"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id={`mc-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines */}
        {yTicks.map((t, i) => (
          <line
            key={`g${i}`}
            x1={padding.left} x2={width - padding.right}
            y1={t.y} y2={t.y}
            stroke="#e5e7eb" strokeDasharray="3 3" strokeWidth="1"
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((t, i) => (
          <text
            key={`yl${i}`}
            x={padding.left - 4} y={t.y + 3}
            fontSize="9" fill="#94a3b8" textAnchor="end"
            fontFamily="JetBrains Mono, monospace"
          >
            {Number(t.v).toFixed(1)}{unit}
          </text>
        ))}

        {/* Area */}
        <path d={areaPath} fill={`url(#mc-grad-${color.replace('#', '')})`} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* X-axis labels */}
        {xLabels.map((xl, i) => (
          <text
            key={`xl${i}`}
            x={xl.x} y={height - 4}
            fontSize="9" fill="#94a3b8" textAnchor="middle"
            fontFamily="JetBrains Mono, monospace"
          >
            {xl.label}
          </text>
        ))}

        {/* Hover crosshair */}
        {hoverPoint && (
          <>
            <line
              x1={hoverPoint.x} x2={hoverPoint.x}
              y1={padding.top} y2={padding.top + innerH}
              stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.6"
            />
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r="5" fill="white" stroke={color} strokeWidth="2.5" />
            <circle cx={hoverPoint.x} cy={hoverPoint.y} r="3" fill={color} />
          </>
        )}
      </svg>

      {/* Tooltip HTML overlay */}
      {hoverPoint && (
        <div
          className="absolute pointer-events-none bg-slate-900/95 text-white rounded-lg px-2.5 py-1.5 text-[10px] font-bold shadow-xl border border-white/20"
          style={{
            left: `${(hoverPoint.x / width) * 100}%`,
            top: `${(hoverPoint.y / height) * 100}%`,
            transform: 'translate(-50%, -130%)',
            whiteSpace: 'nowrap',
            zIndex: 30
          }}
        >
          <div className="font-mono text-[10px] opacity-70">{fmtHoverTime(hoverPoint.time)}</div>
          <div className="text-sm font-black">{Number(hoverPoint.value).toFixed(2)}{unit}</div>
        </div>
      )}
    </div>
  );
};

/**
 * BatchIoTRealtimeModal — Modal xem dữ liệu realtime cho 1 batch
 * Re-use CHÍNH XÁC logic MonitoringDashboard:
 *   - /iot-devices/{id}/sensor-data cho từng device active
 *   - Group theo sensorCode (giữ riêng 2 sensor cùng type, ví dụ TEMP-AIR vs TEMP-WATER)
 */
const BatchIoTRealtimeModal = ({ open, onClose, batch, devices: externalDevices = [] }) => {
  const [devices, setDevices] = useState(externalDevices);
  const devicesRef = useRef(externalDevices); // dùng để tránh stale closure trong loadAllHistory
  const [loading, setLoading] = useState(false);
  const [latestBySensor, setLatestBySensor] = useState({}); // {sensorCode: {value, recordedAt, ...}}
  const [historyBySensor, setHistoryBySensor] = useState({}); // {sensorCode: [{recordedAt, value, ...}]}
  const [refreshing, setRefreshing] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false); // Thu gọn danh sách thông báo IoT
  const pollRef = useRef(null);
  const isMountedRef = useRef(true);

  // Sync ref với state
  useEffect(() => { devicesRef.current = devices; }, [devices]);

  // Cleanup khi unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── 1) Lấy devices thuộc batch (cho UI cards) ─────────────────────────
  const loadDevices = useCallback(async () => {
    if (!batch?.id) return;
    try {
      setLoading(true);
      const list = await iotDevicesApi.getByBatch(batch.id);
      const arr = Array.isArray(list) ? list : (list?.data || list?.items || []);
      if (isMountedRef.current) setDevices(arr);
    } catch (e) {
      console.warn('[BatchIoTRealtime] load devices', e?.message || e);
      if (isMountedRef.current) setDevices([]);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [batch?.id]);

  // ── 2) Load sensor-data 24h cho devices ACTIVE trong batch ────────────
  // Re-use logic y hệt MonitoringDashboard.loadAllHistory (group by sensorCode)
  // Dùng devicesRef để tránh stale closure + tự load devices inline
  const loadAllHistory = useCallback(async () => {
    if (!batch?.id) return;
    try {
      setRefreshing(true);
      // Lấy devices thuộc batch (nếu state devices rỗng → gọi API)
      let devList = devicesRef.current;
      if (!devList || devList.length === 0) {
        try {
          const list = await iotDevicesApi.getByBatch(batch.id);
          devList = Array.isArray(list) ? list : (list?.data || list?.items || []);
          devicesRef.current = devList;
          if (isMountedRef.current) setDevices(devList);
        } catch (e) {
          console.warn('[BatchIoTRealtime] inline load devices', e?.message || e);
          devList = [];
        }
      }
      const active = (devList || []).filter(d => classifyDevice(d) !== 'inactive');
      if (active.length === 0) {
        if (isMountedRef.current) {
          setLatestBySensor({});
          setHistoryBySensor({});
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
        }).then(v => {
          // DEBUG: log raw response để biết structure thật
          if (import.meta.env.DEV && d._debug) {
            console.log(`[BatchIoTRealtime] device=${d.deviceCode} RAW:`, v);
          }
          const sensorData = unwrapSensorData(v);
          if (import.meta.env.DEV) {
            console.log(`[BatchIoTRealtime] device=${d.deviceCode} → unwrapped ${sensorData.length} records`);
            if (sensorData.length > 0) {
              console.log(`[BatchIoTRealtime] sample record:`, sensorData[0]);
            }
          }
          return { deviceId: d.id, deviceCode: d.deviceCode, sensorData };
        }).catch((err) => {
          console.warn(`[BatchIoTRealtime] sensor-data error for ${d.deviceCode}:`, err?.message);
          return { deviceId: d.id, deviceCode: d.deviceCode, sensorData: [] };
        }))
      );

      // Gộp tất cả records theo sensorCode
      const merged = {};
      const latestMap = {};

      const WINDOW_MS = 24 * 60 * 60 * 1000;
      const cutoff = Date.now() - WINDOW_MS;

      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        const { deviceId, deviceCode, sensorData } = r.value;
        for (const rec of sensorData) {
          if (!rec) continue;
          const code = rec.sensorCode || rec.sensorId || rec.code || rec.SensorCode;
          if (!code) continue;
          const recordedAt = rec.recordedAt || rec.timestamp || rec.RecordedAt;
          if (!recordedAt) continue;
          const recTime = new Date(recordedAt).getTime();
          if (recTime < cutoff) continue;
          const value = rec.value ?? rec.sensorValue ?? rec.Value;
          if (value === null || value === undefined) continue;
          if (!merged[code]) merged[code] = [];
          merged[code].push({
            recordedAt,
            value: Number(value),
            sensorCode: code,
            sensorType: rec.sensorType || rec.SensorType,
            minThreshold: rec.minThreshold ?? rec.MinThreshold,
            maxThreshold: rec.maxThreshold ?? rec.MaxThreshold,
            unit: rec.unit || rec.Unit,
            deviceId,
            deviceCode
          });
          // Update latest
          const existing = latestMap[code];
          if (!existing || recTime > new Date(existing.recordedAt).getTime()) {
            latestMap[code] = {
              value: Number(value),
              recordedAt,
              sensorType: rec.sensorType || rec.SensorType,
              minThreshold: rec.minThreshold ?? rec.MinThreshold,
              maxThreshold: rec.maxThreshold ?? rec.MaxThreshold,
              unit: rec.unit || rec.Unit,
              deviceId,
              deviceCode,
              sensorCode: code
            };
          }
        }
      }
      // Sort mỗi sensorCode theo thời gian tăng dần
      for (const k of Object.keys(merged)) {
        merged[k].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
      }
      if (import.meta.env.DEV) {
        const totalRecs = Object.values(merged).reduce((s, a) => s + a.length, 0);
        console.log(`[BatchIoTRealtime] batch=${batch?.id}: ${active.length} devices → ${Object.keys(merged).length} sensors, ${totalRecs} records (24h)`);
        console.log(`[BatchIoTRealtime] merged keys:`, Object.keys(merged));
        console.log(`[BatchIoTRealtime] merged[Object.keys(merged)[0]].length:`, merged[Object.keys(merged)[0]]?.length);
        if (Object.keys(merged).length > 0) {
          const firstKey = Object.keys(merged)[0];
          console.log(`[BatchIoTRealtime] sample ${firstKey} first 2:`, merged[firstKey].slice(0, 2));
        }
      }
      if (isMountedRef.current) {
        setHistoryBySensor(merged);
        setLatestBySensor(latestMap);
      }
    } catch (e) {
      console.warn('[BatchIoTRealtime] load history', e?.message || e);
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  }, [batch?.id]);

  // ── 3) Auto-poll mỗi 10s ─────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await loadAllHistory();
  }, [loadAllHistory]);

  // Load devices cho UI cards khi modal mở
  useEffect(() => {
    if (open) loadDevices();
  }, [open, loadDevices]);

  // Load history khi modal mở (1 lần, đợi 50ms cho devices ready)
  useEffect(() => {
    if (!open) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      // Reset state khi đóng modal
      setHistoryBySensor({});
      setLatestBySensor({});
      return;
    }
    const timer = setTimeout(() => {
      loadAllHistory();
    }, 50);
    pollRef.current = setInterval(() => { refresh(); }, 10000);
    return () => {
      clearTimeout(timer);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, batch?.id]);

  // ── Tổng hợp sensor codes ───────────────────────────────────────────
  const allSensorCodes = Array.from(new Set([
    ...Object.keys(latestBySensor),
    ...Object.keys(historyBySensor)
  ])).sort();

  const sensorMetaMap = allSensorCodes.map(code => {
    const latest = latestBySensor[code] || {};
    const meta = sensorMetaByCode(code, latest.sensorType);
    return { code, ...meta, latest };
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!open) return null;
  const onlineCount = devices.filter(d => classifyDevice(d) === 'healthy').length;
  const sensorCount = allSensorCodes.length;
  const totalRecords = Object.values(historyBySensor).reduce((sum, arr) => sum + arr.length, 0);
  const alertCount = sensorMetaMap.filter(s => isOutOfRange(s.latest?.value, s.latest?.minThreshold, s.latest?.maxThreshold)).length;
  // Danh sách cảm biến đang vượt ngưỡng — dùng cho panel "Thông Báo IoT" thu gọn
  const alertList = sensorMetaMap.filter(s => isOutOfRange(s.latest?.value, s.latest?.minThreshold, s.latest?.maxThreshold));
  // Mặc định chỉ hiện 1 cảnh báo; còn lại ẩn sau nút "Xem thêm"
  const visibleAlerts = showAllAlerts ? alertList : alertList.slice(0, 1);

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-stretch justify-end bg-black/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-6xl h-full overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xl">📡</span>
                <h2 className="text-lg font-bold text-slate-900">
                  Realtime — {batch?.batchCode || `Batch ${batch?.id?.slice(0, 6)}`}
                </h2>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center gap-1 ${
                  batch?.isIoTEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {batch?.isIoTEnabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                  {batch?.isIoTEnabled ? 'IoT ON' : 'IoT OFF'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  alertCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {alertCount > 0 ? `⚠️ ${alertCount} cảnh báo` : '✅ Bình thường'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {devices.length} thiết bị · {onlineCount} hoạt động · {sensorCount} cảm biến · {totalRecords} bản ghi 24h
                · Auto-refresh 10s
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {refreshing ? (
                  <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
                ) : (
                  <span>🔄</span>
                )}
                Refresh
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full"
                title="Đóng"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* PHẦN 0: Thông báo IoT (compact, mặc định chỉ hiện 1) */}
          {alertCount > 0 && (
            <section data-testid="iot-alerts-panel">
              <h3 className="text-sm font-bold text-rose-700 uppercase mb-2 flex items-center gap-2">
                <span>⚠️</span> Thông Báo IoT
                <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                  {alertCount}
                </span>
              </h3>
              <div className="space-y-1.5">
                {visibleAlerts.map(({ code, label, icon, unit, color, latest }) => {
                  const value = latest?.value;
                  const min = latest?.minThreshold;
                  const max = latest?.maxThreshold;
                  // Lý do vượt ngưỡng: dưới min hay trên max
                  const reason = (min !== null && min !== undefined && Number(value) < Number(min))
                    ? `Dưới ngưỡng (${min})`
                    : `Vượt ngưỡng (${max})`;
                  return (
                    <div
                      key={code}
                      className="flex items-center gap-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg"
                    >
                      <span className="text-lg shrink-0">{icon}</span>
                      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 truncate" title={label}>{label}</span>
                        <span className="font-mono text-[10px] text-slate-500">({code})</span>
                        <span className="text-base font-bold text-rose-600 whitespace-nowrap">
                          {value === null || value === undefined || isNaN(value) ? '—' : Number(value).toFixed(1)}
                          <span className="text-[10px] text-slate-500 ml-0.5">{unit || ''}</span>
                        </span>
                        <span className="text-[10px] font-bold text-rose-700 px-1.5 py-0.5 bg-rose-100 rounded">
                          {reason}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0 hidden sm:inline" title={fmtTime(latest?.recordedAt)}>
                        🕒 {fmtTimeShort(latest?.recordedAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {alertCount > 1 && (
                <div className="mt-2 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setShowAllAlerts(v => !v)}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 px-3 py-1 rounded-lg hover:bg-rose-50 border border-rose-200"
                  >
                    {showAllAlerts
                      ? `↑ Thu gọn`
                      : `↓ Xem thêm (còn ${alertCount - 1} cảnh báo)`}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* PHẦN 1: Danh sách thiết bị của batch */}
          <section>
            <h3 className="text-sm font-bold text-slate-700 uppercase mb-2 flex items-center gap-2">
              <span>📱</span> Thiết bị trong lô ({devices.length})
            </h3>
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
              </div>
            ) : devices.length === 0 ? (
              <div className="py-6 px-4 text-center text-sm text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                Chưa có thiết bị nào được gán cho lô này.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {devices.map(d => {
                  const status = classifyDevice(d);
                  const sensorList = Array.isArray(d.sensors) ? d.sensors : [];
                  return (
                    <div key={d.id} className={`bg-white border rounded-lg p-3 ${
                      status === 'healthy' ? 'border-emerald-200' : 'border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-mono text-xs font-bold text-primary truncate">{d.deviceCode}</span>
                          <span className="font-bold text-sm text-slate-900 truncate">{d.deviceName}</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${DEVICE_STATUS[status].cls}`}>
                          {DEVICE_STATUS[status].label}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-2 gap-y-0.5">
                        {d.isOnline === false && <span className="text-rose-600 font-bold">Offline</span>}
                        {d.macAddress && <span>MAC: {d.macAddress}</span>}
                        <span>{d.deviceType || 'ESP32-C3'}</span>
                        {sensorList.length > 0 && <span>{sensorList.length} cảm biến</span>}
                        {d.lastActiveAt && <span>Cuối: {fmtTimeShort(d.lastActiveAt)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* PHẦN 2: Cards giá trị mới nhất - REUSE pattern dashboard */}
          <section>
            <h3 className="text-sm font-bold text-slate-700 uppercase mb-2 flex items-center gap-2">
              <span>📊</span> Chỉ số môi trường mới nhất ({sensorMetaMap.length})
            </h3>
            {sensorMetaMap.length === 0 ? (
              <div className="py-8 px-4 text-center text-sm text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                Chưa có dữ liệu cảm biến. Đợi thiết bị gửi về...
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {sensorMetaMap.map(({ code, label, icon, unit, color, latest }) => {
                  const value = latest?.value;
                  const outOfRange = isOutOfRange(value, latest?.minThreshold, latest?.maxThreshold);
                  return (
                    <div
                      key={code}
                      className="bg-white border border-slate-200 rounded-xl p-3 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-lg">{icon}</span>
                        <span className="text-[10px] font-bold uppercase text-slate-500 truncate flex-1" title={label}>{label}</span>
                        {outOfRange && <span className="text-rose-500 text-[10px]" title="Vượt ngưỡng - xem Thông Báo IoT">⚠️</span>}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold" style={{ color: outOfRange ? '#dc2626' : color }}>
                          {value === null || value === undefined || isNaN(value) ? '—' : Number(value).toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold">{unit || ''}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 mt-1 truncate" title={code}>
                        🕒 {fmtTimeShort(latest?.recordedAt)}
                      </div>
                      {(latest?.minThreshold !== null && latest?.minThreshold !== undefined) ||
                       (latest?.maxThreshold !== null && latest?.maxThreshold !== undefined) ? (
                        <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                          Ngưỡng: {latest?.minThreshold ?? '—'} → {latest?.maxThreshold ?? '—'} {unit}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* PHẦN 3: Biểu đồ 24h - giống dashboard */}
          <section>
            <h3 className="text-sm font-bold text-slate-700 uppercase mb-2 flex items-center gap-2">
              <span>📈</span> Biểu đồ 24h ({sensorMetaMap.length} sensors · hover để xem giá trị)
            </h3>
            {sensorMetaMap.length === 0 ? (
              <div className="py-8 px-4 text-center text-sm text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                Chưa có dữ liệu lịch sử.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {sensorMetaMap.map(({ code, label, icon, unit, color, latest }) => {
                  const points = historyBySensor[code] || [];
                  // Fallback: nếu không có history, dùng 1 điểm từ latest
                  let chartData;
                  if (points.length > 0) {
                    chartData = points.map(p => ({
                      x: new Date(p.recordedAt).getTime(),
                      value: Number(p.value)
                    }));
                  } else if (latest && latest.value !== null && latest.value !== undefined) {
                    // 1 điểm duy nhất từ latest
                    chartData = [{
                      x: latest.recordedAt ? new Date(latest.recordedAt).getTime() : Date.now(),
                      value: Number(latest.value)
                    }];
                  } else {
                    chartData = [];
                  }
                  const hasData = chartData.length > 0;
                  const first = points[0];
                  const last = points[points.length - 1];
                  if (import.meta.env.DEV && code === Object.keys(historyBySensor)[0]) {
                    console.log(`[BatchIoTRealtime] RENDER chart for ${code}: history=${points.length} points, chartData=${chartData.length} items, hasData=${hasData}`);
                  }
                  return (
                    <div key={code} className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-slate-900 truncate" title={label}>
                            {label}
                            <span className="ml-1 font-mono text-[10px] text-slate-500 font-normal">({code})</span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {points.length > 0
                              ? `${points.length} bản ghi · ${fmtTime(first?.recordedAt)} → ${fmtTime(last?.recordedAt)}`
                              : (hasData
                                ? `Chỉ có 1 điểm gần nhất · ${fmtTimeShort(latest?.recordedAt)}`
                                : 'Chưa có dữ liệu trong 24h qua')}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xl font-bold" style={{ color }}>
                            {latest?.value !== null && latest?.value !== undefined
                              ? Number(latest.value).toFixed(1)
                              : '—'}
                            <span className="text-xs text-slate-500 ml-0.5">{unit}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ height: 200 }}>
                        {hasData ? (
                          <MiniChart
                            data={chartData}
                            color={color}
                            unit={unit}
                            label={label}
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center bg-slate-50 rounded-lg text-xs text-slate-400">
                            📭 Chưa có dữ liệu 24h
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* PHẦN 4: Heatmap */}
          {sensorMetaMap.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-slate-700 uppercase mb-2 flex items-center gap-2">
                <span>🟦</span> Heatmap trạng thái cảm biến
              </h3>
              <StatusHeatmap
                sensors={sensorMetaMap.map(({ code, label, icon, unit, color }) => {
                  const points = historyBySensor[code] || [];
                  return {
                    code,
                    label,
                    icon,
                    unit,
                    color,
                    type: latestBySensor[code]?.sensorType,
                    values: points.map(p => ({
                      time: p.recordedAt,
                      value: Number(p.value)
                    }))
                  };
                })}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchIoTRealtimeModal;
