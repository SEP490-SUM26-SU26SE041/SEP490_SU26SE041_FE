/**
 * src/utils/stageResultCompute.js
 *
 * Logic khoa học cho form "Kết quả giai đoạn" trong Researcher:
 *  1. Auto-fill các field từ MeasurementRecord (chieuCaoCm, tiLeSong, sanLuongKg, tiLeDauQua)
 *  2. So sánh actual vs target → trả badge status
 *  3. Mini comparison table giữa các nhóm (Control vs Treatments)
 *  4. Auto-generate nhận xét có cấu trúc (3 phần đầu)
 *
 * Tất cả là PURE functions — không network, không state, dễ test.
 */

// ── 1. Mapping: field key trong resultData ↔ metricName trong MeasurementDefinition ──
// Nếu tên metric trong DB khác → chỉ cần sửa bảng này.
const FIELD_TO_METRIC = {
  chieuCaoCm: ['Chiều cao cây', 'Chiều cao trung bình', 'chieuCaoCm', 'Plant height', 'avgHeight'],
  soLaTrungBinh: ['Số lá trung bình', 'Số lá', 'soLa', 'Leaf count'],
  tiLeSong: ['Tỷ lệ sống', 'Survival rate', 'tiLeSong'],
  tocDoSinhTruong: ['Tốc độ sinh trưởng', 'Growth rate'],
  tiLeDauQua: ['Tỷ lệ đậu quả', 'Fruit set rate'],
  sanLuongKg: ['Sản lượng', 'Sản lượng (kg)', 'Yield (kg)', 'sanLuongKg', 'yieldKg']
};

// Field cần tổng hợp (sum) thay vì average
const SUM_FIELDS = new Set(['sanLuongKg']);

// ── 2. Helper: tìm definition theo metricName (fuzzy match) ──────────────────
function findDefinitionByMetric(measurements, targetKey) {
  const candidates = FIELD_TO_METRIC[targetKey] || [targetKey];
  for (const def of measurements) {
    const name = (def.metricName || '').trim().toLowerCase();
    if (!name) continue;
    if (candidates.some(c => c.toLowerCase() === name)) return def;
  }
  return null;
}

// ── 3. Helper: gom measurement records theo (batchId × metricName) ──────────
// M�i record có shape: { measurementDefinitionId, value, batchId, measuredAt, ... }
// Có thể resolve sang metricName thông qua `measurements` (definitions).
export function groupRecordsByMetric(records, definitions) {
  const defById = new Map();
  definitions.forEach(d => d.id && defById.set(d.id, d));

  // Trả về Map<metricName_lower, Array<{record, definition}>>
  const groups = new Map();
  for (const r of records || []) {
    const def = r.measurementDefinitionId ? defById.get(r.measurementDefinitionId) : null;
    const name = (def?.metricName || r.metricName || '').trim().toLowerCase();
    if (!name) continue;
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push({ record: r, definition: def });
  }
  return groups;
}

// ── 4. Auto-fill 1 field từ records ──────────────────────────────────────────
/**
 * @param {string} fieldKey - vd 'chieuCaoCm'
 * @param {Array} records - measurement records của stage (hoặc batch)
 * @param {Array} definitions - measurement definitions
 * @returns {{ value, count, source, definition } | null}
 *   - value: số đã tính (avg hoặc sum tuỳ field)
 *   - count: số record nguồn
 *   - source: tên metric
 *   - definition: definition object nếu tìm thấy
 */
export function autoFillField(fieldKey, records, definitions) {
  if (!Array.isArray(records) || records.length === 0) return null;
  if (!Array.isArray(definitions) || definitions.length === 0) return null;

  const definition = findDefinitionByMetric(definitions, fieldKey);
  if (!definition) return null;

  const grouped = groupRecordsByMetric(records, definitions);
  const metricKey = (definition.metricName || '').trim().toLowerCase();
  const entries = grouped.get(metricKey) || [];
  if (entries.length === 0) return null;

  const numericValues = entries
    .map(e => parseFloat(e.record.value))
    .filter(v => !isNaN(v));

  if (numericValues.length === 0) return null;

  const isSum = SUM_FIELDS.has(fieldKey);
  const value = isSum
    ? numericValues.reduce((s, v) => s + v, 0)
    : numericValues.reduce((s, v) => s + v, 0) / numericValues.length;

  // Làm tròn hợp lý (2 chữ số thập phân)
  const rounded = Math.round(value * 100) / 100;

  return {
    value: rounded,
    count: numericValues.length,
    source: definition.metricName,
    definition
  };
}

/**
 * Auto-fill TẤT CẢ field đang có trong schema của 1 stageType.
 * Trả về object { [fieldKey]: { value, count, source, definition } }
 */
