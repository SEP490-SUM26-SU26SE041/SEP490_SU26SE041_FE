import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

// ── IoT Devices (ESP32-C3 + Sensors) ──────────────────────────────────────────────
// Theo tài liệu BE IoT Flow API v1.0 (2026-09-25).
// Tất cả endpoints yêu cầu Researcher role + Bearer token.

export const iotDevicesApi = {
  // 1. Lấy danh sách tất cả thiết bị
  getAll: () =>
    apiClient.request('/iot-devices').then(u),

  // 2. Lấy danh sách thiết bị đang offline (cảnh báo)
  getOffline: () =>
    apiClient.request('/iot-devices/offline').then(u),

  // 3. Chi tiết 1 thiết bị
  getById: (id) =>
    apiClient.request(`/iot-devices/${id}`).then(u),

  // 4. Tìm theo DeviceCode
  getByCode: (deviceCode) =>
    apiClient.request(`/iot-devices/code/${encodeURIComponent(deviceCode)}`).then(u),

  // 5. Lấy danh sách thiết bị theo Batch
  getByBatch: (batchId) =>
    apiClient.request(`/iot-devices/batch/${batchId}`).then(u),

  // 6. Tạo thiết bị mới (+ sensors)
  // payload: { deviceCode, deviceName, macAddress, deviceType, batchId, isActive, sensors: [{sensorCode, sensorType, mqttFieldName, ...}] }
  create: (payload) =>
    apiClient.request('/iot-devices', { method: 'POST', body: payload }).then(u),

  // 7. Cập nhật thiết bị
  update: (id, payload) =>
    apiClient.request(`/iot-devices/${id}`, { method: 'PUT', body: payload }).then(u),

  // 8. Xóa thiết bị
  remove: (id) =>
    apiClient.request(`/iot-devices/${id}`, { method: 'DELETE' }).then(u),

  // 9. Gán / gỡ thiết bị khỏi batch
  // payload: { deviceId, batchId } — batchId=null để gỡ
  assignBatch: (payload) =>
    apiClient.request('/iot-devices/assign-batch', { method: 'POST', body: payload }).then(u),

  // 10. Bật / tắt IoT cho batch
  // payload: { batchId, isIoTEnabled: true|false }
  toggleBatchIoT: (payload) =>
    apiClient.request('/iot-devices/batch/toggle-iot', { method: 'POST', body: payload }).then(u),

  // 11. Lịch sử dữ liệu cảm biến (filter)
  // params: { fromDate, toDate, limit }
  getSensorData: (id, params = {}) =>
    apiClient.request(`/iot-devices/${id}/sensor-data`, { params }).then(u),

  // 12. Giá trị cảm biến mới nhất (cho dashboard gauge)
  getSensorDataLatest: (id) =>
    apiClient.request(`/iot-devices/${id}/sensor-data/latest`).then(u),
};

// ── Helpers / mappers ────────────────────────────────────────────────────────────

// SensorType enum (từ BE)
export const SensorType = {
  Temperature: 1,
  Humidity: 2,
  SoilMoisture: 3,
  Light: 4,
  PH: 5,
  Other: 6
};

// IoTDeviceStatus enum
export const IoTDeviceStatus = {
  Inactive: 0,
  Active: 1
};

export const SENSOR_META = {
  [SensorType.Temperature]: {
    label: 'Nhiệt độ',
    icon: '🌡️',
    unit: '°C',
    color: '#ef4444',
    fillColor: 'rgba(239,68,68,0.10)'
  },
  [SensorType.Humidity]: {
    label: 'Độ ẩm KK',
    icon: '💧',
    unit: '%',
    color: '#3b82f6',
    fillColor: 'rgba(59,130,246,0.10)'
  },
  [SensorType.SoilMoisture]: {
    label: 'Độ ẩm đất',
    icon: '🌱',
    unit: '%',
    color: '#486730',
    fillColor: 'rgba(72,103,48,0.10)'
  },
  [SensorType.Light]: {
    label: 'Ánh sáng',
    icon: '☀️',
    unit: 'lux',
    color: '#f59e0b',
    fillColor: 'rgba(245,158,11,0.10)'
  },
  [SensorType.PH]: {
    label: 'pH',
    icon: '🧪',
    unit: '',
    color: '#8b5cf6',
    fillColor: 'rgba(139,92,246,0.10)'
  },
  [SensorType.Other]: {
    label: 'Khác',
    icon: '📡',
    unit: '',
    color: '#64748b',
    fillColor: 'rgba(100,116,139,0.10)'
  }
};

