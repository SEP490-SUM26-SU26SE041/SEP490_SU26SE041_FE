import React, { useEffect, useState } from 'react';
import { experimentsApi } from '../../../api/experimentApi';
import { cropsApi } from '../../../api/cropApi';
import { useToast } from '../../../context/ToastContext';
import { Modal } from '../../farm-manager/components/ui';

const ResearcherTemplates = () => {
  const { showToast } = useToast();
  const [templates, setTemplates] = useState([]);
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [form, setForm] = useState({
    templateName: '',
    cropVarietyId: '',
    objective: '',
    description: '',
    steps: [{ stepOrder: 1, title: '', instruction: '', expectedDurationDays: '', requiredSkillDescription: '', stageType: 1 }]
  });

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const data = await experimentsApi.getProcedureTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Không thể tải quy trình', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCrops = async () => {
    try {
      const data = await cropsApi.getAll();
      setCrops(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchTemplates(); fetchCrops(); }, []);

  const validateForm = () => {
    const errs = {};
    if (!form.templateName.trim()) errs.templateName = 'Tên quy trình không được để trống';
    if (!form.objective.trim()) errs.objective = 'Mục tiêu không được để trống';
    const validSteps = form.steps.filter(s => s.title.trim() && s.instruction.trim());
    if (validSteps.length === 0) errs.steps = 'Cần ít nhất 1 bước thực hiện';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setSaving(true);
      const payload = {
        ...form,
        steps: form.steps
          .filter(s => s.title.trim() && s.instruction.trim())
          .map((s, i) => ({
            ...s,
            stepOrder: i + 1,
            expectedDurationDays: s.expectedDurationDays ? parseInt(s.expectedDurationDays) : null
          }))
      };
      if (payload.cropVarietyId === '') delete payload.cropVarietyId;
      await experimentsApi.createProcedureTemplate(payload);
      showToast('Đã tạo quy trình mẫu thành công!', 'success');
      setShowCreate(false);
      resetForm();
      fetchTemplates();
    } catch (err) {
      showToast(err.message || 'Không thể tạo quy trình', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Xóa quy trình này?')) return;
    try {
      await experimentsApi.removeProcedureTemplate(id);
      showToast('Đã xóa quy trình', 'success');
      fetchTemplates();
    } catch (err) {
      showToast(err.message || 'Không thể xóa quy trình', 'error');
    }
  };

  const resetForm = () => {
    setForm({
      templateName: '', cropVarietyId: '', objective: '', description: '',
      steps: [{ stepOrder: 1, title: '', instruction: '', expectedDurationDays: '', requiredSkillDescription: '', stageType: 1 }]
    });
    setFormErrors({});
  };

  const addStep = () => {
    setForm(f => ({
      ...f,
      steps: [...f.steps, { stepOrder: f.steps.length + 1, title: '', instruction: '', expectedDurationDays: '', requiredSkillDescription: '', stageType: 1 }]
    }));
  };

  const removeStep = (idx) => {
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }));
  };

  const updateStep = (idx, field, value) => {
    setForm(f => ({
      ...f,
      steps: f.steps.map((s, i) => i === idx ? { ...s, [field]: value } : s)
    }));
  };

  const STAGE_TYPES = [
    { value: 1, label: 'Ươm cây (Nursery)' },
    { value: 2, label: 'Chăm sóc (Care)' },
    { value: 3, label: 'Sinh trưởng (Growth)' },
    { value: 4, label: 'Thu hoạch (Harvest)' },
    { value: 5, label: 'Đánh giá (Evaluation)' },
    { value: 99, label: 'Khác (Other)' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">
          {templates.length} quy trình canh tác mẫu
        </p>
        <button onClick={() => { resetForm(); setShowCreate(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tạo Quy Trình Mới
        </button>
      </div>

      {/* Templates grid */}
      {loading ? (
        <div className="bg-white border border-outline-variant rounded-2xl p-12 text-center text-sm text-on-surface-variant">Đang tải...</div>
      ) : templates.length === 0 ? (
        <div className="bg-white border border-outline-variant rounded-2xl p-12 text-center text-sm text-on-surface-variant">
          Chưa có quy trình mẫu nào.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-hanken font-bold text-sm text-on-surface line-clamp-1">{t.templateName || '—'}</h3>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">{t.cropVarietyName || '—'}</p>
                </div>
                <button onClick={() => handleRemove(t.id)}
                  className="text-rose-400 hover:text-rose-600 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
              {t.objective && <p className="text-xs text-on-surface-variant line-clamp-2 mb-2">{t.objective}</p>}
              {t.description && <p className="text-[10px] text-on-surface-variant/70 line-clamp-1 mb-2">{t.description}</p>}
              <div className="flex items-center justify-between pt-3 border-t border-outline-variant">
                <span className="text-[10px] text-on-surface-variant font-mono">
                  {t.stepCount || t.steps?.length || 0} bước
                </span>
                <span className="text-[10px] font-mono text-on-surface-variant">
                  {t.createdAt ? new Date(t.createdAt).toLocaleDateString('vi-VN') : '—'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setFormErrors({}); }} title="Tạo Quy Trình Canh Tác Mẫu" width="max-w-3xl">
        <form onSubmit={handleCreate} className="space-y-4 p-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Tên Quy Trình <span className="text-rose-500">*</span></label>
              <input type="text" value={form.templateName}
                onChange={e => setForm(f => ({ ...f, templateName: e.target.value }))}
                placeholder="VD: Quy trình trồng lúa mùa đông"
                className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${formErrors.templateName ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`} />
              {formErrors.templateName && <p className="text-xs text-rose-600 mt-1">{formErrors.templateName}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Mục Tiêu <span className="text-rose-500">*</span></label>
              <textarea value={form.objective} rows={2}
                onChange={e => setForm(f => ({ ...f, objective: e.target.value }))}
                placeholder="Mô tả mục tiêu của quy trình canh tác..."
                className={`w-full px-3 py-2.5 border rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none ${formErrors.objective ? 'border-rose-400 bg-rose-50' : 'border-outline-variant'}`} />
              {formErrors.objective && <p className="text-xs text-rose-600 mt-1">{formErrors.objective}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Giống Cây Trồng</label>
              <select value={form.cropVarietyId}
                onChange={e => setForm(f => ({ ...f, cropVarietyId: e.target.value }))}
                className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">— Chọn giống cây —</option>
                {crops.map(c => (
                  <optgroup key={c.id} label={c.cropName}>
                    {(c.varieties || []).map(v => <option key={v.id} value={v.id}>{v.varietyName}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1">Mô Tả</label>
              <input type="text" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="VD: Áp dụng cho vùng Bắc Bộ"
                className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-on-surface-variant">
                Các Bước Thực Hiện <span className="text-rose-500">*</span>
              </label>
              <button type="button" onClick={addStep}
                className="text-xs text-indigo-600 font-bold hover:text-indigo-800 flex items-center gap-1">
                + Thêm bước
              </button>
            </div>
            {formErrors.steps && <p className="text-xs text-rose-600 mb-2">{formErrors.steps}</p>}
            <div className="space-y-3">
              {form.steps.map((step, idx) => (
                <div key={idx} className="bg-surface-container-low/50 border border-outline-variant rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-primary">Bước {idx + 1}</span>
                    {form.steps.length > 1 && (
                      <button type="button" onClick={() => removeStep(idx)} className="text-rose-400 hover:text-rose-600 text-xs">Xóa</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <input type="text" value={step.title} placeholder="Tiêu đề bước"
                        onChange={e => updateStep(idx, 'title', e.target.value)}
                        className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                    <div className="col-span-2">
                      <textarea value={step.instruction} rows={2} placeholder="Hướng dẫn thực hiện..."
                        onChange={e => updateStep(idx, 'instruction', e.target.value)}
                        className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none" />
                    </div>
                    <div>
                      <input type="number" value={step.expectedDurationDays} placeholder="Số ngày dự kiến"
                        onChange={e => updateStep(idx, 'expectedDurationDays', e.target.value)}
                        className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                    <div>
                      <select value={step.stageType}
                        onChange={e => updateStep(idx, 'stageType', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                        {STAGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input type="text" value={step.requiredSkillDescription} placeholder="Kỹ năng yêu cầu (VD: Vận hành máy cày)"
                        onChange={e => updateStep(idx, 'requiredSkillDescription', e.target.value)}
                        className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowCreate(false); setFormErrors({}); }}
              className="px-5 py-2.5 border border-outline-variant rounded-xl text-sm font-medium hover:bg-surface-container/50 transition-all">
              Hủy
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Lưu Quy Trình'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ResearcherTemplates;