export function autoFillAllFields(stageType, records, definitions) {
  const result = {};
  const candidateKeys = [
    'chieuCaoCm', 'soLaTrungBinh', 'tiLeSong', 'tocDoSinhTruong',
    'tiLeDauQua', 'sanLuongKg'
  ];
  for (const key of candidateKeys) {
    const filled = autoFillField(key, records, definitions);
    if (filled) result[key] = filled;
  }
  return result;
}

/**
 * Auto-fill từ MỘT schema động (mảng field { key, label, autoFrom, ... }).
 * - Với mỗi field, tìm definition có metricName khớp `autoFrom` (hoặc label).
 * - Gom records theo (definition) → tính avg/sum → gán vào key.
 *
 * @param {Array} schema - schema động từ buildGrowthResultSchema
 * @param {Array} records - measurement records của stage
 * @param {Array} definitions - measurement definitions
 * @returns {Object} { [fieldKey]: { value, count, source } }
 */
export function autoFillFromDynamicSchema(schema = [], records = [], definitions = [], options = {}) {
  const result = {};
  if (!Array.isArray(schema) || schema.length === 0) return result;
  if (!Array.isArray(records) || records.length === 0) return result;

  // Gom records theo (definitionId × groupId)
  //   - record.groupId có thể ở nhiều shape: groupId / GroupId / group?.id
  //   - Nếu record có groupId: chỉ dùng cho group tương ứng
  //   - Nếu record KHÔNG có groupId: dùng cho "chung"
  const recordsByDefAndGroup = new Map();
  for (const r of records) {
    const did = r.measurementDefinitionId || r.definitionId || r.definition?.id;
    if (!did) continue;
    const rg = r.groupId ?? r.GroupId ?? r.group?.id ?? null;
    const key = `${did}::${rg == null ? '__common__' : String(rg)}`;
    if (!recordsByDefAndGroup.has(key)) recordsByDefAndGroup.set(key, []);
    recordsByDefAndGroup.get(key).push(r);
  }

  for (const f of schema) {
    // Tìm definition theo metricName khớp autoFrom hoặc label
    const target = (f.autoFrom || f.label || '').toLowerCase().trim();
    if (!target) continue;
    const def = definitions.find(d => {
      const n = (d.metricName || d.measurementName || d.name || '').toLowerCase().trim();
      return n === target || n === f.label?.toLowerCase();
    });
    if (!def) continue;
    // Lấy groupId của field (nếu có), ưu tiên field.groupId, fallback options.groupId
    const fGid = f.groupId ?? options.groupId ?? null;
    const lookupKey = `${def.id}::${fGid == null ? '__common__' : String(fGid)}`;
    const recs = recordsByDefAndGroup.get(lookupKey) || [];
    const vals = recs
      .map(r => parseFloat(r.value))
      .filter(v => !isNaN(v));
    if (vals.length === 0) continue;
    const sum = vals.reduce((s, v) => s + v, 0);
    const avg = sum / vals.length;
    const value = Math.round(avg * 100) / 100;
    result[f.key] = { value, count: vals.length, source: def.metricName, definition: def };
  }
  return result;
}

// ── 5. Target + badge ───────────────────────────────────────────────────────
//
// direction: 'higher' = giá trị cao hơn là tốt hơn (chieuCaoCm, sanLuongKg, tiLeDauQua)
//          'lower'  = giá trị thấp hơn là tốt hơn (hiện chưa dùng nhưng hỗ trợ sẵn)
//          'any'    = không đánh giá (chỉ hiển thị)

const FIELD_TARGET_DEFAULTS = {
  chieuCaoCm: { target: 30, tolerance: 0.1, direction: 'higher', unit: 'cm' },
  tiLeSong: { target: 90, tolerance: 0.1, direction: 'higher', unit: '%' },
  tiLeDauQua: { target: 70, tolerance: 0.1, direction: 'higher', unit: '%' },
  sanLuongKg: { target: 100, tolerance: 0.1, direction: 'higher', unit: 'kg' },
  soLaTrungBinh: { target: 10, tolerance: 0.1, direction: 'higher', unit: 'lá' },
  tocDoSinhTruong: { target: 0.5, tolerance: 0.1, direction: 'higher', unit: 'cm/ngày' }
};

/**
 * @param {number} value - giá trị thực tế (input hoặc auto-fill)
 * @param {string} fieldKey
 * @param {{ target?, tolerance?, direction? }} [custom] - override defaults
 * @returns {{ status, label, color, icon, percent, value, target, delta }}
 *   - status: 'met' | 'close' | 'below' | 'above' | 'no_target' | 'no_value'
 */