// Phân loại trạng thái thiết bị (kết hợp status + isOnline + isActive)
export function classifyDevice(dev) {
  if (!dev) return 'inactive';
  if (dev.status === 1 && dev.isActive && dev.isOnline) return 'healthy';
  if (dev.status === 1 && dev.isActive && !dev.isOnline) return 'warning';
  if (!dev.isActive) return 'inactive';
  return 'critical';
}

// Group latest readings by sensorType → dạng { [sensorType]: { value, recordedAt, sensorCode } }
export function groupLatestByType(sensorData = []) {
  const map = {};
  for (const r of sensorData || []) {
    // Chuẩn hóa key: nếu sensorType là string ("Temperature") → convert sang number (1) để match SENSOR_META
    const key = normalizeSensorKey(r.sensorType);
    if (key === null) continue;
    // Nếu có nhiều bản ghi cùng key → giữ bản ghi mới nhất
    const existing = map[key];
    if (!existing || new Date(r.recordedAt) > new Date(existing.recordedAt)) {
      map[key] = { ...r, sensorType: key };
    }
  }
  return map;
}

// ── NEW: Chuẩn hóa sensorType key ───────────────────────────────────────────────
// BE có 2 cách trả sensorType:
//   1. Số enum: 1, 2, 3, 4, 5, 6 (Temperature, Humidity, SoilMoisture, Light, PH, Other)
//   2. Tên string: "Temperature", "Humidity", "SoilMoisture", "Light", "PH", "Other"
// Hàm này trả về key chuẩn (number) để dùng chung với SENSOR_META.
export function normalizeSensorKey(raw) {
  if (raw === null || raw === undefined) return null;
  // Nếu là số (1-6) → trả về luôn
  if (typeof raw === 'number') {
    return (raw >= 1 && raw <= 6) ? raw : null;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    // Thử parse số
    const n = Number(s);
    if (!isNaN(n) && n >= 1 && n <= 6) return n;
    // Map theo tên
    const map = {
      'Temperature': 1,
      'Humidity': 2,
      'SoilMoisture': 3,
      'Light': 4,
      'PH': 5,
      'Ph': 5,
      'Other': 6
    };
    return map[s] ?? null;
  }
  return null;
}

// ── NEW: Phân loại chi tiết theo sensorCode ─────────────────────────────────────
// Vì BE có 2 sensor cùng sensorType=Temperature (TEMP-AIR, TEMP-WATER) → cần tách
// Trả về object { type, label, unit, color, fillCode, icon, warn, warnMsg }
export function classifySensorByCode(sensorCode, sensorTypeName) {
  // Map sensorCode → category riêng
  const code = (sensorCode || '').toUpperCase();
  const typeName = (sensorTypeName || '').toLowerCase();

  // Từ code
  if (code.includes('PH-WATER') || code === 'PH' || typeName === 'ph') {
    return {
      ...SENSOR_META[SensorType.PH],
      id: 'PH',
      label: 'pH nước',
      warn: null,  // check sau khi có value
      warnMsg: 'Lý tưởng 6.5 – 8.5',
    };
  }
  if (code.includes('TEMP-WATER') || code.includes('DS18B20') || code.includes('WATER-TEMP')) {
    return {
      ...SENSOR_META[SensorType.Temperature],
      id: 'TEMP_WATER',
      label: 'Nhiệt độ nước',
    };
  }
  if (code.includes('TEMP-AIR') || code.includes('DHT-T') || code.includes('AIR-TEMP') || code.includes('AM2320')) {
    return {
      ...SENSOR_META[SensorType.Temperature],
      id: 'TEMP_AIR',
      label: 'Nhiệt độ KK',
    };
  }
  if (code.includes('HUM-AIR') || code.includes('DHT-H') || code.includes('AIR-HUM') || code.includes('AM2320-H')) {
    return {
      ...SENSOR_META[SensorType.Humidity],
      id: 'HUM_AIR',
      label: 'Độ ẩm KK',
    };
  }
  if (code.includes('SOIL') || code.includes('MOISTURE') || typeName === 'soilmoisture') {
    return {
      ...SENSOR_META[SensorType.SoilMoisture],
      id: 'SOIL',
      label: 'Độ ẩm đất',
    };
  }
  if (code.includes('LIGHT') || code.includes('LDR') || typeName === 'light') {
    return {
      ...SENSOR_META[SensorType.Light],
      id: 'LIGHT',
      label: 'Ánh sáng',
    };
  }

  // Fallback theo sensorType
  const key = normalizeSensorKey(sensorTypeName);
  if (key && SENSOR_META[key]) {
    return { ...SENSOR_META[key], id: `TYPE_${key}` };
  }
  return { ...SENSOR_META[SensorType.Other], id: 'OTHER', label: 'Khác' };
}

