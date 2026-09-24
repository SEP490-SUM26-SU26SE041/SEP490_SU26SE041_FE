import React from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Lấy object thiết kế từ các trường JSONB khác nhau của experiment
 */
function parseDesign(experiment) {
  if (!experiment) return { type: null, parsed: null, fields: [] };
  const candidates = [
    experiment.design,
    experiment.designParameters,
    experiment.designConfig,
    experiment.designParametersJson,
    experiment.experimentDesign
  ];
  let parsed = null;
  for (const raw of candidates) {
    if (raw == null) continue;
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); if (parsed) break; } catch { parsed = null; }
    } else if (typeof raw === 'object') {
      parsed = raw; break;
    }
  }
  const type = experiment.designType || experiment.designName || parsed?.designType || parsed?.type || '';
  // Trích các cặp key-value từ object JSONB để hiển thị
  const fields = [];
  if (parsed && typeof parsed === 'object') {
    const layout = parsed.layout || parsed.experimentalLayout;
    const treatment = parsed.treatments || parsed.treatmentFactors || parsed.factorLevels;
    const field = parsed.fieldDesign || parsed.plotLayout;
    const stats = parsed.statistical || parsed.analysis;
    const groupConfig = parsed.groups || parsed.factorGroups;
    const collectFlat = (obj) => {
      if (!obj || typeof obj !== 'object') return [];
      return Object.entries(obj).filter(([k, v]) =>
        v !== null && v !== undefined && v !== '' && !['id', 'designType', 'type', 'designName'].includes(k)
      );
    };
    if (groupConfig) fields.push({ group: '👥 Cấu hình nhóm', entries: collectFlat(groupConfig) });
    if (layout) fields.push({ group: '📐 Bố trí', entries: collectFlat(layout) });
    if (treatment) fields.push({ group: '💊 Xử lý / Nhân tố', entries: collectFlat(treatment) });
    if (field) fields.push({ group: '📏 Kích thước ô', entries: collectFlat(field) });
    if (stats) fields.push({ group: '📊 Phân tích thống kê', entries: collectFlat(stats) });
    if (fields.length === 0) fields.push({ group: '⚙️ Cấu hình thiết kế', entries: collectFlat(parsed) });
  }
  return { type, parsed, fields };
}

const DESIGN_META = {
  'CRD': { label: 'CRD', desc: 'Complete Randomize Design', icon: '🎲' },
  'RCBD': { label: 'RCBD', desc: 'Randomized Complete Block Design', icon: '🧱' },
  'LSRD': { label: 'LSRD', desc: 'Latin Square Row Design', icon: '🗂️' },
  'Factorial': { label: 'Factorial', desc: 'Factorial Experiment', icon: '✖️' },
  'Split-Plot': { label: 'Split-Plot', desc: 'Split-Plot Design', icon: '📊' },
  'Strip-Plot': { label: 'Strip-Plot', desc: 'Strip-Plot Design', icon: '🟧' },
  'Nested': { label: 'Nested', desc: 'Nested Design', icon: '🔢' },
  'Ammi': { label: 'AMMI', desc: 'Additive Main Effects and Multiplicative Interaction', icon: '📈' },
  'FactorialRCBD': { label: 'Factorial RCBD', desc: 'Factorial in RCBD', icon: '🧮' },
  'CompletelyRandomized': { label: 'CRD', desc: 'Completely Randomized Design', icon: '🎲' },
};

const FIELD_ICONS = {
  replicates: '🔁', replicate: '🔁', replicationCount: '🔁', blocks: '🧱', block: '🧱',
  rows: '➗', row: '➗', columns: '➗', column: '➗', factors: '✖️', factor: '✖️', factorLevels: '🔢',
  treatmentFactors: '🧪', treatmentGroups: '🧪', experimentalUnits: '📦',
  plotSize: '📏', plantSpacing: '🌱', rowSpacing: '↔️', spacing: '↔️',
  harvestArea: '🌾', plantDensity: '📊', duration: '📅',
  numberOfTreatments: '🧪', treatmentCombinations: '🔀', controlTreatment: '✅',
  treatments: '💊', treatmentName: '💊', variables: '📊', observations: '👁️',
  numberOfGroups: '👥', groupType: '👥', randomization: '🎲', alpha: 'α',
  confidenceLevel: '📊', testType: '🧪', software: '💻',
  name: '🏷️', code: '🏷️', description: '📝', notes: '📝',
  width: '↔️', length: '↔️', area: '📐', depth: '⬇️', height: '⬆️',
  randomizationMethod: '🎲'
};