export function evaluateAgainstTarget(value, fieldKey, custom = {}) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return { status: 'no_value', label: '—', color: 'slate', icon: '·' };

  const defaults = FIELD_TARGET_DEFAULTS[fieldKey] || {};
  const target = custom.target ?? defaults.target;
  const tolerance = custom.tolerance ?? defaults.tolerance ?? 0.1;
  const direction = custom.direction ?? defaults.direction ?? 'any';

  if (target == null || isNaN(target) || target === 0) {
    return { status: 'no_target', label: 'Không có target', color: 'slate', icon: '·', value: num, target: null, percent: null };
  }

  const delta = direction === 'lower' ? target - num : num - target;
  const ratio = num / target;

  let status;
  if (direction === 'any') {
    status = ratio > 0 ? 'met' : 'below';
  } else if (direction === 'higher') {
    if (num >= target * (1 - tolerance)) status = 'met';
    else if (num >= target * 0.8) status = 'close';
    else status = 'below';
  } else {
    // direction === 'lower'
    if (num <= target * (1 + tolerance)) status = 'met';
    else if (num <= target * 1.2) status = 'close';
    else status = 'above';
  }

  const mapping = {
    met:   { label: 'Đạt',         color: 'emerald', icon: '✅' },
    close: { label: 'Gần đạt',     color: 'amber',   icon: '⚡' },
    below: { label: 'Chưa đạt',    color: 'rose',    icon: '⚠️' },
    above: { label: 'Vượt target', color: 'rose',    icon: '⚠️' }
  };
  const m = mapping[status];

  return {
    status,
    label: m.label,
    color: m.color,
    icon: m.icon,
    percent: Math.round(ratio * 100),
    value: num,
    target,
    delta: Math.round(delta * 100) / 100
  };
}

// ── 6. Mini comparison table giữa các nhóm ──────────────────────────────────
//
// Mục đích: ở ngay trong form edit, hiển thị bảng so sánh các giá trị auto-fill
// của từng nhóm → researcher thấy ngay nhóm nào tốt nhất.
//
// Input: stageId, list groups, list batches (mỗi batch có groupId), list records, list definitions.
// Output: { metricKey, label, unit, direction, rows: [{groupId, groupName, value, status, count}] }
//
// Cách hoạt động:
//   - Với mỗi field có auto-fill được: nhóm records theo groupId → tính avg/sum.
//   - Trả về rows đã sort giảm dần theo value.

export function buildMiniComparison({ stageId, groups, batches, records, definitions, fieldKeys }) {
  if (!Array.isArray(groups) || groups.length === 0) return [];
  if (!Array.isArray(batches) || batches.length === 0) return [];
  if (!Array.isArray(records) || records.length === 0) return [];

  // Lọc records theo stage (nếu record có stageId hoặc stage?.id)
  const stageRecords = stageId
    ? records.filter(r => r.stageId === stageId || r.stage?.id === stageId)
    : records;

  if (stageRecords.length === 0) return [];

  const result = [];
  for (const fieldKey of (fieldKeys || Object.keys(FIELD_TARGET_DEFAULTS))) {
    const definition = findDefinitionByMetric(definitions, fieldKey);
    if (!definition) continue;

    const grouped = groupRecordsByMetric(stageRecords, definitions);
    const metricKey = (definition.metricName || '').trim().toLowerCase();
    const entries = grouped.get(metricKey) || [];
    if (entries.length === 0) continue;

    // Group records theo batchId → resolve sang groupId
    const batchToGroup = new Map();
    batches.forEach(b => batchToGroup.set(b.id, b.groupId || b.group?.id));

    const perGroup = new Map(); // groupId → array<value>
    for (const e of entries) {
      const r = e.record;
      const gid = batchToGroup.get(r.batchId || r.batch?.id);
      if (!gid) continue;
      const v = parseFloat(r.value);
      if (isNaN(v)) continue;
      if (!perGroup.has(gid)) perGroup.set(gid, []);
      perGroup.get(gid).push(v);
    }

    if (perGroup.size === 0) continue;

    const isSum = SUM_FIELDS.has(fieldKey);
    const rows = [];
    perGroup.forEach((vals, gid) => {
      const group = groups.find(g => g.id === gid);
      const v = isSum
        ? vals.reduce((s, x) => s + x, 0)
        : vals.reduce((s, x) => s + x, 0) / vals.length;
      const rounded = Math.round(v * 100) / 100;
      const status = evaluateAgainstTarget(rounded, fieldKey);
      rows.push({
        groupId: gid,
        groupName: group?.groupName || `Nhóm ${gid.slice(0, 6)}`,
        value: rounded,
        status,
        count: vals.length
      });
    });

    // Sort giảm dần theo value (group tốt nhất lên đầu)
    rows.sort((a, b) => b.value - a.value);

    // Best = rows[0]
    if (rows.length > 0) {
      rows[0].isBest = true;
    }

    result.push({
      fieldKey,
      label: definition.metricName || fieldKey,
      unit: definition.unit || FIELD_TARGET_DEFAULTS[fieldKey]?.unit || '',
      direction: FIELD_TARGET_DEFAULTS[fieldKey]?.direction || 'any',
      rows
    });
  }
  return result;
}

// ── 7. Template nhận xét có cấu trúc ────────────────────────────────────────
//
// Tự sinh 3 phần đầu:
//   - **Tổng quan:** dựa trên trung bình % đạt target của các metric
//   - **Số liệu nổi bật:** metric có percent cao nhất
//   - **Vấn đề phát hiện:** metric có percent thấp nhất (<80%)
// Phần "Kết luận & khuyến nghị" → researcher tự viết.

