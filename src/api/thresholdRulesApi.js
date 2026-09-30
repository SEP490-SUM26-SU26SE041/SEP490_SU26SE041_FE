// ── Sensor Threshold Rules API ─────────────────────────────────────────────────
// Theo spec BE Sensor Threshold (2026-09-30).
// Researcher: full CRUD. Technician/Manager: chỉ GET.
//
// Quan trọng:
//   - POST /api/threshold-rules            → batchId BẮT BUỘC (gắn vào 1 batch cụ thể)
//   - POST /api/threshold-rules/experiment-wide → experimentId BẮT BUỘC (áp dụng toàn exp)
//   - BE tự lookup experimentId từ batchId ở endpoint thường.

import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

// ── Enums (mirror với BE) ──────────────────────────────────────────────────────

// SensorType — khớp với iotDevicesApi.SensorType (1..6)
export const ThresholdSensorType = {
  Any: null,
  Temperature: 1,
  Humidity: 2,
  SoilMoisture: 3,
  Light: 4,
  PH: 5,
  Other: 6
};

export const SENSOR_TYPE_OPTIONS = [
  { value: null,                  label: 'Tất cả loại cảm biến' },
  { value: 1,                     label: '🌡️ Nhiệt độ (Temperature)' },
  { value: 2,                     label: '💧 Độ ẩm (Humidity)' },
  { value: 3,                     label: '🌱 Độ ẩm đất (SoilMoisture)' },
  { value: 4,                     label: '☀️ Ánh sáng (Light)' },
  { value: 5,                     label: '🧪 pH' },
  { value: 6,                     label: '📌 Khác (Other)' }
];

// AlertSeverity — Low | Medium | High | Critical
export const AlertSeverity = {
  Low: 'Low',
  Medium: 'Medium',
  High: 'High',
  Critical: 'Critical'
};

export const SEVERITY_OPTIONS = [
  { value: 'Low',      label: '🟢 Thấp (Low)',      cls: 'bg-slate-100 text-slate-700' },
  { value: 'Medium',   label: '🟡 Trung bình (Medium)', cls: 'bg-amber-100 text-amber-700' },
  { value: 'High',     label: '🟠 Cao (High)',     cls: 'bg-orange-100 text-orange-700' },
  { value: 'Critical', label: '🔴 Nghiêm trọng (Critical)', cls: 'bg-rose-100 text-rose-700' }
];

export const getSeverityMeta = (sev) =>
  SEVERITY_OPTIONS.find(s => s.value === sev) || SEVERITY_OPTIONS[1];

export const getSensorLabel = (sensorType) => {
  const opt = SENSOR_TYPE_OPTIONS.find(o => o.value === sensorType);
  return opt ? opt.label : 'Tất cả loại';
};

// ── REST endpoints ────────────────────────────────────────────────────────────

export const thresholdRulesApi = {
  // GET /api/threshold-rules?experimentId=&batchId=&sensorType=&isActive=
  // Trả về mảng rule (count + data).
  getAll: (params = {}) =>
    apiClient.request('/threshold-rules', { params }).then(res => {
      // BE có thể trả { success, count, data } → unwrap 2 lớp
      if (res && Array.isArray(res.data)) return res.data;
      return Array.isArray(res) ? res : [];
    }),

  // GET /api/threshold-rules/{id}
  getById: (id) =>
    apiClient.request(`/threshold-rules/${id}`).then(res => res?.data || res),

  // GET /api/threshold-rules/applicable?sensorType=&batchId=&experimentId=
  // Trả về rule đầu tiên áp dụng, hoặc null nếu không có.
  getApplicable: (params) =>
    apiClient.request('/threshold-rules/applicable', { params }).then(res => res?.data || res),

  // POST /api/threshold-rules — body: { batchId, sensorType, minValue, maxValue, severity, message, isActive }
  // ⚠️ BREAKING CHANGE: batchId bắt buộc, KHÔNG có experimentId.
  createForBatch: (payload) =>
    apiClient.request('/threshold-rules', { method: 'POST', body: payload }).then(res => res?.data || res),

  // POST /api/threshold-rules/experiment-wide — body: { experimentId, sensorType, minValue, maxValue, severity, message, isActive }
  createForExperiment: (payload) =>
    apiClient.request('/threshold-rules/experiment-wide', { method: 'POST', body: payload }).then(res => res?.data || res),

  // PUT /api/threshold-rules/{id} — body partial update
  update: (id, payload) =>
    apiClient.request(`/threshold-rules/${id}`, { method: 'PUT', body: payload }).then(res => res?.data || res),

  // PATCH /api/threshold-rules/{id}/toggle — body: true|false
  toggle: (id, isActive) =>
    apiClient.request(`/threshold-rules/${id}/toggle`, { method: 'PATCH', body: isActive }).then(res => res?.data || res),

  // DELETE /api/threshold-rules/{id}
  remove: (id) =>
    apiClient.request(`/threshold-rules/${id}`, { method: 'DELETE' })
};

export default thresholdRulesApi;
