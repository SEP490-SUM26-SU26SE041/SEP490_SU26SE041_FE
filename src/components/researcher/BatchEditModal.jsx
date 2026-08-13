import React, { useEffect, useState } from 'react';

/**
 * BatchEditModal
 * Modal chỉnh sửa thông tin Lô (Batch) cho Researcher.
 * Dùng khi batch được tạo tự động (Randomize/Generate) nhưng thiếu thông tin.
 *
 * Props:
 *  - open: boolean
 *  - batch: object batch hiện tại
 *  - bedAssignments: danh sách luống đã gán cho experiment
 *  - groups: danh sách nhóm
 *  - onClose: () => void
 *  - onSave: (batchId, payload) => Promise
 */
const BatchEditModal = ({ open, batch, bedAssignments, groups, onClose, onSave }) => {
  const [form, setForm] = useState({
    batchCode: '',
    experimentBedAssignmentId: '',
    groupId: '',
    plantingDate: '',
    expectedHarvestDate: '',
    plantCount: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (batch) {
      setForm({
        batchCode: batch.batchCode || '',
        experimentBedAssignmentId: batch.experimentBedAssignmentId || '',
        groupId: batch.groupId || '',
        plantingDate: batch.plantingDate ? batch.plantingDate.split('T')[0] : '',
        expectedHarvestDate: batch.expectedHarvestDate ? batch.expectedHarvestDate.split('T')[0] : '',
        plantCount: batch.plantCount ?? '',
        notes: batch.notes || ''
      });
      setError('');
    }
  }, [batch]);

  if (!open || !batch) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.batchCode.trim()) {
      setError('Mã lô không được trống');
      return;
    }
    if (!form.experimentBedAssignmentId) {
      setError('Vui lòng chọn luống đã gán');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        batchCode: form.batchCode.trim(),
        experimentBedAssignmentId: form.experimentBedAssignmentId,
        groupId: form.groupId || null,
        plantingDate: form.plantingDate || null,
        expectedHarvestDate: form.expectedHarvestDate || null,
        plantCount: form.plantCount !== '' && form.plantCount !== null
          ? parseInt(form.plantCount, 10)
          : null,
        notes: form.notes?.trim() || null
      };
      await onSave(batch.id, payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi cập nhật lô');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">✏️ Chỉnh Sửa Lô</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cập nhật thông tin lô <span className="font-mono font-bold">{batch.batchCode || '—'}</span>
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Mã Lô *</label>
              <input value={form.batchCode} onChange={e => setForm({ ...form, batchCode: e.target.value })}
                placeholder="VD: BATCH001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Luống Đã Gán *</label>
              <select value={form.experimentBedAssignmentId} onChange={e => setForm({ ...form, experimentBedAssignmentId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400">
                <option value="">— Chọn luống —</option>
                {bedAssignments.map(ba => (
                  <option key={ba.id} value={ba.id}>
                    {ba.bedName || ba.bedCode || 'Luống'} {ba.areaName ? `(${ba.areaName})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Nhóm</label>
              <select value={form.groupId} onChange={e => setForm({ ...form, groupId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400">
                <option value="">— Chọn nhóm —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.groupName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Số Cây</label>
              <input type="number" min="0" value={form.plantCount} onChange={e => setForm({ ...form, plantCount: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Ngày Trồng</label>
              <input type="date" value={form.plantingDate} onChange={e => setForm({ ...form, plantingDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Dự Kiến Thu Hoạch</label>
              <input type="date" value={form.expectedHarvestDate} onChange={e => setForm({ ...form, expectedHarvestDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-on-surface-variant block mb-1">Ghi Chú</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3} placeholder="Ghi chú về lô (giống, điều kiện, đặc điểm...)"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none" />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-white disabled:opacity-50">
            Hủy
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-amber-600/20 disabled:opacity-50 flex items-center gap-2">
            {saving ? <><span>⏳</span> Đang lưu...</> : <><span>💾</span> Lưu Thay Đổi</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchEditModal;