/**
 * @param {Object} evalMap - { fieldKey: value } (chỉ các field đã có giá trị)
 * @param {string} stageLabel - Tên stage (vd: "Growing")
 * @returns {string} - Markdown-formatted nhận xét (3 phần đầu)
 */
export function generateStructuredComment(evalMap, stageLabel = 'Giai đoạn') {
  const lines = [];

  // Đánh giá từng field có giá trị
  const evaluations = [];
  for (const [key, val] of Object.entries(evalMap || {})) {
    const ev = evaluateAgainstTarget(val, key);
    if (ev.status !== 'no_target' && ev.status !== 'no_value') {
      evaluations.push({ key, ...ev });
    }
  }

  // ── Phần 1: Tổng quan ─────────────────────────────────
  if (evaluations.length === 0) {
    lines.push(`**Tổng quan:** ${stageLabel} chưa có số liệu để đánh giá.`);
  } else {
    const avgPercent = Math.round(
      evaluations.reduce((s, e) => s + (e.percent || 0), 0) / evaluations.length
    );
    let overallLabel;
    if (avgPercent >= 95) overallLabel = 'rất tốt';
    else if (avgPercent >= 85) overallLabel = 'tốt';
    else if (avgPercent >= 70) overallLabel = 'trung bình';
    else overallLabel = 'chưa đạt k� vọng';

    lines[0] = `**Tổng quan:** ${stageLabel} đạt kết quả ${overallLabel} (trung bình ${avgPercent}% mục tiêu qua ${evaluations.length} chỉ số).`;
  }

  // ── Phần 2: Số liệu nổi bật ──────────────────────────
  if (evaluations.length > 0) {
    const best = [...evaluations].sort((a, b) => (b.percent || 0) - (a.percent || 0))[0];
    const def = FIELD_TARGET_DEFAULTS[best.key] || {};
    lines.push(`**Số liệu nổi bật:** ${best.key} (${best.value}${def.unit || ''}) đạt ${best.percent}% mục tiêu (${best.target}${def.unit || ''}).`);
  }

  // ── Phần 3: Vấn đề phát hiện ─────────────────────────
  const problems = evaluations.filter(e => e.percent < 80);
  if (problems.length === 0) {
    lines.push(`**Vấn đề phát hiện:** Không có chỉ số nào dưới 80% mục tiêu.`);
  } else {
    const list = problems.map(p => {
      const def = FIELD_TARGET_DEFAULTS[p.key] || {};
      return `${p.key} (${p.value}${def.unit || ''}, đạt ${p.percent}%)`;
    }).join(', ');
    lines.push(`**Vấn đề phát hiện:** ${list}.`);
  }

  // ── Phần 4: Kết luận & khuyến nghị (placeholder) ─────
  lines.push(`**Kết luận & khuyến nghị:** `);

  return lines.join('\n');
}

// ── Export helper cho UI: resolve fieldKey → label/unit/direction ────────────
export function getFieldMeta(fieldKey) {
  return FIELD_TARGET_DEFAULTS[fieldKey] || {};
}

// ── 8. Các stage type cần chia kết quả theo từng nhóm (per-group results) ────
const PER_GROUP_STAGE_TYPES = new Set([
  'Nursery', 'Planting', 'Care', 'Growing', 'Growth', 'Evaluation', 'Harvest', 'Harvesting'
]);

/**
 * Sinh schema ĐỘNG cho stage "Theo dõi sinh trưởng" (Growing / Growth)
 *   dựa trên MeasurementDefinition của experiment, lọc theo groupId (mỗi nhóm
 *   chỉ thấy chỉ số tăng trưởng của nhóm đó).
 *
 * Quy ước đặt tên field:
 *   key = slug của metricName, lowercase, snake_case (vd "Chiều cao cây" → "chieu_cao_cay")
 *
 * @param {string} stageType
 * @param {Array} measurements - tất cả MeasurementDefinition của experiment
 * @param {string} [groupId] - nếu có, chỉ lấy metric thuộc groupId này; nếu null,
 *                             lấy metric có groupId = empty/null (metric dùng chung).
 * @returns {Array} schema mảng các field
 */
