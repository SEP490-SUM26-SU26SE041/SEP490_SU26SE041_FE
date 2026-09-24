import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { batchesApi, experimentsApi } from '../../api/experimentApi';
import { groupsApi } from '../../api/researcherApi';
import {
  iotDevicesApi,
  SENSOR_META,
  SensorType,
  IoTDeviceStatus,
  classifyDevice
} from '../../api/iotDevicesApi';

const SENSOR_TYPE_OPTIONS = [
  { value: SensorType.Temperature, label: SENSOR_META[SensorType.Temperature].label },
  { value: SensorType.Humidity, label: SENSOR_META[SensorType.Humidity].label },
  { value: SensorType.SoilMoisture, label: SENSOR_META[SensorType.SoilMoisture].label },
  { value: SensorType.Light, label: SENSOR_META[SensorType.Light].label },
  { value: SensorType.PH, label: SENSOR_META[SensorType.PH].label },
  { value: SensorType.Other, label: SENSOR_META[SensorType.Other].label }
];

// Các MQTT field phổ biến để gợi ý nhanh
const COMMON_MQTT_FIELDS = {
  [SensorType.Temperature]: ['dht_t', 'temp', 'temperature', 'air_temp'],
  [SensorType.Humidity]: ['dht_h', 'humidity', 'air_humid'],
  [SensorType.SoilMoisture]: ['soil_1', 'soil_2', 'soil_moisture', 'soil'],
  [SensorType.Light]: ['lux', 'light', 'ldr'],
  [SensorType.PH]: ['ph'],
  [SensorType.Other]: ['value']
};

