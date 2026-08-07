import React, { useMemo } from 'react';

/**
 * TaskReportForm
 * Form báo cáo tác vụ với:
 *  - Quick form theo taskType (Planting/Watering/Fertilizing/Observation/Inspection/Harvest/Other)
 *  - Nút "+ Thêm cột" để user (Student/Tech) tự custom key-value
 *
 * Props:
 *  - task: object task (cần taskType)
 *  - reportText, setReportText
 *  - resultData, setResultData: mảng [{ key, value }] — luôn bao gồm cả quick fields + custom
 *  - saving: boolean
 *  - disabled: boolean (ví dụ task đã Completed)
 *  - onSubmit: handler
 *  - color: 'blue' | 'indigo' | 'amber' | ...
 */

// Quick form schema theo taskType
const QUICK_FORM_SCHEMA = {
  Planting: {
    icon: '🌱',
    color: 'emerald',
    title: 'Báo Cáo Trồng Cây',
    description: 'Ghi nhận nhanh thông tin trồng cây',
    fields: [
      { key: 'plantCount', label: 'Số cây đã trồng', type: 'number', unit: 'cây', required: false },
      { key: 'plantSpacing', label: 'Khoảng cách cây', type: 'number', unit: 'cm', required: false },
      { key: 'soilCondition', label: 'Tình trạng đất', type: 'select', options: ['Tốt', 'Trung bình', 'Khô', 'Ẩm ướt'], required: false },
      { key: 'seedlingSource', label: 'Nguồn giống', type: 'text', placeholder: 'VD: Vườn ươm A', required: false }
    ]
  },
  Watering: {
    icon: '💧',
    color: 'blue',
    title: 'Báo Cáo Tưới Nước',
    description: 'Ghi nhận lượng nước và điều kiện tưới',
    fields: [
      { key: 'waterAmount', label: 'Lượng nước tưới', type: 'number', unit: 'L/m²', required: false },
      { key: 'irrigationMethod', label: 'Phương pháp tưới', type: 'select', options: ['Phun mưa', 'Nhỏ giọt', 'Thủ công', 'Ngập'], required: false },
      { key: 'duration', label: 'Thời gian tưới', type: 'number', unit: 'phút', required: false },
      { key: 'soilMoistureBefore', label: 'Độ ẩm đất trước', type: 'number', unit: '%', required: false },
      { key: 'soilMoistureAfter', label: 'Độ ẩm đất sau', type: 'number', unit: '%', required: false }
    ]
  },
  Fertilizing: {
    icon: '🧪',
    color: 'amber',
    title: 'Báo Cáo Bón Phân',
    description: 'Ghi nhận loại phân và liều lượng',
    fields: [
      { key: 'fertilizerType', label: 'Loại phân', type: 'select', options: ['NPK', 'Hữu cơ', 'Vi sinh', 'Ure', 'Phân chuồng', 'Phân xanh', 'Khác'], required: false },
      { key: 'fertilizerAmount', label: 'Liều lượng', type: 'number', unit: 'g/cây', required: false },
      { key: 'fertilizerBrand', label: 'Thương hiệu/Nhãn hiệu', type: 'text', placeholder: 'VD: Đầu Trâu', required: false },
      { key: 'applicationMethod', label: 'Cách bón', type: 'select', options: ['Rải gốc', 'Pha nước', 'Bón lá', 'Bón theo hàng'], required: false }
    ]
  },
  Observation: {
    icon: '👁️',
    color: 'purple',
    title: 'Báo Cáo Quan Sát',
    description: 'Ghi nhận tình trạng sinh trưởng',
    fields: [
      { key: 'plantHeight', label: 'Chiều cao trung bình', type: 'number', unit: 'cm', required: false },
      { key: 'leafCount', label: 'Số lá trung bình', type: 'number', unit: 'lá', required: false },
      { key: 'leafColor', label: 'Màu sắc lá', type: 'select', options: ['Xanh đậm', 'Xanh nhạt', 'Vàng', 'Có đốm', 'Khác'], required: false },
      { key: 'pestSigns', label: 'Dấu hiệu sâu bệnh', type: 'select', options: ['Không có', 'Ít', 'Trung bình', 'Nhiều'], required: false },
      { key: 'growthStage', label: 'Giai đoạn sinh trưởng', type: 'select', options: ['Mầm', 'Cây con', 'Phát triển', 'Ra hoa', 'Kết trái', 'Thu hoạch'], required: false }
    ]
  },
  Inspection: {
    icon: '🔍',
    color: 'indigo',
    title: 'Báo Cáo Kiểm Tra',
    description: 'Ghi nhận tình trạng kiểm tra định kỳ',
    fields: [
      { key: 'overallHealth', label: 'Tình trạng tổng thể', type: 'select', options: ['Tốt', 'Trung bình', 'Yếu', 'Có vấn đề'], required: false },
      { key: 'pestDiseaseLevel', label: 'Mức độ sâu bệnh', type: 'select', options: ['Không có', 'Nhẹ', 'Trung bình', 'Nặng'], required: false },
      { key: 'affectedPlantCount', label: 'Số cây bị ảnh hưởng', type: 'number', unit: 'cây', required: false },
      { key: 'inspectionChecklist', label: 'Checklist tuân thủ', type: 'select', options: ['Đạt', 'Cần cải thiện', 'Không đạt'], required: false }
    ]
  },
  Harvest: {
    icon: '🌾',
    color: 'orange',
    title: 'Báo Cáo Thu Hoạch',
    description: 'Ghi nhận sản lượng và chất lượng thu hoạch',
    fields: [
      { key: 'harvestWeight', label: 'Khối lượng thu hoạch', type: 'number', unit: 'kg', required: false },
      { key: 'qualityGrade', label: 'Phân loại chất lượng', type: 'select', options: ['Loại A', 'Loại B', 'Loại C', 'Không phân loại'], required: false },
      { key: 'plantCount', label: 'Số cây thu hoạch', type: 'number', unit: 'cây', required: false },
      { key: 'averagePerPlant', label: 'Trung bình/cây', type: 'number', unit: 'kg', required: false },
      { key: 'moistureContent', label: 'Độ ẩm', type: 'number', unit: '%', required: false }
    ]
  },
  Other: {
    icon: '📋',
    color: 'slate',
    title: 'Báo Cáo Khác',
    description: 'Ghi nhận thông tin tự do',
    fields: []
  }
};