export function buildGrowthResultSchema(stageType, measurements = [], groupId = null) {
  if (!Array.isArray(measurements) || measurements.length === 0) return [];
  const out = [];
  const gidStr = groupId == null ? null : String(groupId);
  for (const m of measurements) {
    const metricName = (m.metricName || m.measurementName || m.name || '').trim();
    if (!metricName) continue;
    // Filter theo groupId (BE có thể trả field groupId ở nhiều shape)
    const mGid = m.groupId ?? m.GroupId ?? m.group?.id ?? null;
    const mGidStr = mGid == null ? null : String(mGid);
    if (gidStr) {
      // Nhóm cụ thể: chỉ nhận metric có groupId === gidStr (không match metric chung)
      if (mGidStr !== gidStr) continue;
    } else {
      // Nhóm chung (groupId null/undefined từ FE): chỉ nhận metric KHÔNG thuộc nhóm nào (metric chung)
      if (mGidStr && mGidStr !== '' && mGidStr !== 'null') continue;
    }
    // Slug: bỏ dấu TV + snake_case
    const key = metricName
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    if (!key) continue;
    out.push({
      key,
      label: metricName,
      type: 'number',
      unit: m.unit || m.Unit || '',
      min: 0,
      step: 0.1,
      icon: '📊',
      group: 'Sinh trưởng (động)',
      autoFrom: m.metricName || metricName,
      definitionId: m.id || m.Id,
      groupId: mGid,
      description: m.description || m.Description || '',
      targetValue: m.targetValue ?? m.TargetValue ?? null,
      // Bổ sung: dùng cho badge đánh giá (so actual vs target)
      target: m.targetValue ?? m.TargetValue ?? null,
      tolerance: 0.1,
      direction: 'higher'
    });
  }
  // Luôn thêm field "ghiChu" để researcher note thêm nhận xét tự do
  out.push({
    key: 'ghiChu',
    label: 'Ghi chú',
    type: 'text',
    icon: '📝',
    group: 'Khác'
  });
  return out;
}

/**
 * Bổ sung các MeasurementDefinition thuộc stage vào schema hardcode.
 * - Trả về schema mới (không mutate input).
 * - Metric mới có key dạng `m_<slug>` (slug từ metricName, bỏ dấu TV).
 * - Metric đã có key trong schema thì bỏ qua (không trùng).
 * - Chỉ áp dụng cho Growing/Growth; các stage khác trả nguyên baseSchema.
 *
 * @param {Array} baseSchema - schema hiện tại (RESULT_DATA_SCHEMA)
 * @param {string} stageType
 * @param {Array} measurements - toàn bộ measurement definitions
 * @param {string} stageId - lọc metric thuộc stage này
 * @returns {Array} schema mới (đã merge)
 */
export function addDynamicMeasurementsToSchema(baseSchema = [], stageType, measurements = [], stageId = null) {
  const DYNAMIC_STAGES = new Set(['Growing', 'Growth']);
  if (!DYNAMIC_STAGES.has(stageType)) return baseSchema;
  if (!Array.isArray(measurements) || measurements.length === 0) return baseSchema;

  // Nếu không có stageId (BE không liên kết measurement với stage), lấy TẤT CẢ measurement
  // để vẫn có form động. Researcher có thể dùng MeasurementDefinition ở bất kỳ stage nào.
  const stageMeasurements = stageId
    ? measurements.filter(m => {
        if (!m) return false;
        const sid = String(stageId);
        const fields = [
          m.stageId, m.experimentStageId, m.StageId, m.ExperimentStageId,
          m.stage?.id, m.Stage?.id
        ].map(v => (v == null ? '' : String(v)));
        return fields.includes(sid);
      })
    : measurements;
  if (stageMeasurements.length === 0) return baseSchema;

  const existingKeys = new Set(baseSchema.map(f => f.key));
  const out = [...baseSchema];
  for (const m of stageMeasurements) {
    const metricName = (m.metricName || m.measurementName || m.name || m.MeasurementName || m.title || '').trim();
    if (!metricName) continue;
    // Slug: bỏ dấu TV + thay ký tự đặc biệt bằng _
    const key = 'm_' + metricName
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^./, c => c.toLowerCase());
    if (!key || key === 'm_' || existingKeys.has(key)) continue;
    existingKeys.add(key);
    out.push({
      key,
      label: metricName,
      type: 'number',
      unit: m.unit || m.Unit || '',
      min: 0,
      step: 0.1,
      icon: '📊',
      group: '📊 Sinh trưởng (động)',
      autoFrom: m.metricName || metricName,
      definitionId: m.id || m.Id,
      description: m.description || m.Description || '',
      targetValue: m.targetValue ?? m.TargetValue ?? null
    });
  }
  return out;
}

/**
 * Check xem stage type này có cần form nhập kết quả theo từng nhóm hay không.
 * Trả về true cho các stage có ý nghĩa so sánh giữa các nhóm (Ươm, Gieo, Chăm, Tăng trưởng, Thu hoạch).
 */
export function isPerGroupStage(stageType) {
  return PER_GROUP_STAGE_TYPES.has(stageType);
}

/**
 * Tính kết quả chia theo từng group cho stage:
 *   - Với mỗi field trong fieldKeys, tính avg (hoặc sum nếu SUM_FIELDS) từ records theo group.
 *   - Trả về: { [groupId]: { [fieldKey]: value, _meta?: { count } } }
 *
 * Input: stageId, groups, batches (mỗi batch có groupId), records, definitions, fieldKeys
 * Output: { perGroup: { [groupId]: {...} }, overall: {...} }
 */