const IoTQuickManageModal = ({ open, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [step, setStep] = useState(1); // 1: chọn batch, 2: tạo device
  // ── State: tree dạng [{ experiment, groups: [{ group, batches: [batch] }] }]
  const [treeData, setTreeData] = useState([]);
  const [expandedExperiments, setExpandedExperiments] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [togglingIoT, setTogglingIoT] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Form tạo device
  const [form, setForm] = useState({
    deviceCode: '',
    deviceName: '',
    macAddress: '',
    deviceType: 'ESP32-C3-Water-Sensor',
    isActive: true,
    sensors: [
      { sensorCode: '', sensorType: SensorType.Temperature, mqttFieldName: 'dht_t' }
    ]
  });

  // ── Reset khi mở/đóng modal ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSelectedBatch(null);
      setTreeData([]);
      setExpandedExperiments(new Set());
      setExpandedGroups(new Set());
      setSearchQuery('');
      setForm({
        deviceCode: '',
        deviceName: '',
        macAddress: '',
        deviceType: 'ESP32-C3-Water-Sensor',
        isActive: true,
        sensors: [{ sensorCode: '', sensorType: SensorType.Temperature, mqttFieldName: 'dht_t' }]
      });
    }
  }, [open]);

  // ── Load tất cả experiment → group → batch + trạng thái IoT ──────────────
  const loadBatches = useCallback(async () => {
    try {
      setLoadingBatches(true);
      const experiments = await experimentsApi.getAll().catch(() => []);
      const expList = Array.isArray(experiments) ? experiments : (experiments?.data || experiments?.items || []);

      // Với mỗi experiment → lấy groups + batches song song
      const treeNodes = await Promise.all(expList.map(async (exp) => {
        const [groupsRaw, batchesRaw] = await Promise.all([
          groupsApi.getByExperiment(exp.id).catch(() => []),
          batchesApi.getByExperiment(exp.id).catch(() => [])
        ]);
        const groups = Array.isArray(groupsRaw) ? groupsRaw : (groupsRaw?.data || []);
        const batches = Array.isArray(batchesRaw) ? batchesRaw : (batchesRaw?.data || []);

        // Enrich batch với isIoTEnabled
        const enrichedBatches = await Promise.all(batches.map(async (b) => {
          try {
            const detail = await batchesApi.getById(b.id);
            const d = detail?.data || detail;
            return {
              ...b,
              isIoTEnabled: Boolean(d?.isIoTEnabled ?? d?.IsIoTEnabled ?? false),
              groupId: b.groupId,
              groupName: groups.find(g => g.id === b.groupId)?.groupName || null
            };
          } catch {
            return { ...b, isIoTEnabled: false, groupId: b.groupId, groupName: groups.find(g => g.id === b.groupId)?.groupName || null };
          }
        }));

        // Group batches theo groupId
        const groupMap = new Map();
        // Nhóm "Chưa gán group"
        groupMap.set('__ungrouped__', { group: { id: '__ungrouped__', groupName: 'Chưa gán group' }, batches: [] });

        for (const b of enrichedBatches) {
          const gid = b.groupId || '__ungrouped__';
          if (!groupMap.has(gid)) {
            const g = groups.find(x => x.id === gid);
            groupMap.set(gid, { group: g || { id: gid, groupName: b.groupName || gid }, batches: [] });
          }
          groupMap.get(gid).batches.push(b);
        }

        return {
          experiment: {
            id: exp.id,
            experimentCode: exp.experimentCode || exp.code,
            name: exp.name || exp.experimentName || `Thí nghiệm ${exp.id?.slice(0, 6)}`,
            status: exp.status
          },
          groups: Array.from(groupMap.values()).filter(g => g.batches.length > 0)
        };
      }));

      // Lọc bỏ experiment không có batch nào
      setTreeData(treeNodes.filter(n => n.groups.length > 0 && n.groups.some(g => g.batches.length > 0)));
    } catch (e) {
      console.warn('[loadBatches]', e?.message || e);
      showToast('Không thể tải danh sách batch', 'error');
    } finally {
      setLoadingBatches(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (open) loadBatches();
  }, [open, loadBatches]);

  // ── Chọn batch → nếu chưa bật IoT thì tự bật ──────────────────────────────
  const handleSelectBatch = async (batch) => {
    setSelectedBatch(batch);
    if (!batch.isIoTEnabled) {
      try {
        setTogglingIoT(true);
        await iotDevicesApi.toggleBatchIoT({ batchId: batch.id, isIoTEnabled: true });
        setSelectedBatch({ ...batch, isIoTEnabled: true });
        showToast(`Đã bật IoT cho batch "${batch.batchCode}"`, 'success');
        // Cập nhật trong tree
        setTreeData(prev => prev.map(node => ({
          ...node,
          groups: node.groups.map(g => ({
            ...g,
            batches: g.batches.map(b => b.id === batch.id ? { ...b, isIoTEnabled: true } : b)
          }))
        })));
      } catch (e) {
        showToast(e?.message || 'Không thể bật IoT cho batch', 'error');
        setSelectedBatch(null);
        return;
      } finally {
        setTogglingIoT(false);
      }
    }
    setStep(2);
  };

  // ── Toggle expand experiment/group ───────────────────────────────────────
  const toggleExperiment = (id) => setExpandedExperiments(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleGroup = (id) => setExpandedGroups(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const expandAll = () => {
    setExpandedExperiments(new Set(treeData.map(n => n.experiment.id)));
    setExpandedGroups(new Set(treeData.flatMap(n => n.groups.map(g => g.group.id))));
  };
  const collapseAll = () => {
    setExpandedExperiments(new Set());
    setExpandedGroups(new Set());
  };

  // ── Filter theo search query ─────────────────────────────────────────────
  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return treeData;
    return treeData.map(node => ({
      ...node,
      groups: node.groups.map(g => ({
        ...g,
        batches: g.batches.filter(b =>
          (b.batchCode || '').toLowerCase().includes(q) ||
          (b.groupName || '').toLowerCase().includes(q) ||
          (node.experiment.name || '').toLowerCase().includes(q) ||
          (node.experiment.experimentCode || '').toLowerCase().includes(q)
        )
      })).filter(g => g.batches.length > 0)
    })).filter(n => n.groups.length > 0);
  }, [treeData, searchQuery]);

  // ── Sensor form helpers ───────────────────────────────────────────────────
  const updateSensor = (idx, key, val) => setForm(prev => ({
    ...prev,
    sensors: prev.sensors.map((s, i) => i === idx ? { ...s, [key]: val } : s)
  }));

  const addSensor = () => setForm(prev => ({
    ...prev,
    sensors: [...prev.sensors, { sensorCode: '', sensorType: SensorType.Temperature, mqttFieldName: '' }]
  }));

  const removeSensor = (idx) => setForm(prev => ({
    ...prev,
    sensors: prev.sensors.filter((_, i) => i !== idx)
  }));

  // Auto-suggest sensorCode khi thay đổi sensorType
  const handleSensorTypeChange = (idx, newType) => {
    updateSensor(idx, 'sensorType', newType);
    const fields = COMMON_MQTT_FIELDS[newType] || [];
    const sensor = form.sensors[idx];
    if (!sensor.mqttFieldName || fields.length === 0) {
      updateSensor(idx, 'mqttFieldName', fields[0] || '');
    }
  };

  // ── Submit tạo device + gán vào batch ─────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBatch) { showToast('Vui lòng chọn batch', 'error'); return; }
    if (!form.deviceCode.trim()) { showToast('Vui lòng nhập DeviceCode', 'error'); return; }
    if (!form.deviceName.trim()) { showToast('Vui lòng nhập tên thiết bị', 'error'); return; }
    const validSensors = form.sensors.filter(s => s.sensorCode.trim() && s.mqttFieldName.trim());
    if (validSensors.length === 0) {
      showToast('Cần ít nhất 1 sensor hợp lệ (có mã + MQTT field)', 'error'); return;
    }

    try {
      setSubmitting(true);
      const payload = {
        deviceCode: form.deviceCode.trim(),
        deviceName: form.deviceName.trim(),
        macAddress: form.macAddress.trim() || undefined,
        deviceType: form.deviceType,
        batchId: selectedBatch.id,
        isActive: form.isActive,
        sensors: validSensors.map(s => ({
          sensorCode: s.sensorCode.trim(),
          sensorType: Number(s.sensorType),
          mqttFieldName: s.mqttFieldName.trim()
        }))
      };
      await iotDevicesApi.create(payload);
      showToast(`Đã tạo thiết bị "${form.deviceCode}" và gán vào batch "${selectedBatch.batchCode}"`, 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể tạo thiết bị';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-outline-variant flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-hanken text-lg font-bold text-on-surface">Quản Lý IoT Nhanh</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {step === 1 ? 'Bước 1/2: Chọn batch để gán thiết bị' : 'Bước 2/2: Tạo thiết bị IoT mới'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-2 mb-4">
            <div className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-slate-200'}`} />
            <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-slate-200'}`} />
          </div>
        </div>

        {/* Step 1: Chọn batch — phân nhóm theo Experiment → Group */}
        {step === 1 && (
          <div className="p-5">
            {/* Search + expand/collapse all */}
            {!loadingBatches && treeData.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="🔍 Tìm theo tên TN, mã batch, tên group..."
                  className="flex-1 px-3 py-2 border border-outline-variant rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={expandAll}
                    className="px-3 py-2 text-[10px] font-bold uppercase bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                  >
                    Mở tất cả
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="px-3 py-2 text-[10px] font-bold uppercase bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
                  >
                    Thu gọn
                  </button>
                </div>
              </div>
            )}

            {loadingBatches ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-surface-container-low rounded-xl animate-pulse" />)}
              </div>
            ) : treeData.length === 0 ? (
              <div className="py-10 text-center text-sm text-on-surface-variant">
                <div className="text-3xl mb-2">📦</div>
                <p>Chưa có batch nào. Hãy tạo batch trong trang chi tiết experiment trước.</p>
              </div>
            ) : filteredTree.length === 0 ? (
              <div className="py-10 text-center text-sm text-on-surface-variant">
                <div className="text-3xl mb-2">🔍</div>
                <p>Không tìm thấy batch phù hợp với "{searchQuery}"</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {filteredTree.map(node => {
                  const expOpen = expandedExperiments.has(node.experiment.id);
                  const totalBatches = node.groups.reduce((s, g) => s + g.batches.length, 0);
                  const iotOnCount = node.groups.reduce(
                    (s, g) => s + g.batches.filter(b => b.isIoTEnabled).length, 0
                  );
                  return (
                    <div key={node.experiment.id} className="border border-outline-variant rounded-xl overflow-hidden bg-white">
                      {/* Experiment header */}
                      <button
                        type="button"
                        onClick={() => toggleExperiment(node.experiment.id)}
                        className="w-full text-left px-4 py-3 bg-gradient-to-r from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100 transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-base">{expOpen ? '📂' : '📁'}</span>
                          <span className="text-base">🧪</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {node.experiment.experimentCode && (
                                <span className="font-mono text-[11px] font-bold text-indigo-700">{node.experiment.experimentCode}</span>
                              )}
                              <span className="font-bold text-sm text-on-surface truncate">{node.experiment.name}</span>
                            </div>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">
                              {node.groups.length} group · {totalBatches} batch · <span className="text-emerald-600 font-bold">{iotOnCount} IoT ON</span>
                            </p>
                          </div>
                        </div>
                        <svg
                          className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${expOpen ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                        ><path d="M6 9l6 6 6-6"/></svg>
                      </button>

                      {/* Groups (khi experiment expanded) */}
                      {expOpen && (
                        <div className="border-t border-outline-variant">
                          {node.groups.map(g => {
                            const gOpen = expandedGroups.has(g.group.id);
                            const gIotOn = g.batches.filter(b => b.isIoTEnabled).length;
                            return (
                              <div key={g.group.id} className="border-b last:border-b-0 border-outline-variant">
                                {/* Group header */}
                                <button
                                  type="button"
                                  onClick={() => toggleGroup(g.group.id)}
                                  className="w-full text-left px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-sm">{gOpen ? '📂' : '📁'}</span>
                                    <span className="text-sm">👥</span>
                                    <span className="font-bold text-xs text-slate-700 truncate">{g.group.groupName || 'Nhóm'}</span>
                                    <span className="text-[10px] text-on-surface-variant">
                                      ({g.batches.length} batch · <span className="text-emerald-600 font-bold">{gIotOn} ON</span>)
                                    </span>
                                  </div>
                                  <svg
                                    className={`w-3 h-3 text-slate-500 transition-transform shrink-0 ${gOpen ? 'rotate-180' : ''}`}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                                  ><path d="M6 9l6 6 6-6"/></svg>
                                </button>

                                {/* Batches */}
                                {gOpen && (
                                  <div className="px-3 py-2 space-y-1.5 bg-white">
                                    {g.batches.map(b => (
                                      <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => handleSelectBatch(b)}
                                        disabled={togglingIoT && selectedBatch?.id === b.id}
                                        className="w-full text-left px-3 py-2.5 bg-white border border-outline-variant rounded-lg hover:border-primary hover:shadow-sm transition-all disabled:opacity-50"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-sm">📦</span>
                                              <span className="font-mono text-xs font-bold text-primary">{b.batchCode || `Batch ${b.id?.slice(0, 6)}`}</span>
                                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                                b.isIoTEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                              }`}>
                                                {b.isIoTEnabled ? 'IoT ON' : 'IoT OFF'}
                                              </span>
                                            </div>
                                            <p className="text-[10px] text-on-surface-variant mt-0.5">
                                              🌱 {b.plantCount || 0} cây
                                              {b.plantingDate && <span> · 📅 {new Date(b.plantingDate).toLocaleDateString('vi-VN')}</span>}
                                            </p>
                                          </div>
                                          <span className="text-slate-400 text-xs">→</span>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Tạo device */}
        {step === 2 && selectedBatch && (
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4">
              {/* Batch đã chọn */}
              <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div>
                  <p className="text-[10px] font-bold uppercase text-emerald-700">Batch đã chọn</p>
                  <p className="font-mono font-bold text-sm text-emerald-900">{selectedBatch.batchCode}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[10px] font-bold text-emerald-700 hover:underline"
                >
                  ← Đổi batch
                </button>
              </div>

              {/* Device fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">DeviceCode *</label>
                  <input
                    value={form.deviceCode}
                    onChange={e => setForm(p => ({ ...p, deviceCode: e.target.value }))}
                    placeholder="ESP-001"
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Tên thiết bị *</label>
                  <input
                    value={form.deviceName}
                    onChange={e => setForm(p => ({ ...p, deviceName: e.target.value }))}
                    placeholder="Cảm biến ngoài trời 1"
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">DeviceType</label>
                  <input
                    value={form.deviceType}
                    onChange={e => setForm(p => ({ ...p, deviceType: e.target.value }))}
                    className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="font-bold">Kích hoạt thiết bị ngay (isActive)</span>
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
                        onChange={e => handleSensorTypeChange(idx, Number(e.target.value))}
                        className="col-span-3 px-2 py-1.5 border border-outline-variant rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary/20"
                      >
                        {SENSOR_TYPE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <input
                        value={s.mqttFieldName}
                        onChange={e => updateSensor(idx, 'mqttFieldName', e.target.value)}
                        placeholder="MQTT field"
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
                  💡 MQTT field phải khớp với field trong JSON ESP32 gửi qua topic <code className="font-mono">smartfarm/iot/{`{deviceCode}`}/data</code>
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-outline-variant flex items-center justify-end gap-2 sticky bottom-0 bg-white">
              <button type="button" onClick={() => setStep(1)} className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200">
                ← Quay lại
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:bg-[#3d5728] disabled:opacity-50 flex items-center gap-1"
              >
                {submitting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  <>📡 Tạo & Gán</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default IoTQuickManageModal;
