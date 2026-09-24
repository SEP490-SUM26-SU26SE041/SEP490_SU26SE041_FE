import React, { useEffect, useState, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import { batchesApi } from '../../api/experimentApi';
import {
  iotDevicesApi,
  SENSOR_META,
  SensorType,
  IoTDeviceStatus,
  classifyDevice
} from '../../api/iotDevicesApi';

// ── Constants ──────────────────────────────────────────────────────────────────
const SENSOR_TYPE_OPTIONS = [
  { value: SensorType.Temperature, label: SENSOR_META[SensorType.Temperature].label },
  { value: SensorType.Humidity, label: SENSOR_META[SensorType.Humidity].label },
  { value: SensorType.SoilMoisture, label: SENSOR_META[SensorType.SoilMoisture].label },
  { value: SensorType.Light, label: SENSOR_META[SensorType.Light].label },
  { value: SensorType.PH, label: SENSOR_META[SensorType.PH].label },
  { value: SensorType.Other, label: SENSOR_META[SensorType.Other].label }
];

const STATUS_BADGE = {
  healthy: { label: 'Hoạt động', cls: 'bg-emerald-100 text-emerald-700' },
  warning: { label: 'Mất kết nối', cls: 'bg-amber-100 text-amber-700' },
  critical: { label: 'Lỗi', cls: 'bg-rose-100 text-rose-700' },
  inactive: { label: 'Ngưng', cls: 'bg-slate-100 text-slate-600' }
};

// ── Main Component ─────────────────────────────────────────────────────────────
// Props:
//   - batch: object batch (bắt buộc, có id + batchCode)
//   - onDevicesChange: (batchId, devices[]) => void (optional, callback khi load devices xong)
const BatchIoTPanel = ({ batch, onDevicesChange }) => {
  const { showToast } = useToast();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [togglingIoT, setTogglingIoT] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // device đang sửa

  // Trạng thái IoT của batch — lấy từ BE (batchesApi.getById trả về isIoTEnabled)
  // Mặc định null = chưa load xong, false = tắt, true = bật
  const [isIoTEnabled, setIsIoTEnabled] = useState(null);

  // ── Fetch trạng thái IoT của batch từ BE ──────────────────────────────────
  const loadIoTStatus = useCallback(async () => {
    if (!batch?.id) return;
    try {
      const data = await batchesApi.getById(batch.id);
      // BE có thể trả thẳng hoặc wrap trong data
      const batchData = data?.data || data;
      setIsIoTEnabled(Boolean(batchData?.isIoTEnabled ?? batchData?.IsIoTEnabled ?? false));
    } catch (e) {
      console.warn('[loadIoTStatus]', e?.message || e);
      // Nếu BE chưa trả field này → mặc định OFF để an toàn
      setIsIoTEnabled(false);
    }
  }, [batch?.id]);

  // ── Load devices của batch này ─────────────────────────────────────────────
  const loadDevices = useCallback(async () => {
    if (!batch?.id) return;
    try {
      setLoading(true);
      const list = await iotDevicesApi.getByBatch(batch.id);
      const arr = Array.isArray(list) ? list : (list?.data || list?.items || []);
      setDevices(arr);
      if (onDevicesChange) onDevicesChange(batch.id, arr);
    } catch (e) {
      console.warn('[loadDevices]', e?.message || e);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [batch?.id, onDevicesChange]);

  useEffect(() => {
    loadIoTStatus();
    loadDevices();
  }, [loadIoTStatus, loadDevices]);

  // ── Bật/tắt IoT cho batch ─────────────────────────────────────────────────
  const handleToggleIoT = async () => {
    if (!batch?.id) return;
    const next = !isIoTEnabled;
    try {
      setTogglingIoT(true);
      await iotDevicesApi.toggleBatchIoT({
        batchId: batch.id,
        isIoTEnabled: next
      });
      setIsIoTEnabled(next);
      showToast(next ? 'Đã bật IoT cho batch' : 'Đã tắt IoT cho batch', 'success');
    } catch (e) {
      showToast(e?.message || 'Không thể thay đổi trạng thái IoT', 'error');
    } finally {
      setTogglingIoT(false);
    }
  };

  // ── Xóa thiết bị ──────────────────────────────────────────────────────────
  const handleDelete = async (device) => {
    if (!window.confirm(`Xóa thiết bị "${device.deviceCode}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await iotDevicesApi.remove(device.id);
      showToast('Đã xóa thiết bị', 'success');
      loadDevices();
    } catch (e) {
      showToast(e?.message || 'Không thể xóa thiết bị', 'error');
    }
  };

  // ── Bật/tắt 1 thiết bị (toggle isActive) ─────────────────────────────────
  const handleToggleDeviceActive = async (device) => {
    try {
      await iotDevicesApi.update(device.id, { isActive: !device.isActive });
      showToast(device.isActive ? 'Đã tắt thiết bị' : 'Đã bật thiết bị', 'success');
      loadDevices();
    } catch (e) {
      showToast(e?.message || 'Không thể cập nhật', 'error');
    }
  };

  return (
    <div className="border border-outline-variant rounded-xl p-4 bg-surface-container-lowest/50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📡</span>
          <h4 className="font-bold text-sm text-on-surface">
            IoT — {batch?.batchCode || `Batch ${batch?.id?.slice(0, 6)}`}
          </h4>
          {loading && <span className="text-[10px] text-on-surface-variant animate-pulse">đang tải...</span>}
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle IoT batch */}
          <button
            type="button"
            onClick={handleToggleIoT}
            disabled={togglingIoT || isIoTEnabled === null}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isIoTEnabled ? 'bg-emerald-500' : 'bg-slate-300'
            } ${togglingIoT ? 'opacity-50' : ''}`}
            title={isIoTEnabled ? 'Tắt IoT cho batch này' : 'Bật IoT cho batch này'}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isIoTEnabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
          <span className={`text-[10px] font-bold uppercase ${isIoTEnabled === null ? 'text-slate-400' : isIoTEnabled ? 'text-emerald-600' : 'text-slate-500'}`}>
            {isIoTEnabled === null ? '...' : (isIoTEnabled ? 'IoT ON' : 'IoT OFF')}
          </span>
          {isIoTEnabled && (
            <button
              type="button"
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="px-3 py-1 bg-primary text-white rounded-lg text-[11px] font-bold hover:bg-[#3d5728] transition-all flex items-center gap-1"
            >
              <span>+</span> Thêm thiết bị
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {isIoTEnabled === null ? (
        <div className="py-3 px-3 text-center text-xs text-on-surface-variant bg-white rounded-lg border border-dashed border-outline-variant">
          Đang tải trạng thái IoT...
        </div>
      ) : !isIoTEnabled ? (
        <div className="py-4 px-3 text-center text-xs text-on-surface-variant bg-white rounded-lg border border-dashed border-outline-variant">
          ⚠️ Batch chưa bật IoT. Bật IoT trước khi gán thiết bị.
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-12 bg-surface-container-low rounded-lg animate-pulse" />)}
        </div>
      ) : devices.length === 0 ? (
        <div className="py-4 px-3 text-center text-xs text-on-surface-variant bg-white rounded-lg border border-dashed border-outline-variant">
          Chưa có thiết bị IoT. Nhấn <strong>+ Thêm thiết bị</strong> để bắt đầu.
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map(d => {
            const sensorList = Array.isArray(d.sensors) ? d.sensors : [];
            const status = classifyDevice(d);
            return (
              <div key={d.id} className="bg-white border border-outline-variant rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] font-bold text-primary">{d.deviceCode}</span>
                    <span className="font-bold text-sm text-on-surface truncate">{d.deviceName}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${STATUS_BADGE[status].cls}`}>
                      {STATUS_BADGE[status].label}
                    </span>
                    {d.isOnline === false && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-600">
                        Offline
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-on-surface-variant mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {d.macAddress && <span>MAC: {d.macAddress}</span>}
                    <span>{d.deviceType || 'ESP32-C3-Water-Sensor'}</span>
                    {sensorList.length > 0 && (
                      <span>{sensorList.length} cảm biến: {sensorList.map(s => SENSOR_META[s.sensorType]?.label || `Type ${s.sensorType}`).join(', ')}</span>
                    )}
                    {d.lastActiveAt && (
                      <span>Lần cuối: {new Date(d.lastActiveAt).toLocaleString('vi-VN')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleDeviceActive(d)}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${
                      d.isActive ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    }`}
                  >
                    {d.isActive ? 'Tắt' : 'Bật'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditing(d); setShowForm(true); }}
                    className="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(d)}
                    className="px-2 py-1 rounded text-[10px] font-bold bg-rose-100 text-rose-700 hover:bg-rose-200"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <DeviceFormModal
          batch={batch}
          device={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); loadDevices(); }}
        />
      )}
    </div>
  );
};

// ── Form Modal ────────────────────────────────────────────────────────────────
const DeviceFormModal = ({ batch, device, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => {
    if (device) {
      return {
        deviceCode: device.deviceCode || '',
        deviceName: device.deviceName || '',
        macAddress: device.macAddress || '',
        deviceType: device.deviceType || 'ESP32-C3-Water-Sensor',
        batchId: batch?.id,
        isActive: device.isActive !== false,
        sensors: (Array.isArray(device.sensors) && device.sensors.length > 0)
          ? device.sensors.map(s => ({ sensorCode: s.sensorCode, sensorType: s.sensorType, mqttFieldName: s.mqttFieldName }))
          : [{ sensorCode: '', sensorType: SensorType.Temperature, mqttFieldName: '' }]
      };
    }
    return {
      deviceCode: '',
      deviceName: '',
      macAddress: '',
      deviceType: 'ESP32-C3-Water-Sensor',
      batchId: batch?.id,
      isActive: true,
      sensors: [{ sensorCode: '', sensorType: SensorType.Temperature, mqttFieldName: '' }]
    };
  });
  const [submitting, setSubmitting] = useState(false);

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const updateSensor = (idx, k, v) => setForm(prev => ({
    ...prev,
    sensors: prev.sensors.map((s, i) => i === idx ? { ...s, [k]: v } : s)
  }));
  const addSensor = () => setForm(prev => ({
    ...prev,
    sensors: [...prev.sensors, { sensorCode: '', sensorType: SensorType.Temperature, mqttFieldName: '' }]
  }));
  const removeSensor = (idx) => setForm(prev => ({
    ...prev,
    sensors: prev.sensors.filter((_, i) => i !== idx)
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validation
    if (!form.deviceCode.trim()) { showToast('Vui lòng nhập DeviceCode', 'error'); return; }
    if (!form.deviceName.trim()) { showToast('Vui lòng nhập tên thiết bị', 'error'); return; }
    const validSensors = form.sensors.filter(s => s.sensorCode.trim() && s.mqttFieldName.trim());
    for (const s of validSensors) {
      if (!SENSOR_TYPE_OPTIONS.some(o => o.value === Number(s.sensorType))) {
        showToast('SensorType không hợp lệ', 'error'); return;
      }
    }
    try {
      setSubmitting(true);
      const payload = {
        deviceCode: form.deviceCode.trim(),
        deviceName: form.deviceName.trim(),
        macAddress: form.macAddress.trim() || undefined,
        deviceType: form.deviceType,
        batchId: batch?.id, // luôn gán vào batch hiện tại
        isActive: form.isActive,
        sensors: validSensors.map(s => ({
          sensorCode: s.sensorCode.trim(),
          sensorType: Number(s.sensorType),
          mqttFieldName: s.mqttFieldName.trim()
        }))
      };
      if (device?.id) {
        await iotDevicesApi.update(device.id, payload);
        showToast('Đã cập nhật thiết bị', 'success');
      } else {
        await iotDevicesApi.create(payload);
        showToast('Đã tạo thiết bị', 'success');
      }
      onSaved();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi không xác định';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-5 border-b border-outline-variant flex items-center justify-between">
            <h3 className="font-hanken text-lg font-bold text-on-surface">
              {device ? `Sửa thiết bị ${device.deviceCode}` : 'Thêm thiết bị IoT mới'}
            </h3>
            <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Device fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">DeviceCode *</label>
                <input
                  value={form.deviceCode}
                  onChange={e => setField('deviceCode', e.target.value)}
                  placeholder="ESP-001"
                  disabled={!!device}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100"
                />
                {device && <p className="text-[9px] text-on-surface-variant mt-1">DeviceCode không thể thay đổi</p>}
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Tên thiết bị *</label>
                <input
                  value={form.deviceName}
                  onChange={e => setField('deviceName', e.target.value)}
                  placeholder="Cảm biến ngoài trời 1"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">MAC Address</label>
                <input
                  value={form.macAddress}
                  onChange={e => setField('macAddress', e.target.value)}
                  placeholder="AA:BB:CC:DD:EE:FF"
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">DeviceType</label>
                <input
                  value={form.deviceType}
                  onChange={e => setField('deviceType', e.target.value)}
                  className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setField('isActive', e.target.checked)}
                className="w-4 h-4 accent-emerald-600"
              />
              <span className="font-bold">Kích hoạt thiết bị (isActive)</span>
            </label>

            {/* Sensors */}
            <div className="border-t border-outline-variant pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm text-on-surface">Cảm biến (sensors)</h4>
                <button type="button" onClick={addSensor} className="text-[11px] font-bold text-primary hover:underline">
                  + Thêm sensor
                </button>
              </div>
              <div className="space-y-2">
                {form.sensors.map((s, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 p-2 bg-surface-container-low rounded-lg">
                    <input
                      value={s.sensorCode}
                      onChange={e => updateSensor(idx, 'sensorCode', e.target.value)}
                      placeholder="Mã sensor (vd: TEMP-AIR-ESP001-01)"
                      className="col-span-4 px-2 py-1.5 border border-outline-variant rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                    <select
                      value={s.sensorType}
                      onChange={e => updateSensor(idx, 'sensorType', Number(e.target.value))}
                      className="col-span-3 px-2 py-1.5 border border-outline-variant rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                    >
                      {SENSOR_TYPE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <input
                      value={s.mqttFieldName}
                      onChange={e => updateSensor(idx, 'mqttFieldName', e.target.value)}
                      placeholder="MQTT field (vd: dht_h)"
                      className="col-span-4 px-2 py-1.5 border border-outline-variant rounded text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => removeSensor(idx)}
                      disabled={form.sensors.length === 1}
                      className="col-span-1 px-2 py-1.5 rounded text-xs bg-rose-100 text-rose-700 hover:bg-rose-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-on-surface-variant mt-2">
                💡 <code className="font-mono">mqttFieldName</code> phải khớp với field trong JSON mà ESP32 gửi qua MQTT topic <code className="font-mono">smartfarm/iot/{`{deviceCode}`}/data</code>
              </p>
            </div>
          </div>

          <div className="p-4 border-t border-outline-variant flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200">
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:bg-[#3d5728] disabled:opacity-50"
            >
              {submitting ? 'Đang lưu...' : (device ? 'Cập nhật' : 'Tạo thiết bị')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BatchIoTPanel;