export function computeResultsByGroup({ stageId, groups = [], batches = [], records = [], definitions = [], fieldKeys = [] }) {
  const result = { perGroup: {}, overall: {} };
  if (!Array.isArray(groups) || groups.length === 0) return result;
  if (!Array.isArray(batches) || batches.length === 0) return result;
  if (!Array.isArray(records) || records.length === 0) return result;

  // Lọc records theo stage
  const stageRecords = stageId
    ? records.filter(r => r.stageId === stageId || r.stage?.id === stageId)
    : records;
  if (stageRecords.length === 0) return result;

  // batchId -> groupId map
  const batchToGroup = new Map();
  batches.forEach(b => batchToGroup.set(b.id, b.groupId || b.group?.id));

  const keys = fieldKeys.length > 0 ? fieldKeys : Object.keys(FIELD_TARGET_DEFAULTS);

  for (const fieldKey of keys) {
    const definition = findDefinitionByMetric(definitions, fieldKey);
    if (!definition) continue;

    const grouped = groupRecordsByMetric(stageRecords, definitions);
    const metricKey = (definition.metricName || '').trim().toLowerCase();
    const entries = grouped.get(metricKey) || [];
    if (entries.length === 0) continue;

    // Gom value theo groupId
    const perGroupVals = new Map();
    for (const e of entries) {
      const gid = batchToGroup.get(e.record.batchId || e.record.batch?.id);
      if (!gid) continue;
      const v = parseFloat(e.record.value);
      if (isNaN(v)) continue;
      if (!perGroupVals.has(gid)) perGroupVals.set(gid, []);
      perGroupVals.get(gid).push(v);
    }

    const isSum = SUM_FIELDS.has(fieldKey);
    // Per-group values
    perGroupVals.forEach((vals, gid) => {
      const v = isSum ? vals.reduce((s, x) => s + x, 0) : vals.reduce((s, x) => s + x, 0) / vals.length;
      const rounded = Math.round(v * 100) / 100;
      if (!result.perGroup[gid]) result.perGroup[gid] = {};
      result.perGroup[gid][fieldKey] = rounded;
      if (!result.perGroup[gid]._meta) result.perGroup[gid]._meta = {};
      result.perGroup[gid]._meta[fieldKey] = { count: vals.length };
    });

    // Overall (trung bình của tất cả values)
    const allVals = entries.map(e => parseFloat(e.record.value)).filter(v => !isNaN(v));
    if (allVals.length > 0) {
      const allV = isSum ? allVals.reduce((s, x) => s + x, 0) : allVals.reduce((s, x) => s + x, 0) / allVals.length;
      result.overall[fieldKey] = Math.round(allV * 100) / 100;
    }
  }
  return result;
}

/**
 * Sinh cấu trúc rỗng `resultData` theo schema + per-group:
 *   { overall: { ...fieldDefaults }, byGroup: { [groupId]: { ...fieldDefaults } } }
 * Dùng khi tạo stage mới.
 */
export function buildEmptyResultData(stageType, groups = []) {
  const schema = getSchemaForStageType(stageType);
  const initField = (f) => f.type === 'number' ? '' : '';
  const overall = {};
  schema.forEach(f => { overall[f.key] = ''; });
  const byGroup = {};
  groups.forEach(g => {
    byGroup[g.id] = {};
    schema.forEach(f => { byGroup[g.id][f.key] = ''; });
  });
  return { overall, byGroup };
}

// Schema giản lược — chỉ để buildEmpty có key đúng. UI vẫn dùng schema thật trong component.
function getSchemaForStageType(stageType) {
  // Lookup bảng schema định nghĩa ở ResearcherExperiments — fallback an toàn
  const known = {
    Nursery: ['soLuong', 'tiLeNayMam', 'chatLuongCayGiong', 'ghiChu'],
    Planting: ['dienTichGieo', 'matDoGieo', 'soLuongHatGiong', 'tiLeNayMam'],
    Care: ['soLanTuoi', 'luongNuocTong', 'soLanBonPhan', 'loaiPhanBon', 'soLanPhunThuoc', 'ghiChu'],
    Growing: ['chieuCaoCm', 'soLaTrungBinh', 'tiLeSong', 'tocDoSinhTruong'],
    Growth: ['chieuCaoCm', 'soLaTrungBinh', 'tiLeSong', 'tocDoSinhTruong', 'ghiChu'],
    Evaluation: ['tiLeDauQua', 'tiLeSong', 'danhGia', 'ghiChu'],
    Harvest: ['sanLuongKg', 'sanLuongTan', 'chatLuong', 'donGia', 'ghiChu'],
    Harvesting: ['sanLuongKg', 'chatLuong', 'donGia'],
    PostHarvest: ['khoiLuongBaoQuan', 'tyLeHaoHut', 'nhietDoBaoQuan'],
    Preparation: ['dienTichChuanBi', 'thietBiSuDung', 'nhanCong'],
    Other: ['ghiChu']
  };
  return (known[stageType] || []).map(key => ({ key, type: 'number' }));
}