// Group history readings by sensorType → dạng { [sensorType]: [{recordedAt, value}, ...] }
export function groupHistoryByType(sensorData = []) {
  const map = {};
  for (const r of sensorData || []) {
    const key = normalizeSensorKey(r.sensorType);
    if (key === null) continue;
    if (!map[key]) map[key] = [];
    map[key].push({
      recordedAt: r.recordedAt,
      value: Number(r.value || 0),
      sensorCode: r.sensorCode  // giữ code để phân loại chi tiết sau
    });
  }
  // Sort theo thời gian tăng dần
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  }
  return map;
}

// Convert to chart data dạng [{ label, value }] theo format LineChart đang dùng
// Logic:
//  - Nếu số records ≤ 100 → hiển thị trực tiếp (giữ nguyên độ chi tiết, không bucket)
//  - Nếu > 100 records VÀ span > 6h → bucket trung bình theo giờ
//  - Nếu > 100 records VÀ span ≤ 6h → hiển thị trực tiếp (chart sẽ rõ hơn bucket)
export function toChartPoints(records = [], points = 24) {
  if (!records.length) return Array.from({ length: points }, (_, i) => ({
    label: `${(points - 1 - i)}h`,
    value: 0
  }));

  // Sắp xếp theo thời gian tăng dần
  const sorted = [...records].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));

  // Tính span thời gian (giờ)
  const first = new Date(sorted[0].recordedAt).getTime();
  const last = new Date(sorted[sorted.length - 1].recordedAt).getTime();
  const spanHours = (last - first) / (1000 * 60 * 60);

  // Nếu số records ≤ 100 HOẶC span < 6h → hiển thị trực tiếp không bucket
  if (sorted.length <= 100 || spanHours < 6) {
    return sorted.map(r => {
      const d = new Date(r.recordedAt);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      // Mặc định HH:MM (gọn, không đè). Chỉ hiển thị giây khi:
      // - records quá thưa (>120s/point, vd 5 phút/point) HOẶC
      // - tổng số records ≤ 5
      const spanMs = sorted.length > 1
        ? new Date(sorted[sorted.length - 1].recordedAt).getTime() - new Date(sorted[0].recordedAt).getTime()
        : 0;
      const avgGapSec = sorted.length > 1 ? spanMs / 1000 / (sorted.length - 1) : 0;
      const showSeconds = sorted.length <= 5 || avgGapSec > 120;
      const label = showSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
      return { label, value: Number(r.value || 0) };
    });
  }

  // Nếu có nhiều records VÀ span >= 6h → bucket theo giờ (24 buckets gần nhất)
  const now = Date.now();
  const buckets = new Array(points).fill(null).map((_, i) => {
    const t = new Date(now - (points - 1 - i) * 60 * 60 * 1000);
    return { t, sums: [], count: 0 };
  });
  for (const r of sorted) {
    const ts = new Date(r.recordedAt).getTime();
    if (Number.isNaN(ts)) continue;
    let bestIdx = -1;
    let bestDiff = Infinity;
    for (let i = 0; i < buckets.length; i++) {
      const diff = Math.abs(buckets[i].t.getTime() - ts);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    }
    if (bestIdx >= 0 && bestDiff < 90 * 60 * 1000) {
      buckets[bestIdx].sums.push(Number(r.value || 0));
      buckets[bestIdx].count++;
    }
  }
  return buckets.map((b, i) => ({
    label: `${b.t.getHours()}h`,
    value: b.count > 0 ? +(b.sums.reduce((s, v) => s + v, 0) / b.count).toFixed(1) : 0
  }));
}