function formatVal(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? '✅ Có' : '❌ Không';
  if (typeof v === 'number') return v.toLocaleString('vi-VN');
  if (typeof v === 'object') return Array.isArray(v) ? `${v.length} phần tử` : JSON.stringify(v).slice(0, 50);
  return String(v).length > 60 ? String(v).slice(0, 60) + '…' : String(v);
}

// ── Design Parameters Form ─────────────────────────────────────────────────────
/**
 * Render design parameters JSONB thành form fields có nhãn tiếng Việt
 */
const DesignParametersForm = ({ design }) => {
  if (!design) return null;

  // Parse designParameters nếu là string
  let params = design;
  if (typeof design === 'string') {
    try { params = JSON.parse(design); } catch { params = {}; }
  }
  if (!params || typeof params !== 'object') return null;

  // Trường hiển thị với nhãn tiếng Việt
  const fieldDefs = [
    { key: 'designType', label: 'Loại thiết kế', icon: '📐', type: 'text' },
    { key: 'treatments', label: 'Số xử lý', icon: '💊', type: 'number' },
    { key: 'replicationCount', label: 'Số lần lặp lại', icon: '🔁', type: 'number' },
    { key: 'randomizationMethod', label: 'Phương pháp ngẫu nhiên', icon: '🎲', type: 'text' },
    { key: 'blocks', label: 'Số khối', icon: '🧱', type: 'number' },
    { key: 'rows', label: 'Số hàng', icon: '➗', type: 'number' },
    { key: 'columns', label: 'Số cột', icon: '➗', type: 'number' },
    { key: 'plotSize', label: 'Kích thước ô', icon: '📏', type: 'text' },
    { key: 'plantSpacing', label: 'Khoảng cách cây', icon: '🌱', type: 'text' },
    { key: 'rowSpacing', label: 'Khoảng cách hàng', icon: '↔️', type: 'text' },
    { key: 'alpha', label: 'Mức ý nghĩa (α)', icon: 'α', type: 'text' },
    { key: 'confidenceLevel', label: 'Mức tin cậy', icon: '📊', type: 'text' },
    { key: 'testType', label: 'Phương pháp kiểm định', icon: '🧪', type: 'text' },
    { key: 'software', label: 'Phần mềm phân tích', icon: '💻', type: 'text' },
    { key: 'numberOfTreatments', label: 'Số nhân tố xử lý', icon: '✖️', type: 'number' },
    { key: 'numberOfGroups', label: 'Số nhóm', icon: '👥', type: 'number' },
    { key: 'factorLevels', label: 'Cấp nhân tố', icon: '🔢', type: 'text' },
    { key: 'controlTreatment', label: 'Xử lý đối chứng', icon: '✅', type: 'text' },
    { key: 'treatmentCombinations', label: 'Tổ hợp xử lý', icon: '🔀', type: 'text' },
  ];

  // Các trường có trong params
  const filledFields = fieldDefs.filter(f => params[f.key] != null && params[f.key] !== '');

  if (filledFields.length === 0) {
    // Hiển thị toàn bộ key-value nếu không có định nghĩa trước
    const others = Object.entries(params).filter(([k, v]) =>
      v != null && v !== '' && !['id', 'designType', 'type', 'designName'].includes(k)
    );
    if (others.length === 0) return null;
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {others.map(([k, v]) => (
          <div key={k} className="bg-white/70 rounded-lg p-2 border border-slate-200">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-xs">{FIELD_ICONS[k] || '📋'}</span>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{k.replace(/([A-Z])/g, ' $1').trim()}</p>
            </div>
            <p className="text-xs font-semibold text-slate-800">{formatVal(v)}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
      {filledFields.map(f => (
        <div key={f.key} className="bg-white/70 rounded-lg p-2 border border-slate-200">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-xs">{f.icon}</span>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{f.label}</p>
          </div>
          <p className="text-xs font-semibold text-slate-800">
            {f.type === 'number' ? (Number(params[f.key])).toLocaleString('vi-VN') : String(params[f.key])}
          </p>
        </div>
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
/**
 * Tổng quan ngắn gọn về thí nghiệm — dạng "stat card" + "summary info".
 * Bổ sung: request, crop variety, farm, researcher, template, design parameters form
 */
const ExperimentOverviewSummary = ({
  experiment,
  groups = [],
  batches = [],
  measurements = [],
  measurementRecords = [],
  stages = [],
  decisionSummary = [],
  onEditExperiment
}) => {
  // Completed = đã qua ngày kết thúc (endDate < today)
  const now = Date.now();
  const completedStages = stages.filter(s => {
    if (!s.endDate) return false;
    const end = new Date(s.endDate).getTime();
    return !Number.isNaN(end) && end < now;
  }).length;
  // Active = đã bắt đầu (startDate <= today) và chưa kết thúc
  const activeStages = stages.filter(s => {
    if (!s.startDate) return false;
    const start = new Date(s.startDate).getTime();
    if (Number.isNaN(start) || start > now) return false;
    if (s.endDate) {
      const end = new Date(s.endDate).getTime();
      if (!Number.isNaN(end) && end < now) return false;
    }
    return true;
  }).length;

  // Phân tích thiết kế JSONB
  const designInfo = parseDesign(experiment);
  const tm = DESIGN_META[designInfo.type] || { label: designInfo.type || '—', desc: '', icon: '📐' };
  const hasDesign = designInfo.type || designInfo.fields.length > 0 || experiment.designDescription || experiment.design;

  // Lấy design object gốc (dùng cho DesignParametersForm)
  const rawDesign = experiment.design || experiment.designParameters || null;
  let parsedDesign = null;
  if (rawDesign) {
    if (typeof rawDesign === 'string') {
      try { parsedDesign = JSON.parse(rawDesign); } catch { parsedDesign = rawDesign; }
    } else {
      parsedDesign = rawDesign;
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Banner */}
      <div className="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-6 py-5 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200/80 mb-1">
              🧪 {experiment.experimentCode || experiment.code || 'EXPERIMENT'}
            </p>
            <h2 className="text-xl lg:text-2xl font-bold leading-tight">{experiment.title || '—'}</h2>
            {experiment.objective && (
              <p className="text-sm text-indigo-100/90 mt-2 max-w-3xl">{experiment.objective}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] uppercase tracking-widest text-indigo-200/80 font-bold">Trạng thái</span>
              <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold">
                {experiment.status || 'Draft'}
              </span>
            </div>
            {onEditExperiment && (
              <button onClick={onEditExperiment}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-xs font-bold border border-white/20">
                ✏️ Chỉnh sửa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 divide-x divide-slate-100">
        <StatBox icon="👥" label="Nhóm" value={groups.length} accent="indigo" />
        <StatBox icon="📦" label="Lô" value={batches.length} accent="emerald" />
        <StatBox icon="📊" label="Chỉ số đo" value={measurements.length} accent="violet" />
        <StatBox icon="📝" label="Lần đo" value={measurementRecords.length} accent="amber" />
        <StatBox
          icon="🎯"
          label="Giai đoạn"
          value={`${completedStages}/${stages.length}`}
          accent="rose"
          sub={`${activeStages} đang chạy`}
        />
      </div>

      {/* Thông tin mở rộng: request, crop, farm, researcher, template */}
      <div className="px-6 py-4 border-t border-slate-100">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">📋 Thông tin thí nghiệm</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Yêu cầu thí nghiệm */}
          {experiment.requestId && (
            <InfoCard
              icon="📄"
              label="Yêu cầu"
              value={experiment.requestName || experiment.requestCode || `Yêu cầu #${String(experiment.requestId).slice(-8)}`}
              sub={experiment.requestDescription || experiment.requestObjective || experiment.requestId}
              showId={false}
            />
          )}
          {/* Giống cây trồng */}
          {experiment.cropVarietyName && (
            <InfoCard icon="🌿" label="Giống cây trồng" value={experiment.cropVarietyName} sub={experiment.cropVarietyId} />
          )}
          {/* Nông trại */}
          {experiment.farmName && (
            <InfoCard icon="🏡" label="Nông trại" value={experiment.farmName} sub={experiment.farmId} />
          )}
          {/* Người thực hiện */}
          {experiment.researcherName && (
            <InfoCard icon="👨‍🔬" label="Nghiên cứu viên" value={experiment.researcherName} sub={experiment.researcherId} />
          )}
          {/* Quy trình */}
          {experiment.procedureTemplateName && (
            <InfoCard icon="📋" label="Quy trình" value={experiment.procedureTemplateName} sub={experiment.procedureTemplateId} />
          )}
          {/* Hypothesis */}
          {experiment.hypothesis && (
            <InfoCard icon="💡" label="Giả thuyết" value={experiment.hypothesis} sub={null} />
          )}
        </div>
      </div>

      {/* Meta info cơ bản */}
      <div className="px-6 py-4 border-t border-slate-100 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
        <MetaItem label="Mục tiêu" value={experiment.targetOutcome || experiment.objective} />
        <MetaItem label="Bắt đầu" value={experiment.startDate ? new Date(experiment.startDate).toLocaleDateString('vi-VN') : '—'} />
        <MetaItem label="Kết thúc" value={experiment.endDate ? new Date(experiment.endDate).toLocaleDateString('vi-VN') : '—'} />
        <MetaItem label="Thiết kế" value={tm.label !== '—' ? `${tm.icon} ${tm.label}` : '—'} />
      </div>

      {/* Phần thiết kế JSONB - dùng DesignParametersForm cho trực quan */}
      {hasDesign && (
        <div className="px-6 py-4 border-t border-slate-100 bg-gradient-to-r from-indigo-50/40 to-violet-50/40">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              📐 Thông số thiết kế ({tm.label !== '—' ? tm.label : designInfo.type || '—'})
            </p>
            {tm.desc && <span className="text-[10px] text-slate-400 italic">{tm.desc}</span>}
          </div>

          {/* Dùng DesignParametersForm để render trực quan */}
          {parsedDesign ? (
            <DesignParametersForm design={parsedDesign} />
          ) : designInfo.fields.length > 0 ? (
            <div className="space-y-3">
              {designInfo.fields.map((group, gi) => (
                <div key={gi}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{group.group}</p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {group.entries.slice(0, 4).map(([k, v]) => (
                      <div key={k} className="bg-white/80 rounded-lg p-2 border border-slate-200">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-xs">{FIELD_ICONS[k] || '📋'}</span>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 truncate">{k.replace(/([A-Z])/g, ' $1').trim()}</p>
                        </div>
                        <p className="text-xs font-semibold text-slate-800">{formatVal(v)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">{experiment.designDescription || 'Chưa có thông số thiết kế chi tiết'}</p>
          )}
        </div>
      )}
    </section>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────
const StatBox = ({ icon, label, value, accent = 'slate', sub }) => {
  const accentMap = {
    indigo: 'text-indigo-600 bg-indigo-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    violet: 'text-violet-600 bg-violet-50',
    amber: 'text-amber-600 bg-amber-50',
    rose: 'text-rose-600 bg-rose-50',
    slate: 'text-slate-600 bg-slate-50'
  };
  return (
    <div className="px-6 py-4">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-7 h-7 rounded-lg ${accentMap[accent]} flex items-center justify-center text-sm`}>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
};

const MetaItem = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <p className="text-slate-700 font-medium truncate" title={value || ''}>{value || '—'}</p>
  </div>
);

const InfoCard = ({ icon, label, value, sub, showId = true }) => (
  <div className="bg-indigo-50/60 rounded-xl p-3 border border-indigo-100">
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-sm">{icon}</span>
      <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-500">{label}</p>
    </div>
    <p className="text-xs font-semibold text-indigo-900 leading-tight line-clamp-2" title={value}>{value}</p>
    {sub && (
      <p className={`text-[9px] text-indigo-400 mt-1 leading-tight ${showId ? 'truncate' : 'line-clamp-2'}`} title={String(sub)}>
        {showId ? 'ID: ' : ''}{sub}
      </p>
    )}
  </div>
);

export default ExperimentOverviewSummary;