/**
 * Lấy danh sách field key theo stageType dùng cho per-group computation.
 * Chỉ trả về các field có định nghĩa số (number).
 */
export function getAutoFillFieldKeys(stageType) {
  const schema = getSchemaForStageType(stageType);
  return schema.filter(f => f.type === 'number' || ['chieuCaoCm', 'soLaTrungBinh', 'tiLeSong', 'tocDoSinhTruong', 'tiLeDauQua', 'sanLuongKg', 'tiLeNayMam', 'soLuong', 'soLanTuoi', 'luongNuocTong', 'soLanBonPhan', 'soLanPhunThuoc', 'sanLuongTan', 'donGia', 'dienTichChuanBi', 'nhanCong', 'dienTichGieo', 'matDoGieo', 'soLuongHatGiong', 'khoiLuongBaoQuan', 'tyLeHaoHut', 'nhietDoBaoQuan'].includes(f.key)).map(f => f.key);
}

// ── 9. Auto-fill từ Schedules + TaskReports (cho stage Chăm sóc / Tăng trưởng) ────
//
// Ý tưởng khoa học:
//   - Đếm số lịch "kế hoạch" (schedules) theo taskType trong stage → số lần dự kiến
//   - Đếm số task reports "thực tế đã làm" (status = Approved/Completed) → số lần thực tế
//   - Lấy theo từng batchId → resolve về groupId → trả { perGroup: { gid: { soLanTuoi, soLanBonPhan, soLanPhunThuoc } } }
//
// Input:
//   stageId
//   groups, batches (mỗi batch có groupId)
//   schedules: [{ id, experimentStageId, batchId, taskType, ... }]
//   taskReportsByBatch: { [batchId]: [{ status, taskType, ... }] }
//
// Output: { perGroup: { [gid]: { soLanTuoi, soLanBonPhan, soLanPhunThuoc, _meta: {...} } }, overall: { ... } }

/**
 * Map taskType (string từ BE) → field key trong schema của stage Care.
 * Có thể mở rộng cho các stage khác sau.
 */
const TASK_TYPE_TO_CARE_FIELD = {
  Watering: 'soLanTuoi',
  watering: 'soLanTuoi',
  water: 'soLanTuoi',
  tuoi: 'soLanTuoi',
  tuoiNuoc: 'soLanTuoi',
  '1': 'soLanTuoi',
  1: 'soLanTuoi',
  Fertilizing: 'soLanBonPhan',
  fertilizing: 'soLanBonPhan',
  bon: 'soLanBonPhan',
  bonPhan: 'soLanBonPhan',
  '2': 'soLanBonPhan',
  2: 'soLanBonPhan',
  Inspection: 'soLanPhunThuoc',
  inspection: 'soLanPhunThuoc',
  Spraying: 'soLanPhunThuoc',
  spraying: 'soLanPhunThuoc',
  phun: 'soLanPhunThuoc',
  phunThuoc: 'soLanPhunThuoc',
  '3': 'soLanPhunThuoc',
  3: 'soLanPhunThuoc'
};

/**
 * Tính số lần thực tế theo kế hoạch của 1 CareSchedule.
 * Công thức: floor((endDate - startDate) / frequencyDays) + 1
 *  - Nếu thiếu startDate/endDate: fallback về 1
 *  - Nếu frequencyDays <= 0: 1
 *  - Nếu endDate < startDate: 0
 * @param {Object} sc - schedule object có startDate, endDate, frequencyDays
 * @returns {number}
 */