// Map color -> Tailwind classes
const COLOR_CLASSES = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-700', icon: 'bg-emerald-100 text-emerald-600' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-700', icon: 'bg-blue-100 text-blue-600' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', icon: 'bg-amber-100 text-amber-600' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-700', icon: 'bg-purple-100 text-purple-600' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', icon: 'bg-indigo-100 text-indigo-600' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-700', icon: 'bg-orange-100 text-orange-600' },
  slate: { bg: 'bg-slate-50', border: 'border-slate-100', text: 'text-slate-700', icon: 'bg-slate-100 text-slate-600' }
};

const TaskReportForm = ({
  task,
  reportText,
  setReportText,
  resultData,
  setResultData,
  saving = false,
  disabled = false,
  onSubmit,
  color = 'indigo',
  submitLabel = 'Gửi Báo Cáo'
}) => {
  const schema = useMemo(() => QUICK_FORM_SCHEMA[task?.taskType] || QUICK_FORM_SCHEMA.Other, [task?.taskType]);
  const colorCls = COLOR_CLASSES[schema.color] || COLOR_CLASSES.indigo;

  // Đồng bộ resultData khi schema thay đổi (khi đổi taskType)
  // Giữ lại các field đã có trong resultData, thêm field mới từ schema
  React.useEffect(() => {
    if (disabled) return;
    const existingKeys = new Set(resultData.map(r => r.key).filter(Boolean));
    const schemaKeys = new Set(schema.fields.map(f => f.key));
    // Không tự động thêm — chỉ xóa các custom key trùng với schema để tránh duplicate
    // Người dùng có thể tự xóa. Việc này giúp ổn định khi người dùng đã nhập liệu
    void existingKeys;
    void schemaKeys;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.taskType]);

  const updateField = (key, value) => {
    setResultData(prev => {
      const idx = prev.findIndex(r => r.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], value };
        return next;
      }
      return [...prev, { key, value }];
    });
  };

  const getFieldValue = (key) => {
    const found = resultData.find(r => r.key === key);
    return found?.value ?? '';
  };

  // Quick fields = các field có key nằm trong schema
  const quickEntries = resultData.filter(r => r.key && schema.fields.some(f => f.key === r.key));
  // Custom fields = các field KHÔNG nằm trong schema (user tự thêm)
  const customEntries = resultData.filter(r => r.key && !schema.fields.some(f => f.key === r.key));
  // Empty rows (chưa nhập key)
  const emptyRows = resultData.filter(r => !r.key);

  const updateCustomRow = (idx, field, value) => {
    setResultData(prev => prev.map((r, i) => {
      // Tìm idx trong customEntries dựa trên r.key
      const isCustom = r.key && !schema.fields.some(f => f.key === r.key);
      if (!isCustom) return r;
      const customIdx = customEntries.findIndex(c => c.key === r.key);
      return customIdx === idx ? { ...r, [field]: value } : r;
    }));
  };

  const removeCustomRow = (customIdx) => {
    const targetKey = customEntries[customIdx]?.key;
    setResultData(prev => prev.filter(r => r.key !== targetKey));
  };

  const addCustomColumn = () => {
    // Tìm key name mới chưa trùng
    let i = 1;
    let newKey = `custom_${i}`;
    const existingKeys = new Set(resultData.map(r => r.key).filter(Boolean));
    while (existingKeys.has(newKey)) {
      i += 1;
      newKey = `custom_${i}`;
    }
    setResultData(prev => [...prev, { key: newKey, value: '' }]);
  };

  const renderQuickField = (field) => {
    const value = getFieldValue(field.key);
    const baseInputCls = `w-full px-3 py-2 border border-${schema.color}-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-${schema.color}-500/20 focus:border-${schema.color}-400 disabled:bg-slate-50 disabled:text-slate-500`;

    if (field.type === 'select') {
      return (
        <div key={field.key} className="space-y-1">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            {field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
          <select value={value} disabled={disabled} onChange={e => updateField(field.key, e.target.value)}
            className={baseInputCls}>
            <option value="">— Chọn —</option>
            {field.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      );
    }

    return (
      <div key={field.key} className="space-y-1">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          {field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
        <div className="relative">
          <input type={field.type} value={value} disabled={disabled}
            placeholder={field.placeholder || (field.type === 'number' ? '0' : 'Nhập...')}
            onChange={e => updateField(field.key, field.type === 'number' ? e.target.value : e.target.value)}
            className={`${baseInputCls} ${field.unit ? 'pr-12' : ''}`} />
          {field.unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant font-semibold">{field.unit}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Report text - common cho mọi task type */}
      <div>
        <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
          📝 Nội dung báo cáo <span className="text-rose-500">*</span>
        </label>
        <textarea value={reportText} disabled={disabled}
          onChange={e => setReportText(e.target.value)}
          placeholder="Mô tả chi tiết về quá trình thực hiện..."
          rows={3}
          className="w-full px-3 py-2.5 border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none bg-white disabled:bg-slate-50 disabled:text-slate-500" />
      </div>

      {/* Quick form theo taskType */}
      {schema.fields.length > 0 && (
        <div className={`rounded-xl p-4 border ${colorCls.bg} ${colorCls.border}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-8 h-8 rounded-lg ${colorCls.icon} flex items-center justify-center text-base`}>{schema.icon}</div>
            <div className="flex-1 min-w-0">
              <h4 className={`text-xs font-bold ${colorCls.text}`}>{schema.title}</h4>
              <p className="text-[10px] text-on-surface-variant mt-0.5">{schema.description}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {schema.fields.map(renderQuickField)}
          </div>
        </div>
      )}

      {/* Custom fields (user tự thêm) */}
      {customEntries.length > 0 && (
        <div className="rounded-xl p-4 border border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🛠️</span>
              <h4 className="text-xs font-bold text-slate-700">Trường tùy chỉnh</h4>
            </div>
            <span className="text-[10px] text-on-surface-variant font-mono">{customEntries.length} cột</span>
          </div>
          <div className="space-y-2">
            {customEntries.map((r, idx) => (
              <div key={r.key + idx} className="flex gap-2 items-start">
                <input type="text" value={r.key} disabled={disabled}
                  onChange={e => updateCustomRow(idx, 'key', e.target.value)}
                  placeholder="Tên cột (VD: waterAmount)"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 disabled:bg-slate-50" />
                <input type="text" value={r.value} disabled={disabled}
                  onChange={e => updateCustomRow(idx, 'value', e.target.value)}
                  placeholder="Giá trị"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 disabled:bg-slate-50" />
                {!disabled && (
                  <button type="button" onClick={() => removeCustomRow(idx)}
                    className="px-2 py-2 text-rose-500 hover:bg-rose-50 rounded-lg font-bold shrink-0"
                    title="Xóa cột">
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nút + Thêm cột */}
      {!disabled && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={addCustomColumn}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-dashed ${colorCls.border} ${colorCls.text} rounded-lg text-xs font-bold hover:bg-white transition-colors`}>
            <span>＋</span> Thêm cột
          </button>
          {emptyRows.length === 0 && customEntries.length === 0 && schema.fields.length === 0 && (
            <span className="text-[10px] text-on-surface-variant italic">Bấm để thêm trường tự do</span>
          )}
          {customEntries.length > 0 && (
            <span className="text-[10px] text-on-surface-variant italic">Thêm cột tùy ý — Student/Tech có thể custom</span>
          )}
        </div>
      )}

      {/* Submit */}
      {!disabled && (
        <button type="submit" disabled={saving || !reportText.trim()}
          className={`w-full py-2.5 ${color === 'blue' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'} text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2`}>
          <span>{saving ? '⏳' : '✉️'}</span>
          {saving ? 'Đang gửi...' : submitLabel}
        </button>
      )}
    </form>
  );
};

// Helper: build resultData object từ array [{key, value}] để gửi API
export const buildReportPayload = (resultArray) => {
  const obj = {};
  resultArray.forEach(r => {
    if (r.key && r.key.trim()) {
      obj[r.key.trim()] = r.value;
    }
  });
  return obj;
};

export default TaskReportForm;
