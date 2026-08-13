import React, { useEffect, useMemo, useState } from 'react';
import { measurementRecordsApi, measurementDefinitionsApi } from '../../api/experimentApi';
import { buildBulkItems, localValidateValue, getValueStatus } from '../../utils/measurement';

/**
 * BulkMeasurementForm
 * Cho phép Technician đo 1 cây/batch với nhiều metric (theo MeasurementDefinition)
 * rồi submit 1 lần qua POST /measurement-records/bulk.
 *
 * Props:
 *  - open: boolean
 *  - experimentId: string
 *  - stageId: string (optional)
 *  - defaultBatchId: string (optional)
 *  - batches: Array<{id, batchCode}>
 *  - onClose: () => void
 *  - onSubmitted: (result) => void
 *  - showToast: ({message, type}) => void
 */
const BulkMeasurementForm = ({
  open,
  experimentId,
  stageId,
  defaultBatchId,
  batches,
  onClose,
  onSubmitted,
  showToast
}) => {
  const [definitions, setDefinitions] = useState([]);
  const [loadingDefs, setLoadingDefs] = useState(false);
  const [batchId, setBatchId] = useState(defaultBatchId || '');
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  // Map: definitionId → value (string để hiển thị ô input)
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Reset form khi đóng/mở
  useEffect(() => {
    if (!open) return;
    setBatchId(defaultBatchId || '');
    setMeasuredAt(new Date().toISOString().slice(0, 16));
    setNotes('');
    setValues({});
    setErrors({});

    if (!experimentId) return;
    const fetchDefs = async () => {
      try {
        setLoadingDefs(true);
        const data = await measurementDefinitionsApi.getByExperiment(experimentId);
        const list = Array.isArray(data) ? data : [];
        setDefinitions(list);
      } catch (err) {
        showToast?.(err.message || 'Không tải được danh sách chỉ số', 'error');
      } finally {
        setLoadingDefs(false);
      }
    };
    fetchDefs();
  }, [open, experimentId, defaultBatchId]);

  // Update một giá trị + validate local
  const updateValue = (defId, raw) => {
    setValues(prev => ({ ...prev, [defId]: raw }));
    const def = definitions.find(d => d.id === defId);
    if (!def) return;
    const msg = localValidateValue(def, raw);
    setErrors(prev => {
      const next = { ...prev };
      if (msg) next[defId] = msg;
      else delete next[defId];
      return next;
    });
  };

  // Debounced server validation
  const serverValidate = async (defId, raw) => {
    const num = typeof raw === 'string' ? parseFloat(raw) : raw;
    if (isNaN(num)) return;
    try {
      const res = await measurementDefinitionsApi.validate(defId, num);
      const errs = res?.errors || (Array.isArray(res) ? res : []);
      setErrors(prev => {
        const next = { ...prev };
        if (!errs || errs.length === 0) {
          // Nếu không có lỗi → giữ nguyên local error (nếu có)
        } else {
          next[defId] = errs[0];
        }
        return next;
      });
    } catch { /* bỏ qua */ }
  };

  const validRows = useMemo(() => {
    return definitions
      .filter(d => values[d.id] !== '' && values[d.id] !== undefined && values[d.id] !== null)
      .map(d => ({ ...d, value: values[d.id] }));
  }, [definitions, values]);

  const hasErrors = Object.keys(errors).length > 0;

  const handleSubmit = async () => {
    if (!batchId) return showToast?.('Vui lòng chọn Batch', 'error');
    if (validRows.length === 0) return showToast?.('Vui lòng nhập ít nhất 1 chỉ số', 'error');
    if (hasErrors) return showToast?.('Vui lòng sửa các giá trị không hợp lệ', 'error');

    const payload = {
      experimentId,
      experimentStageId: stageId || null,
      batchId,
      measuredAt: new Date(measuredAt).toISOString(),
      extraData: notes ? { note: notes } : null,
      items: buildBulkItems(validRows)
    };

    try {
      setSubmitting(true);
      const result = await measurementRecordsApi.bulk(payload);
      const created = result?.created ?? payload.items.length;
      const skipped = result?.skipped ?? 0;
      const warnings = result?.warnings || [];
      const allGood = skipped === 0;
      showToast?.(
        allGood
          ? `✅ Đã ghi nhận ${created} chỉ số cho batch.`
          : `⚠️ Tạo ${created}, bỏ qua ${skipped}. ${warnings[0] || ''}`,
        allGood ? 'success' : 'warning'
      );
      onSubmitted?.(result);
      onClose();
    } catch (err) {
      showToast?.(err.message || 'Lỗi gửi dữ liệu đo lường', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">📏 Ghi Nhận Đo Lường (Hàng Loạt)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Nhập nhiều chỉ số cùng lúc cho 1 batch — hệ thống tạo N record độc lập.
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 text-lg">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Batch + time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Batch *</label>
              <select value={batchId} onChange={e => setBatchId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                <option value="">— Chọn batch —</option>
                {batches?.map(b => <option key={b.id} value={b.id}>{b.batchCode || b.id}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Thời điểm đo *</label>
              <input type="datetime-local" value={measuredAt}
                onChange={e => setMeasuredAt(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white" />
            </div>
          </div>

          {/* Definitions list */}
          {loadingDefs ? (
            <div className="p-8 text-center text-slate-400 text-sm">⏳ Đang tải danh sách chỉ số...</div>
          ) : definitions.length === 0 ? (
            <div className="p-8 text-center text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-lg">
              ⚠️ Experiment này chưa có <strong>MeasurementDefinition</strong>. Vui lòng liên hệ Researcher để tạo trước.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700">Các chỉ số ({definitions.length})</h4>
                <p className="text-[10px] text-slate-400">
                  {validRows.length}/{definitions.length} đã nhập
                </p>
              </div>
              {definitions.map(d => {
                const raw = values[d.id];
                const err = errors[d.id];
                const status = getValueStatus(d, raw);
                return (
                  <div key={d.id} className={`p-3 rounded-lg border ${err ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200 bg-white'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">{d.metricName}</span>
                          {d.unit && <span className="text-[10px] font-mono text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded">{d.unit}</span>}
                          {d.targetValue != null && (
                            <span className="text-[10px] text-slate-500">🎯 target: <span className="font-mono font-bold">{d.targetValue}</span></span>
                          )}
                        </div>
                        {d.description && <p className="text-[10px] text-slate-500 mt-0.5">{d.description}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input type="number" step="0.1" min="0"
                          value={raw ?? ''}
                          placeholder="—"
                          onChange={e => updateValue(d.id, e.target.value)}
                          onBlur={e => raw && serverValidate(d.id, e.target.value)}
                          className={`w-28 px-3 py-2 border rounded-lg text-sm font-bold text-right ${err ? 'border-rose-400' : 'border-slate-300'}`}
                        />
                        {status === 'exceeded' && <span className="text-emerald-500" title="Đạt/vượt target">✅</span>}
                        {status === 'close' && <span className="text-amber-500" title="Gần target">⚡</span>}
                        {status === 'below' && <span className="text-rose-400" title="Dưới target">⚠️</span>}
                      </div>
                    </div>
                    {err && <p className="text-[10px] text-rose-600 mt-1.5">⚠️ {err}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Ghi chú chung cho lần đo</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="VD: Trời nắng nhẹ, đo buổi sáng..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
          <p className="text-[10px] text-slate-500">
            {validRows.length > 0 ? `Sẽ tạo ${validRows.length} bản ghi.` : 'Chưa có chỉ số nào được nhập.'}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={submitting}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-white disabled:opacity-50">
              Hủy
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting || validRows.length === 0 || hasErrors}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-2">
              {submitting ? <><span>⏳</span> Đang gửi...</> : <><span>📊</span> Lưu {validRows.length} chỉ số</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkMeasurementForm;
