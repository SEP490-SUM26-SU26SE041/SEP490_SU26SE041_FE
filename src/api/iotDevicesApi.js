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
    // Nếu có nhiều bản ghi cùng sensorType → giữ bản ghi mới nhất
    const existing = map[r.sensorType];
    if (!existing || new Date(r.recordedAt) > new Date(existing.recordedAt)) {
      map[r.sensorType] = r;
    }
  }
  return map;
}

// Group history readings by sensorType → dạng { [sensorType]: [{recordedAt, value}, ...] }
export function groupHistoryByType(sensorData = []) {
  const map = {};
  for (const r of sensorData || []) {
    if (!map[r.sensorType]) map[r.sensorType] = [];
    map[r.sensorType].push({
      recordedAt: r.recordedAt,
      value: Number(r.value || 0)
    });
  }
  // Sort theo thời gian tăng dần
  for (const k of Object.keys(map)) {
    map[k].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
  }
  return map;
}

// Convert to chart data dạng [{ label, value }] theo format LineChart đang dùng
export function toChartPoints(records = [], points = 24) {
  const now = Date.now();
  if (!records.length) return Array.from({ length: points }, (_, i) => ({
    label: `${(points - 1 - i)}h`,
    value: 0
  }));
  // Bucket theo giờ (24 buckets gần nhất)
  const buckets = new Array(points).fill(null).map((_, i) => {
    const t = new Date(now - (points - 1 - i) * 60 * 60 * 1000);
    return { t, sums: [], count: 0 };
  });
  for (const r of records) {
    const ts = new Date(r.recordedAt).getTime();
    if (Number.isNaN(ts)) continue;
    // Tìm bucket gần nhất
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
