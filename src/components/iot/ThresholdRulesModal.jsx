import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import thresholdRulesApi, {
  SENSOR_TYPE_OPTIONS,
  SEVERITY_OPTIONS,
  getSeverityMeta,
  getSensorLabel
} from '../../api/thresholdRulesApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return '—'; }
};

// ── Rule form (dùng cho create + edit) ────────────────────────────────────────

const RuleForm = ({ initial, onSubmit, onCancel, submitting, batchId, experimentId, mode = 'create' }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState(() => ({
    sensorType: initial?.sensorType ?? null,
    minValue: initial?.minValue ?? '',
    maxValue: initial?.maxValue ?? '',
    severity: initial?.severity || 'Medium',
    message: initial?.message || '',
    isActive: initial?.isActive !== false
  }));

  const handleChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validation
    if (mode === 'create' && !batchId) {
      showToast('Thiếu batchId', 'error');
      return;
    }
    const min = form.minValue === '' ? null : Number(form.minValue);
    const max = form.maxValue === '' ? null : Number(form.maxValue);
    if (min !== null && max !== null && min > max) {
      showToast(`Giá trị Min (${min}) không được lớn hơn Max (${max})`, 'error');
      return;
    }
    if (min === null && max === null) {
      showToast('Cần nhập ít nhất Min hoặc Max', 'error');
      return;
    }
    const payload = {
      sensorType: form.sensorType || null,
      minValue: min,
      maxValue: max,
      severity: form.severity,
      message: form.message.trim() || null,
      isActive: form.isActive
    };
    if (mode === 'create') payload.batchId = batchId;
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Loại cảm biến */}
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Loại cảm biến</label>
          <select
            value={form.sensorType ?? ''}
            onChange={e => handleChange('sensorType', e.target.value === '' ? null : Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {SENSOR_TYPE_OPTIONS.map(o => (
              <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Severity */}
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Mức cảnh báo *</label>
          <select
            value={form.severity}
            onChange={e => handleChange('severity', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            required
          >
            {SEVERITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Min */}
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Min Value</label>
          <input
            type="number"
            step="any"
            value={form.minValue}
            onChange={e => handleChange('minValue', e.target.value)}
            placeholder="(không giới hạn)"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Max */}
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Max Value</label>
          <input
            type="number"
            step="any"
            value={form.maxValue}
            onChange={e => handleChange('maxValue', e.target.value)}
            placeholder="(không giới hạn)"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Message */}
      <div>
        <label className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Thông báo (tùy chọn, ≤500 ký tự)</label>
        <input
          type="text"
          maxLength={500}
          value={form.message}
          onChange={e => handleChange('message', e.target.value)}
          placeholder="VD: Nhiệt độ vượt ngưỡng an toàn"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      {/* Active */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={e => handleChange('isActive', e.target.checked)}
          className="w-4 h-4 accent-emerald-600"
        />
        <span className="font-semibold text-slate-700">Kích hoạt rule ngay</span>
      </label>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200">
          Hủy
        </button>
        <button type="submit" disabled={submitting}
          className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
          {submitting ? 'Đang lưu...' : (mode === 'create' ? '➕ Tạo rule' : '💾 Cập nhật')}
        </button>
      </div>
    </form>
  );
};

// ── Main modal: list + create/edit ────────────────────────────────────────────

const ThresholdRulesModal = ({ open, onClose, batch, experimentId }) => {
  const { showToast } = useToast();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit'
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterActive, setFilterActive] = useState('all'); // 'all' | 'active' | 'inactive'

  const batchId = batch?.id;
  const batchCode = batch?.batchCode || `Batch ${batchId?.slice(0, 6) || '?'}`;

  // Load rules cho batch hiện tại (cộng luôn rule experiment-wide để hiển thị)
  const loadRules = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const list = await thresholdRulesApi.getAll({ batchId });
      setRules(Array.isArray(list) ? list : []);
    } catch (err) {
      showToast(err.message || 'Lỗi tải rule', 'error');
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [batchId, showToast]);

  useEffect(() => {
    if (open) {
      loadRules();
      setView('list');
      setEditing(null);
    }
  }, [open, loadRules]);

  const filteredRules = useMemo(() => {
    if (filterActive === 'all') return rules;
    return rules.filter(r => filterActive === 'active' ? r.isActive : !r.isActive);
  }, [rules, filterActive]);

  const handleCreate = async (payload) => {
    setSubmitting(true);
    try {
      await thresholdRulesApi.createForBatch(payload);
      showToast('Đã tạo threshold rule', 'success');
      setView('list');
      loadRules();
    } catch (err) {
      showToast(err.message || 'Lỗi tạo rule', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (payload) => {
    if (!editing) return;
    setSubmitting(true);
    try {
      await thresholdRulesApi.update(editing.id, payload);
      showToast('Đã cập nhật rule', 'success');
      setView('list');
      setEditing(null);
      loadRules();
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (rule) => {
    try {
      await thresholdRulesApi.toggle(rule.id, !rule.isActive);
      showToast(rule.isActive ? 'Đã tắt rule' : 'Đã bật rule', 'success');
      loadRules();
    } catch (err) {
      showToast(err.message || 'Lỗi', 'error');
    }
  };

  const handleDelete = async (rule) => {
    if (!window.confirm(`Xóa rule "${getSensorLabel(rule.sensorType)} [${rule.minValue ?? '-'} → ${rule.maxValue ?? '-'}]"?`)) return;
    try {
      await thresholdRulesApi.remove(rule.id);
      showToast('Đã xóa rule', 'success');
      loadRules();
    } catch (err) {
      showToast(err.message || 'Lỗi xóa', 'error');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-violet-50">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                🎚️ Ngưỡng cảnh báo cảm biến
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Batch <span className="font-mono text-indigo-600 font-bold">{batchCode}</span>
                {experimentId && <span className="ml-1 text-slate-400">(Experiment-wide rules cũng áp dụng)</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {view === 'list' && (
                <button
                  onClick={() => setView('create')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                >
                  ➕ Tạo rule cho batch này
                </button>
              )}
              {view !== 'list' && (
                <button
                  onClick={() => { setView('list'); setEditing(null); }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                >
                  ← Quay lại danh sách
                </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {view === 'list' && (
            <>
              {/* Filter */}
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-slate-500">
                  Tổng: <span className="font-bold text-slate-700">{rules.length}</span> rule
                  {rules.filter(r => r.isActive).length > 0 && (
                    <span className="ml-2 text-emerald-600">
                      ({rules.filter(r => r.isActive).length} đang bật)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[11px]">
                  {[
                    { v: 'all', label: 'Tất cả' },
                    { v: 'active', label: '🟢 Đang bật' },
                    { v: 'inactive', label: '⚪ Đã tắt' }
                  ].map(o => (
                    <button key={o.v} onClick={() => setFilterActive(o.v)}
                      className={`px-2 py-1 rounded-md font-bold ${
                        filterActive === o.v ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* List */}
              {loading ? (
                <div className="py-12 text-center text-slate-500">
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                  Đang tải rule...
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <span className="text-4xl block mb-2">🎚️</span>
                  <p className="text-sm font-semibold">
                    {rules.length === 0
                      ? 'Chưa có threshold rule nào cho batch này.'
                      : 'Không có rule nào khớp filter.'}
                  </p>
                  <p className="text-[11px] mt-1">
                    Tạo rule để nhận cảnh báo realtime khi giá trị cảm biến vượt ngưỡng.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRules.map(r => {
                    const sev = getSeverityMeta(r.severity);
                    const isBatchRule = r.batchId === batchId || r.batchCode;
                    return (
                      <div key={r.id}
                        className={`border rounded-xl p-3 transition-all ${
                          r.isActive ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-70'
                        }`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sev.cls}`}>
                                {sev.label}
                              </span>
                              <span className="text-sm font-bold text-slate-900">
                                {getSensorLabel(r.sensorType)}
                              </span>
                              <span className="text-xs text-slate-600 font-mono">
                                [{r.minValue ?? '−∞'} → {r.maxValue ?? '+∞'}]
                              </span>
                              {!isBatchRule && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                                  🌐 Experiment-wide
                                </span>
                              )}
                              {!r.isActive && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                                  TẮT
                                </span>
                              )}
                            </div>
                            {r.message && (
                              <p className="text-[11px] text-slate-600 mt-0.5">{r.message}</p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-1">
                              {r.experimentCode && <>Exp: <span className="font-mono">{r.experimentCode}</span> · </>}
                              {r.batchCode && <>Batch: <span className="font-mono">{r.batchCode}</span> · </>}
                              ID: <span className="font-mono">{r.id?.slice(0, 8)}…</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => handleToggle(r)}
                              className={`px-2 py-1 rounded text-[10px] font-bold ${
                                r.isActive
                                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                  : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              }`}
                              title={r.isActive ? 'Tắt rule' : 'Bật rule'}>
                              {r.isActive ? 'Tắt' : 'Bật'}
                            </button>
                            <button onClick={() => { setEditing(r); setView('edit'); }}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">
                              Sửa
                            </button>
                            <button onClick={() => handleDelete(r)}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-rose-100 text-rose-700 hover:bg-rose-200">
                              Xóa
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Hint for experiment-wide */}
              <div className="mt-4 p-3 bg-violet-50 border border-violet-200 rounded-lg text-[11px] text-violet-700">
                💡 <strong>Experiment-wide rules</strong> (áp dụng cho MỌI batch trong thí nghiệm) hiện không tạo được từ đây.
                Vào trang chi tiết thí nghiệm hoặc dùng API <code className="font-mono">POST /api/threshold-rules/experiment-wide</code>.
              </div>
            </>
          )}

          {view === 'create' && (
            <RuleForm
              initial={null}
              mode="create"
              batchId={batchId}
              experimentId={experimentId}
              submitting={submitting}
              onSubmit={handleCreate}
              onCancel={() => setView('list')}
            />
          )}

          {view === 'edit' && editing && (
            <RuleForm
              initial={editing}
              mode="edit"
              batchId={batchId}
              experimentId={experimentId}
              submitting={submitting}
              onSubmit={handleUpdate}
              onCancel={() => { setView('list'); setEditing(null); }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500 flex items-center justify-between">
          <span>
            🚨 BE chống spam: cùng (sensor, rule) trong vòng 1 phút sẽ bị bỏ qua.
          </span>
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-bold">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThresholdRulesModal;
