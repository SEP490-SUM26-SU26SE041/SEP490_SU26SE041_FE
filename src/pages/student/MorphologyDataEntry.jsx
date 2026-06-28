import React, { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import { measurementRecordsApi, taskImagesApi } from '../../api/sharedTaskApi';
import { experimentsApi, batchesApi } from '../../api/experimentApi';
import { cropsApi } from '../../api/studentTechApi';

const MorphologyDataEntry = () => {
  const { showToast } = useToast();
  const [currentPage] = useState(window.location.pathname);
  const [activeSection, setActiveSection] = useState('form');

  const [form, setForm] = useState({
    experimentId: '',
    experimentStageId: '',
    batchId: '',
    measurementDefinitionId: '',
    value: '',
    textValue: '',
    measuredAt: new Date().toISOString().split('T')[0]
  });

  const [extraData, setExtraData] = useState([
    { key: 'plantNumber', value: '' },
    { key: 'location', value: '' },
    { key: 'leafColor', value: 'Medium green' },
    { key: 'stemCondition', value: 'Healthy' },
    { key: 'pestSymptoms', value: 'None' },
    { key: 'diseaseSymptoms', value: 'None' }
  ]);

  const [records, setRecords] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [crops, setCrops] = useState([]);
  const [selectedExp, setSelectedExp] = useState(null);
  const [stages, setStages] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchInitData = async () => {
      try {
        setLoading(true);
        const [expData, cropData] = await Promise.allSettled([
          experimentsApi.getAll(),
          cropsApi.getAll()
        ]);
        setExperiments(Array.isArray(expData.value) ? expData.value : []);
        setCrops(Array.isArray(cropData.value) ? cropData.value : []);
      } catch { /* silent */ } finally { setLoading(false); }
    };
    fetchInitData();
  }, []);

  useEffect(() => {
    const fetchStages = async () => {
      if (!form.experimentId) { setStages([]); return; }
      try {
        const data = await experimentsApi.getStages(form.experimentId);
        setStages(Array.isArray(data) ? data : []);
      } catch { setStages([]); }
    };
    fetchStages();
  }, [form.experimentId]);

  useEffect(() => {
    const fetchBatches = async () => {
      if (!form.experimentId) { setBatches([]); return; }
      try {
        const data = batchesApi.getByExperiment ? await batchesApi.getByExperiment(form.experimentId) : [];
        setBatches(Array.isArray(data) ? data : []);
      } catch { setBatches([]); }
    };
    fetchBatches();
  }, [form.experimentId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const updateExtra = (idx, field, val) => {
    setExtraData(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  const addExtra = () => setExtraData(prev => [...prev, { key: '', value: '' }]);
  const removeExtra = (idx) => setExtraData(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.experimentId) {
      showToast('Vui lòng chọn thí nghiệm', 'error');
      return;
    }
    if (!form.batchId) {
      showToast('Vui lòng nhập Batch ID', 'error');
      return;
    }
    if (!form.value && !form.textValue) {
      showToast('Vui lòng nhập giá trị đo (số hoặc text)', 'error');
      return;
    }

    try {
      setSaving(true);
      const extraObj = {};
      extraData.forEach(r => { if (r.key.trim()) extraObj[r.key.trim()] = r.value; });

      await measurementRecordsApi.create({
        experimentId: form.experimentId,
        experimentStageId: form.experimentStageId || undefined,
        batchId: form.batchId,
        measurementDefinitionId: form.measurementDefinitionId || undefined,
        value: form.value ? parseFloat(form.value) : undefined,
        textValue: form.textValue || undefined,
        extraData: Object.keys(extraObj).length > 0 ? extraObj : undefined,
        measuredAt: form.measuredAt ? new Date(form.measuredAt).toISOString() : new Date().toISOString()
      });

      showToast('Đã ghi nhận đo lường!', 'success');

      // Refresh records for this batch
      if (form.batchId) {
        const data = await measurementRecordsApi.getByBatch(form.batchId);
        setRecords(Array.isArray(data) ? data : []);
      }

      // Reset form
      setForm(prev => ({ ...prev, value: '', textValue: '', measurementDefinitionId: '', experimentStageId: '' }));
      setExtraData([
        { key: 'plantNumber', value: '' },
        { key: 'location', value: '' },
        { key: 'leafColor', value: 'Medium green' },
        { key: 'stemCondition', value: 'Healthy' },
        { key: 'pestSymptoms', value: 'None' },
        { key: 'diseaseSymptoms', value: 'None' }
      ]);
    } catch (err) {
      showToast(err.message || 'Không thể ghi nhận đo lường', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFetchRecords = async () => {
    if (!form.batchId.trim()) { showToast('Vui lòng nhập Batch ID', 'error'); return; }
    try {
      setLoading(true);
      const data = await measurementRecordsApi.getByBatch(form.batchId.trim());
      setRecords(Array.isArray(data) ? data : []);
    } catch { setRecords([]); } finally { setLoading(false); }
  };

  const handleDeleteRecord = async (recordId) => {
    if (!window.confirm('Xóa bản ghi này?')) return;
    try {
      await measurementRecordsApi.remove(recordId);
      showToast('Đã xóa bản ghi', 'success');
      setRecords(prev => prev.filter(r => r.id !== recordId));
    } catch (err) { showToast(err.message || 'Không thể xóa', 'error'); }
  };

  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 font-sans text-slate-900 fixed inset-0 z-[1000]">
      <SharedSidebarM3 />

      <main className="flex-1 ml-64 p-8 overflow-y-auto">
        <div className="max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Requirement T19</p>
                <h1 className="text-4xl font-bold text-slate-900 mt-2">Ghi Nhận Dữ Liệu Hình Thái</h1>
                <p className="text-slate-600 mt-2">Thu thập các chỉ số sinh học định tính của cây trồng — đo lường thực địa.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setActiveSection('form')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeSection === 'form' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  📝 Form
                </button>
                <button onClick={() => setActiveSection('records')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeSection === 'records' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  📋 Bản Ghi ({records.length})
                </button>
              </div>
            </div>
          </div>

          {/* Section: Form */}
          {activeSection === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Experiment + Batch */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-base font-bold text-slate-900 mb-4">Thí Nghiệm & Batch</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Thí Nghiệm <span className="text-rose-500">*</span></label>
                    <select name="experimentId" value={form.experimentId} onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                      <option value="">-- Chọn thí nghiệm --</option>
                      {experiments.map(exp => (
                        <option key={exp.id} value={exp.id}>{exp.title || exp.experimentTitle || exp.name || exp.id}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Giai Đoạn</label>
                    <select name="experimentStageId" value={form.experimentStageId} onChange={handleChange}
                      disabled={stages.length === 0}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-slate-100">
                      <option value="">-- Chọn giai đoạn --</option>
                      {stages.map(s => (
                        <option key={s.id} value={s.id}>{s.stageName || s.name || s.id}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Batch ID <span className="text-rose-500">*</span></label>
                    <input type="text" name="batchId" value={form.batchId} onChange={handleChange}
                      placeholder="VD: batch-guid hoặc B001"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                  </div>
                </div>
              </div>

              {/* Measurement values */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-base font-bold text-slate-900 mb-4">Giá Trị Đo Lường</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Giá Trị Số</label>
                    <input type="number" name="value" value={form.value} onChange={handleChange}
                      step="0.1" placeholder="VD: 65.5"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Giá Trị Text</label>
                    <input type="text" name="textValue" value={form.textValue} onChange={handleChange}
                      placeholder="VD: Bình thường"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Ngày Đo</label>
                    <input type="date" name="measuredAt" value={form.measuredAt} onChange={handleChange}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                  </div>
                </div>
              </div>

              {/* Qualitative observations */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-base font-bold text-slate-900 mb-4">Quan Sát Định Tính</h3>
                <div className="space-y-2">
                  {extraData.map((r, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input type="text" value={r.key} placeholder="Trường (VD: leafColor)"
                        onChange={e => updateExtra(idx, 'key', e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                      <input type="text" value={r.value} placeholder="Giá trị (VD: Medium green)"
                        onChange={e => updateExtra(idx, 'value', e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                      <select value={r.value} onChange={e => updateExtra(idx, 'value', e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        <option value="">-- Chọn --</option>
                        {r.key === 'leafColor' && ['Light green', 'Medium green', 'Dark green', 'Yellowish', 'Reddish'].map(v => <option key={v} value={v}>{v}</option>)}
                        {r.key === 'stemCondition' && ['Healthy', 'Slightly bent', 'Bent', 'Lodged'].map(v => <option key={v} value={v}>{v}</option>)}
                        {r.key === 'pestSymptoms' && ['None', 'Minor (1-5%)', 'Moderate (5-20%)', 'Severe (>20%)'].map(v => <option key={v} value={v}>{v}</option>)}
                        {r.key === 'diseaseSymptoms' && ['None', 'Minor (1-5%)', 'Moderate (5-20%)', 'Severe (>20%)'].map(v => <option key={v} value={v}>{v}</option>)}
                        {r.key === 'vigorLevel' && ['Poor', 'Fair', 'Good', 'Excellent'].map(v => <option key={v} value={v}>{v}</option>)}
                        {r.key === 'growthStage' && ['Seedling', 'Vegetative', 'Flowering', 'Fruiting', 'Mature'].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      {extraData.length > 1 && (
                        <button type="button" onClick={() => removeExtra(idx)} className="px-2 text-rose-500 font-bold hover:text-rose-700">✕</button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addExtra} className="mt-2 text-xs text-indigo-600 font-semibold hover:underline">+ Thêm trường</button>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => {
                  setForm({ experimentId: '', experimentStageId: '', batchId: '', measurementDefinitionId: '', value: '', textValue: '', measuredAt: new Date().toISOString().split('T')[0] });
                  setExtraData([{ key: 'plantNumber', value: '' }, { key: 'location', value: '' }, { key: 'leafColor', value: 'Medium green' }, { key: 'stemCondition', value: 'Healthy' }, { key: 'pestSymptoms', value: 'None' }, { key: 'diseaseSymptoms', value: 'None' }]);
                }}
                  className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition">Xóa Form</button>
                <button type="submit" disabled={saving}
                  className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:from-indigo-700 hover:to-purple-700 transition disabled:opacity-50">
                  {saving ? 'Đang gửi...' : '💾 Ghi Nhận'}
                </button>
              </div>
            </form>
          )}

          {/* Section: Records */}
          {activeSection === 'records' && (
            <div className="space-y-4">
              {/* Fetch by batch */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-3 items-end shadow-sm">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Xem bản ghi theo Batch ID</label>
                  <input type="text" value={form.batchId} onChange={e => setForm(prev => ({ ...prev, batchId: e.target.value }))}
                    placeholder="Nhập Batch ID để tải bản ghi..."
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                </div>
                <button onClick={handleFetchRecords}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20">
                  Tải Bản Ghi
                </button>
              </div>

              {/* Records table */}
              {loading ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400">Đang tải...</div>
              ) : records.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400 border border-slate-200">
                  Chưa có bản ghi nào. Nhập Batch ID và bấm "Tải Bản Ghi" để xem.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-indigo-50 border-b border-indigo-200">
                        <tr>
                          {['Ngày đo', 'Thí nghiệm', 'Batch', 'Chỉ số', 'Giá trị', 'Đơn vị', 'Người đo', 'Hành động'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold text-indigo-700 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {records.map(r => (
                          <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-3 text-xs text-slate-600">{r.measuredAt ? new Date(r.measuredAt).toLocaleString('vi-VN') : '—'}</td>
                            <td className="px-4 py-3 text-xs text-slate-700 max-w-[120px] truncate">{r.experimentTitle || r.experimentId || '—'}</td>
                            <td className="px-4 py-3 text-xs font-mono text-slate-600">{r.batchCode || r.batchId || '—'}</td>
                            <td className="px-4 py-3 text-xs font-semibold text-slate-900">{r.metricName || '—'}</td>
                            <td className="px-4 py-3 text-xs font-bold text-indigo-700">{r.value !== null && r.value !== undefined ? r.value : (r.textValue || '—')}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{r.unit || '—'}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{r.measuredByName || '—'}</td>
                            <td className="px-4 py-3">
                              <button onClick={() => handleDeleteRecord(r.id)}
                                className="text-xs text-rose-500 font-semibold hover:text-rose-700 hover:underline">Xóa</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// Inline sidebar to avoid circular import
const SharedSidebarM3 = () => {
  const navigateTo = (path) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('navigate'));
  };
  const currentPage = window.location.pathname;
  const role = 'Student';
  const tabs = [
    { id: '/student', label: 'Tổng Quan', icon: '🏠' },
    { id: '/student/task-list', label: 'T16 Công Việc', icon: '📋' },
    { id: '/student/care-completion', label: 'T18 Hoàn Thành', icon: '✅' },
    { id: '/student/morphology-entry', label: 'T19 Ghi Nhận', icon: '📊' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 text-slate-900 flex flex-col fixed h-full z-50 shadow-sm">
      <div className="px-6 py-6 border-b border-slate-100">
        <h1 className="text-lg font-bold text-slate-900">Smart <span className="text-blue-600">Farm</span></h1>
        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-0.5">{role} Portal</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => navigateTo(tab.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              currentPage === tab.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'text-slate-600 hover:bg-slate-100'
            }`}>
            <span className="text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-100">
        <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-500 hover:bg-rose-50 text-sm font-medium transition-all">
          <span className="text-base">🚪</span> Đăng Xuất
        </button>
      </div>
    </aside>
  );
};

export default MorphologyDataEntry;