export function calcScheduledOccurrences(sc) {
  if (!sc) return 0;
  const freq = Number(sc.frequencyDays || sc.frequencyDays === 0 ? sc.frequencyDays : 1);
  if (!freq || freq <= 0) return 1;
  if (!sc.startDate || !sc.endDate) return 1;
  const start = new Date(sc.startDate);
  const end = new Date(sc.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 1;
  if (end < start) return 0;
  const days = Math.floor((end - start) / (1000 * 60 * 60 * 24));
  return Math.floor(days / freq) + 1;
}

/**
 * @param {Object} params
 * @param {string} params.stageId
 * @param {Array} params.groups
 * @param {Array} params.batches
 * @param {Array} params.schedules
 * @param {Object} params.taskReportsByBatch - { [batchId]: Array<report> }
 * @returns {{ perGroup: Object, overall: Object, byBatch: Object }}
 */
export function computeResultsFromSchedulesAndReports({ stageId, groups = [], batches = [], schedules = [], taskReportsByBatch = {} }) {
  const result = { perGroup: {}, overall: {}, byBatch: {} };
  if (!Array.isArray(batches) || batches.length === 0) return result;
  if (!Array.isArray(schedules) && !taskReportsByBatch) return result;

  // Lọc schedules của stage này
  const stageSchedules = Array.isArray(schedules)
    ? schedules.filter(sc => sc.experimentStageId === stageId || sc.stageId === stageId)
    : [];

  // Lọc batchIds trong stage (qua schedules HOẶC qua bất kỳ task report nào có batchId)
  const stageBatchIds = new Set();
  stageSchedules.forEach(sc => { if (sc.batchId) stageBatchIds.add(sc.batchId); });
  // Nếu không có schedule, lấy mọi batch có report (fallback)
  if (stageBatchIds.size === 0) {
    Object.keys(taskReportsByBatch || {}).forEach(bid => stageBatchIds.add(bid));
  }
  if (stageBatchIds.size === 0) return result;

  // batchId -> groupId
  const batchToGroup = new Map();
  batches.forEach(b => batchToGroup.set(b.id, b.groupId || b.group?.id));

  // Helper: tăng đếm cho 1 batch × 1 field × 1 nguồn ('planned' | 'actual')
  //   Lưu riêng KH và TT vào _meta, KHÔNG cộng dồn vào field chính.
  //   Field chính sẽ lưu object { planned, actual } để UI dùng riêng cho KH và TT.
  const incBatch = (batchId, fieldKey, source) => {
    if (!batchId) return;
    if (!result.byBatch[batchId]) result.byBatch[batchId] = {};
    if (!result.byBatch[batchId]._meta) result.byBatch[batchId]._meta = {};
    if (!result.byBatch[batchId][fieldKey]) result.byBatch[batchId][fieldKey] = { planned: 0, actual: 0 };
    const cur = result.byBatch[batchId][fieldKey][source] || 0;
    result.byBatch[batchId][fieldKey][source] = cur + 1;
    if (!result.byBatch[batchId]._meta[fieldKey]) result.byBatch[batchId]._meta[fieldKey] = { planned: 0, actual: 0 };
    result.byBatch[batchId]._meta[fieldKey][source] = (result.byBatch[batchId]._meta[fieldKey][source] || 0) + 1;
  };

  // Đếm SCHEDULES (kế hoạch) per batch × taskType
  //   Mỗi schedule có frequencyDays (khoảng cách giữa các lần) + startDate/endDate
  //   → số lần kế hoạch = floor((endDate - startDate) / frequencyDays) + 1
  stageSchedules.forEach(sc => {
    const fk = TASK_TYPE_TO_CARE_FIELD[sc.taskType];
    if (!fk) return;
    const plannedCount = calcScheduledOccurrences(sc);
    for (let i = 0; i < plannedCount; i++) incBatch(sc.batchId, fk, 'planned');
  });

  // Đếm TASK REPORTS thực tế (chỉ tính Approved/Completed) per batch × taskType
  stageBatchIds.forEach(batchId => {
    const reports = taskReportsByBatch[batchId] || [];
    reports.forEach(r => {
      // Chỉ tính report thuộc stage này (nếu có stageId) hoặc thuộc batch trong stage
      if (r.stageId && r.stageId !== stageId) return;
      const fk = TASK_TYPE_TO_CARE_FIELD[r.taskType];
      if (!fk) return;
      const statusOk = r.status === 'Approved' || r.status === 'Completed' || r.status === 'Done' || r.approved === true;
      if (!statusOk) return;
      incBatch(batchId, fk, 'actual');
    });
  });

  // Gom từ batch → group: KH và TT được cộng riêng (KH cộng KH, TT cộng TT)
  Object.entries(result.byBatch).forEach(([bid, vals]) => {
    const gid = batchToGroup.get(bid);
    if (!gid) return;
    if (!result.perGroup[gid]) result.perGroup[gid] = { _meta: {} };
    Object.entries(vals).forEach(([fk, v]) => {
      if (fk === '_meta') return;
      // v là object { planned, actual }
      if (!result.perGroup[gid][fk]) result.perGroup[gid][fk] = { planned: 0, actual: 0 };
      result.perGroup[gid][fk].planned += (v.planned || 0);
      result.perGroup[gid][fk].actual += (v.actual || 0);
      // Meta cho UI
      result.perGroup[gid]._meta[fk] = {
        planned: result.perGroup[gid][fk].planned,
        actual: result.perGroup[gid][fk].actual,
        batchIds: [...(result.perGroup[gid]._meta[fk]?.batchIds || []), bid]
      };
    });
  });

  // Overall: tổng tất cả batch trong stage (KH riêng, TT riêng)
  const fields = new Set();
  Object.values(result.byBatch).forEach(v => Object.keys(v).filter(k => k !== '_meta').forEach(k => fields.add(k)));
  fields.forEach(fk => {
    let plannedSum = 0, actualSum = 0;
    Object.values(result.byBatch).forEach(v => {
      const fv = v[fk] || { planned: 0, actual: 0 };
      plannedSum += (fv.planned || 0);
      actualSum += (fv.actual || 0);
    });
    result.overall[fk] = { planned: plannedSum, actual: actualSum };
  });

  return result;
}
