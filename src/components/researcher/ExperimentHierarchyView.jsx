import React, { useMemo, useState } from 'react';

// ── Trích metric từ resultData của TaskReport (JSONB) ───────────────────────────
// resultData có dạng:
//   - {[key]: value}: object lỏng, lấy các key trong REPORT_METRIC_KEYS
//   - [{key, value}]: array form, lọc key bắt đầu "def_"
//
// Phân loại metric theo giai đoạn để tránh nhầm lẫn:
//   - PLANTING_KEYS: chỉ xuất hiện ở giai đoạn Gieo hạt / Ươm cây / Trồng
//   - HARVEST_KEYS: chỉ xuất hiện ở giai đoạn Thu hoạch
//   - COMMON_KEYS: có thể xuất hiện ở nhiều giai đoạn
const PLANTING_KEYS = {
  plantCount:        { label: 'Số cây gieo',    unit: 'cây' },
  soLuong:           { label: 'Số lượng gieo',  unit: 'cây' },
  seedsDropped:      { label: 'Số hạt gieo',    unit: 'hạt' }
};

const HARVEST_KEYS = {
  harvestWeight:     { label: 'Khối lượng',     unit: 'kg' },
  sanLuongKg:        { label: 'Khối lượng',     unit: 'kg' },
  sanLuongTon:       { label: 'Sản lượng',      unit: 'tấn' },
  averagePerPlant:   { label: 'TB/cây',         unit: 'kg/cây' }
};

const COMMON_KEYS = {
  tiLeSong:          { label: 'Tỷ lệ sống',     unit: '%' },
  tyLeHaoHut:        { label: 'Tỷ lệ hao hụt',  unit: '%' }
};

// Stage Chăm sóc cây con / Care: lấy chỉ số chăm sóc (KHÔNG bao gồm tăng trưởng)
// (tăng trưởng như chiều cao/số lá đã hiện ở level 1 → bỏ để tránh trùng)
const CARE_KEYS = {
  luongNuocTong:     { label: 'Tổng lượng nước',     unit: 'lít' },
  waterAmount:       { label: 'Lượng nước tưới',     unit: 'L/m²' },
  soLanTuoi:         { label: 'Số lần tưới',         unit: 'lần' },
  duration:          { label: 'Thời gian tưới',      unit: 'phút' },
  soilMoistureBefore:{ label: 'Ẩm đất trước tưới',   unit: '%' },
  soilMoistureAfter: { label: 'Ẩm đất sau tưới',     unit: '%' },
  fertilizerAmount:  { label: 'Liều lượng phân bón', unit: 'g/cây' },
  soLanBonPhan:      { label: 'Số lần bón phân',     unit: 'lần' },
  soLanPhunThuoc:    { label: 'Số lần phun thuốc',   unit: 'lần' },
  affectedPlantCount:{ label: 'Số cây bị ảnh hưởng', unit: 'cây' }
};

// Stage Sinh trưởng / Growth: trống — các chỉ số tăng trưởng đã hiện ở level 1
// → không lấy thêm từ taskReports
const GROWTH_KEYS = {};

// Stage type keywords
const PLANTING_STAGE_KEYWORDS = ['planting', 'seeding', 'nursery', 'sowing', 'gieo', 'ươm', 'trồng', 'germination'];
const HARVEST_STAGE_KEYWORDS = ['harvesting', 'harvest', 'thu hoạch', 'thu-hoach'];
const CARE_STAGE_KEYWORDS = ['care', 'chăm sóc', 'cham soc', 'maintenance', 'maintain', 'watering', 'fertilizing', 'tưới', 'bón phân', 'phun thuốc'];
const GROWTH_STAGE_KEYWORDS = ['growth', 'sinh trưởng', 'sinh truong', 'observation', 'quan sát', 'monitoring'];

const isPlantingStage = (stage) => {
  const t = `${stage?.stageType || ''} ${stage?.stageName || ''}`.toLowerCase();
  return PLANTING_STAGE_KEYWORDS.some(s => t.includes(s));
};

const isHarvestStageFn = (stage) => {
  const t = `${stage?.stageType || ''} ${stage?.stageName || ''}`.toLowerCase();
  return HARVEST_STAGE_KEYWORDS.some(s => t.includes(s));
};

const isCareStage = (stage) => {
  const t = `${stage?.stageType || ''} ${stage?.stageName || ''}`.toLowerCase();
  return CARE_STAGE_KEYWORDS.some(s => t.includes(s));
};

const isGrowthStage = (stage) => {
  const t = `${stage?.stageType || ''} ${stage?.stageName || ''}`.toLowerCase();
  return GROWTH_STAGE_KEYWORDS.some(s => t.includes(s));
};

const getReportMetricKeysForStage = (stage) => {
  // Trả về subset phù hợp với stage type
  if (isPlantingStage(stage)) return { ...PLANTING_KEYS, ...COMMON_KEYS };
  if (isHarvestStageFn(stage)) {
    // Thu hoạch: khối lượng + số cây thu hoạch
    return {
      harvestWeight:     { label: 'Khối lượng',         unit: 'kg' },
      sanLuongKg:        { label: 'Khối lượng',         unit: 'kg' },
      sanLuongTon:       { label: 'Sản lượng',          unit: 'tấn' },
      averagePerPlant:   { label: 'TB/cây',             unit: 'kg/cây' },
      plantCount:        { label: 'Số cây thu hoạch',   unit: 'cây' }, // ← mean plantCount trong report thu hoạch
      soLuong:           { label: 'Số cây thu hoạch',   unit: 'cây' },
      ...COMMON_KEYS
    };
  }
  if (isCareStage(stage)) return { ...CARE_KEYS, ...COMMON_KEYS };
  if (isGrowthStage(stage)) return { ...GROWTH_KEYS, ...COMMON_KEYS };
  return {}; // stage không xác định → không lấy từ taskReports
};

const parseResultData = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); if (parsed && typeof parsed === 'object') return parsed; } catch { /* noop */ }
  }
  if (Array.isArray(raw)) {
    const obj = {};
    raw.forEach(item => { if (item?.key) obj[item.key] = item.value; });
    return obj;
  }
  return {};
};

/**
 * Trích mean của từng metric từ một batch của taskReports
 * @param {Array} taskReports
 * @param {object} [stage] - để lọc key theo stage type (nếu không truyền thì lấy tất cả)
 * @returns {Map<label, { mean, count, unit }>}
 */
const extractStageMetrics = (taskReports = [], stage = null) => {
  const allowedKeys = stage ? getReportMetricKeysForStage(stage) : { ...PLANTING_KEYS, ...HARVEST_KEYS, ...COMMON_KEYS };
  const accum = {};

  taskReports.forEach(report => {
    const data = parseResultData(report.resultData);
    // (1) Lấy các key trong resultData theo whitelist stage
    Object.entries(allowedKeys).forEach(([key, meta]) => {
      if (data[key] === undefined || data[key] === null || data[key] === '') return;
      const v = Number(data[key]);
      if (Number.isNaN(v)) return;
      if (!accum[key]) accum[key] = { sum: 0, count: 0, ...meta };
      accum[key].sum += v;
      accum[key].count += 1;
    });

    // (2) Field đặc thù ở root report object
    //      CHỈ áp dụng cho stage Thu hoạch để tránh nhầm với task Gieo
    if (stage ? isHarvestStageFn(stage) : true) {
      ['harvestYield', 'yieldKg', 'actualYield'].forEach(k => {
        if (report[k] === undefined || report[k] === null) return;
        const v = Number(report[k]);
        if (Number.isNaN(v) || v === 0) return;
        // Dùng key harvestWeight để map label "Khối lượng"
        if (!accum.harvestWeight) accum.harvestWeight = { sum: 0, count: 0, label: 'Khối lượng', unit: 'kg' };
        accum.harvestWeight.sum += v;
        accum.harvestWeight.count += 1;
      });
    }
  });

  return Object.fromEntries(
    Object.entries(accum).map(([k, v]) => [k, { mean: v.count > 0 ? v.sum / v.count : null, count: v.count, label: v.label, unit: v.unit }])
  );
};

/**
 * Build per-group stats cho 1 stage.
 * Với stages có measurement records → ưu tiên dùng records (đã có groupId từ def.groupId).
 * Với stages không có records (Gieo hạt, Thu hoạch, v.v.) → fallback sang taskReports.
 *
 * @param {object} stage
 * @param {Array} measurements - measurement definitions (đã lọc theo group)
 * @param {Map} recordsByBatch - batch.id -> MeasurementRecord[]
 * @param {Array} batches
 * @param {Array} tasks
 * @param {object} taskReportsByBatch - batch.id -> TaskReport[]
 * @param {Array} groups
 * @returns {Array<{ groupId, groupName, stats: Array<{label, value, unit, source}> }>}
 */
const buildStageStatsByGroup = (stage, measurements, recordsByBatch, batches, tasks, taskReportsByBatch, groups) => {
  const stageMeasurementDefs = measurements.filter(m => {
    // Lấy defs gắn với stage này (qua records hoặc qua stageId của def)
    if (m.experimentStageId === stage.id) return true;
    return false;
  });

  const stageTasks = tasks.filter(t => t.experimentStageId === stage.id || t.stageId === stage.id);
  const stageTaskIdSet = new Set(stageTasks.map(t => t.id));

  // Group theo group (chỉ nhóm có batch thuộc stage)
  const groupBuckets = new Map();
  groups.forEach(g => groupBuckets.set(g.id, { group: g, batches: [], records: [], reports: [] }));

  batches.forEach(batch => {
    const gid = batch.groupId || batch.group?.id;
    if (!gid || !groupBuckets.has(gid)) return;
    const bucket = groupBuckets.get(gid);
    bucket.batches.push(batch);
    const recs = recordsByBatch.get(batch.id) || [];
    bucket.records.push(...recs);
    const reports = (taskReportsByBatch?.[batch.id] || [])
      .filter(r => !stageTaskIdSet.size || stageTaskIdSet.has(r.taskId));
    bucket.reports.push(...reports);
  });

  const result = [];
  groupBuckets.forEach((bucket) => {
    if (bucket.batches.length === 0) return;
    const stats = [];

    // (1) Mean từ measurement definitions nếu có
    const defsToUse = stageMeasurementDefs.length > 0 ? stageMeasurementDefs : [];
    defsToUse.forEach(def => {
      const recs = bucket.records.filter(r => r.measurementDefinitionId === def.id);
      const vals = recs.map(r => Number(r.value)).filter(v => !Number.isNaN(v));
      if (vals.length === 0) return;
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      stats.push({
        label: def.metricName,
        value: mean,
        unit: def.unit || '',
        source: 'measurement',
        count: vals.length,
        target: def.targetValue
      });
    });

    // (2) Mean từ taskReports (cho stages không có defs: Gieo hạt, Thu hoạch, v.v.)
    //     Lấy reports thuộc các tasks của stage này
    const relevantReports = bucket.reports.filter(r => {
      // Nếu stageTasks rỗng (chưa tạo task cho stage) thì lấy tất cả reports của bucket
      // (phòng trường hợp stage chưa có task nhưng đã có report)
      if (stageTaskIdSet.size === 0) return true;
      return stageTaskIdSet.has(r.taskId);
    });
    // extractStageMetrics lọc key theo stage type:
    //   - Planting → chỉ lấy plantCount / soLuong / seedsDropped / tiLeSong
    //   - Harvest  → chỉ lấy harvestWeight / sanLuongKg / sanLuongTon / averagePerPlant
    //   - Other    → trả rỗng (chỉ dùng measurements)
    const reportMetrics = extractStageMetrics(relevantReports, stage);
    Object.entries(reportMetrics).forEach(([key, m]) => {
      if (m.mean === null) return;
      stats.push({
        label: m.label,
        value: m.mean,
        unit: m.unit,
        source: 'taskReport',
        count: m.count
      });
    });

    if (stats.length === 0) return;
    result.push({
      groupId: bucket.group.id,
      groupName: bucket.group.groupName || 'Nhóm',
      groupType: bucket.group.groupType,
      stats
    });
  });
  return result;
};

/**
 * View phân cấp: Thí nghiệm → Nhóm → Lô → Giai đoạn → Chỉ số đo lường.
 *
 * Mục tiêu UX:
 *  - Hiển thị rõ quan hệ cha-con bằng cách "lồng nhau".
 *  - Cho mỗi batch hiển thị tất cả measurement records của nó.
 *  - Cho mỗi nhóm hiển thị tổng hợp target vs mean (mini).
 *  - Cho mỗi giai đoạn hiển thị mean chỉ số theo nhóm — nếu stage không có
 *    measurement definitions (Gieo hạt, Thu hoạch) thì lấy mean từ taskReports.
 *  - Không phải bảng Excel dày cột.
 */
const ExperimentHierarchyView = ({
  experiment,
  groups = [],
  batchesByGroup = new Map(),
  stages = [],
  measurements = [],
  recordsByBatch = new Map(),
  tasks = [],
  taskReportsByBatch = {},
  onRenameGroup,
  onUpdateMeasurement
}) => {
  const unassignedBatches = batchesByGroup.get('_unassigned') || [];

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          🌳 Cấu trúc thí nghiệm
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Phân cấp rõ ràng: <b>Thí nghiệm</b> → <b>Nhóm</b> → <b>Lô</b> → <b>Giai đoạn</b> → <b>Chỉ số đo lường</b>
        </p>
      </div>

      <div className="p-6 space-y-6">

        {/* LEVEL 1: Thí nghiệm */}
        <HierarchyNode
          level={1}
          icon="🧪"
          label="Thí nghiệm"
          title={experiment.title}
          subtitle={experiment.experimentCode || experiment.code}
          badgeColor="indigo"
        >
          <div className="text-xs text-slate-600 mb-2">
            Mục tiêu: {experiment.objective || experiment.targetOutcome || '—'}
          </div>

          {/* LEVEL 2: Groups */}
          <div className="space-y-3 mt-3">
            {groups.length === 0 ? (
              <Empty msg="Chưa có nhóm nào" />
            ) : (
              groups.map(group => (
                <GroupNode
                  key={group.id}
                  group={group}
                  batches={batchesByGroup.get(group.id) || []}
                  stages={stages}
                  measurements={measurements}
                  recordsByBatch={recordsByBatch}
                  tasks={tasks}
                  taskReportsByBatch={taskReportsByBatch}
                  onRenameGroup={onRenameGroup}
                />
              ))
            )}

            {/* Lô chưa gán nhóm */}
            {unassignedBatches.length > 0 && (
              <GroupNode
                group={{ id: '_unassigned', groupName: 'Lô chưa phân nhóm', groupType: 'Unassigned', treatmentDescription: 'Các lô chưa được gán vào nhóm thí nghiệm cụ thể.' }}
                batches={unassignedBatches}
                stages={stages}
                measurements={measurements}
                recordsByBatch={recordsByBatch}
                tasks={tasks}
                taskReportsByBatch={taskReportsByBatch}
              />
            )}
          </div>
        </HierarchyNode>

        {/* LEVEL 2 (siblings): Giai đoạn — 1 view phẳng để dễ tham chiếu */}
        {stages.length > 0 && (
          <div className="border-t border-dashed border-slate-200 pt-5">
            <HierarchyNode
              level={2}
              icon="🪜"
              label="Giai đoạn"
              title="Tất cả giai đoạn của thí nghiệm"
              subtitle={`${stages.length} giai đoạn`}
              badgeColor="violet"
            >
              <StageTimeline
              stages={stages}
              measurements={measurements}
              recordsByBatch={recordsByBatch}
              batches={Array.from(batchesByGroup.values()).flat()}
              tasks={tasks}
              taskReportsByBatch={taskReportsByBatch}
              groups={groups}
            />
            </HierarchyNode>
          </div>
        )}

        {/* LEVEL 2 (siblings): Chỉ số đo lường — flat overview */}
        {measurements.length > 0 && (
          <div className="border-t border-dashed border-slate-200 pt-5">
            <HierarchyNode
              level={2}
              icon="📊"
              label="Chỉ số đo lường"
              title="Định nghĩa các chỉ số"
              subtitle={`${measurements.length} chỉ số`}
              badgeColor="amber"
            >
              <MeasurementsIndex measurements={measurements} groups={groups} recordsByBatch={recordsByBatch} batchesByGroup={batchesByGroup} onUpdateMeasurement={onUpdateMeasurement} />
            </HierarchyNode>
          </div>
        )}
      </div>
    </section>
  );
};

// ── LEVEL 2: Group ────────────────────────────────────────────────────────
const GroupNode = ({ group, batches, stages, measurements, recordsByBatch, tasks, taskReportsByBatch, onRenameGroup }) => {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(group.groupName || '');
  const [savingRename, setSavingRename] = useState(false);
  const groupTypeColor = group.groupType === 'Control'
    ? 'bg-blue-100 text-blue-700 border-blue-200'
    : group.groupType === 'Treatment'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';

  // Tính nhanh stats cho group
  const stats = useMemo(() => {
    const measurementStats = [];
    measurements.filter(m => m.groupId === group.id).forEach(def => {
      if (def.targetValue === null || def.targetValue === undefined || def.targetValue === '') return;
      const target = Number(def.targetValue);
      if (Number.isNaN(target)) return;
      let allValues = [];
      batches.forEach(b => {
        const records = recordsByBatch.get(b.id) || [];
        records.forEach(r => {
          if (r.measurementDefinitionId === def.id) {
            const v = Number(r.value);
            if (!Number.isNaN(v)) allValues.push(v);
          }
        });
      });
      if (allValues.length === 0) return;
      const mean = allValues.reduce((s, v) => s + v, 0) / allValues.length;
      measurementStats.push({ def, mean, target, ratio: mean / target, source: 'measurement' });
    });

    // ── Bổ sung: chỉ số từ taskReports CHỈ cho stages Gieo hạt / Thu hoạch ──
    // Gom reports từ tất cả batches của group này, gắn stage cho mỗi report
    // (xác định qua task.experimentStageId) để extractStageMetrics biết dùng whitelist key nào
    const allReportsWithStage = [];
    batches.forEach(b => {
      const reports = taskReportsByBatch?.[b.id] || [];
      reports.forEach(r => {
        const task = tasks.find(t => t.id === r.taskId);
        const stageId = task?.experimentStageId || task?.stageId;
        const stage = stages.find(s => s.id === stageId);
        allReportsWithStage.push({ report: r, stage });
      });
    });

    // Group theo stage
    const byStage = new Map();
    allReportsWithStage.forEach(({ report, stage }) => {
      if (!stage) return;
      if (!byStage.has(stage.id)) byStage.set(stage.id, { stage, reports: [] });
      byStage.get(stage.id).reports.push(report);
    });

    // Tổng hợp theo stage — mỗi stage chỉ đóng góp metrics phù hợp với stage type
    const aggregated = {}; // key → { sum, count, label, unit }
    byStage.forEach(({ stage, reports }) => {
      const stageMetrics = extractStageMetrics(reports, stage);
      Object.entries(stageMetrics).forEach(([key, m]) => {
        if (m.mean === null) return;
        if (!aggregated[key]) aggregated[key] = { sum: 0, count: 0, label: m.label, unit: m.unit };
        // mean của các report → cộng dồn weighted theo count để ra mean tổng
        aggregated[key].sum += m.mean * m.count;
        aggregated[key].count += m.count;
      });
    });

    Object.entries(aggregated).forEach(([key, agg]) => {
      const overallMean = agg.count > 0 ? agg.sum / agg.count : null;
      if (overallMean === null) return;
      measurementStats.push({
        def: { metricName: agg.label, unit: agg.unit, id: `report-${key}`, groupId: group.id },
        mean: overallMean,
        target: null,
        ratio: 0,
        source: 'taskReport',
        count: agg.count
      });
    });

    return measurementStats;
  }, [group, batches, measurements, recordsByBatch, taskReportsByBatch, tasks, stages]);

  const isUnassigned = group.id === '_unassigned';

  // Đếm tổng số measurement records và task reports của group (cho header)
  const measurementCount = useMemo(() => {
    return batches.reduce((sum, b) => sum + (recordsByBatch.get(b.id) || []).length, 0);
  }, [batches, recordsByBatch]);

  const taskReportCount = useMemo(() => {
    return batches.reduce((sum, b) => sum + (taskReportsByBatch?.[b.id] || []).length, 0);
  }, [batches, taskReportsByBatch]);

  const submitRename = async () => {
    if (!draftName.trim() || draftName.trim() === group.groupName) { setEditing(false); return; }
    setSavingRename(true);
    const ok = await onRenameGroup?.(group.id, draftName.trim());
    setSavingRename(false);
    if (ok) setEditing(false);
    else setDraftName(group.groupName || '');
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/40 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100/60 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
            👥
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {editing ? (
                <input value={draftName} autoFocus
                  onChange={e => setDraftName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setEditing(false); setDraftName(group.groupName || ''); } }}
                  onClick={e => e.stopPropagation()}
                  className="px-2 py-0.5 border border-indigo-300 rounded text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
              ) : (
                <p className="font-bold text-slate-900 text-sm">{group.groupName || 'Nhóm'}</p>
              )}
              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${groupTypeColor}`}>
                {group.groupType || 'N/A'}
              </span>
              {editing && (
                <>
                  <button onClick={e => { e.stopPropagation(); submitRename(); }} disabled={savingRename}
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded disabled:opacity-50">
                    {savingRename ? '...' : '✓ Lưu'}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setEditing(false); setDraftName(group.groupName || ''); }}
                    className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded">
                    ✕ Hủy
                  </button>
                </>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate">{group.treatmentDescription || '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-medium">{batches.length} lô</span>
            <span className="text-[10px] text-slate-500 font-medium">
              📊 {measurementCount} lần đo
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              📋 {taskReportCount} báo cáo
            </span>
          </div>
          {!isUnassigned && (
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
              <span onClick={e => { e.stopPropagation(); setEditing(true); }}
                className="p-1 hover:bg-indigo-100 rounded cursor-pointer text-slate-500 hover:text-indigo-600"
                title="Đổi tên nhóm">
                ✏️
              </span>
            </div>
          )}
          <span className="text-slate-400 text-sm">{expanded ? '▾' : '▸'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1">
          {/* Stats mini đã được gỡ — chỉ số đo lường per group hiển thị ở mục "Chỉ số đo lường" (Level 1) */}

          {/* LEVEL 3: Batches */}
          {batches.length === 0 ? (
            <Empty msg="Nhóm này chưa có lô nào" />
          ) : (
            <div className="space-y-2">
              {batches.map(batch => (
                <BatchNode
                  key={batch.id}
                  batch={batch}
                  stages={stages}
                  measurements={measurements.filter(m => m.groupId === group.id)}
                  records={recordsByBatch.get(batch.id) || []}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── LEVEL 3: Batch ────────────────────────────────────────────────────────
const BatchNode = ({ batch, stages, measurements, records = [] }) => {
  const [expanded, setExpanded] = useState(true);

  // Nhóm các records theo measurement definition
  const recordsByDef = useMemo(() => {
    const m = new Map();
    records.forEach(r => {
      if (!m.has(r.measurementDefinitionId)) m.set(r.measurementDefinitionId, []);
      m.get(r.measurementDefinitionId).push(r);
    });
    return m;
  }, [records]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-xs shrink-0">
            📦
          </div>
          <div className="text-left min-w-0">
            <p className="font-bold text-slate-900 text-xs font-mono">{batch.batchCode || batch.name || 'Lô'}</p>
            <p className="text-[10px] text-slate-500">
              {batch.plantCount || 0} cây
              {batch.plantingDate && ` · Trồng ${new Date(batch.plantingDate).toLocaleDateString('vi-VN')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-500 font-medium">{records.length} lần đo</span>
          <span className="text-slate-400 text-xs">{expanded ? '▾' : '▸'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {measurements.length === 0 ? (
            <Empty msg="Chưa định nghĩa chỉ số nào cho nhóm này" />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {measurements.map(def => {
                const defRecords = recordsByDef.get(def.id) || [];
                const numericValues = defRecords.map(r => Number(r.value)).filter(v => !Number.isNaN(v));
                const latest = defRecords[defRecords.length - 1];
                const mean = numericValues.length > 0
                  ? numericValues.reduce((s, v) => s + v, 0) / numericValues.length
                  : null;
                const target = def.targetValue !== null && def.targetValue !== undefined && def.targetValue !== ''
                  ? Number(def.targetValue) : null;
                const meetsTarget = mean !== null && target !== null && !Number.isNaN(target)
                  ? mean >= target
                  : null;

                return (
                  <div key={def.id}
                    className={`p-3 rounded-xl border ${
                      meetsTarget === true ? 'bg-emerald-50/40 border-emerald-200' :
                      meetsTarget === false ? 'bg-amber-50/40 border-amber-200' :
                      'bg-slate-50 border-slate-200'
                    }`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{def.metricName}</p>
                        {target !== null && !Number.isNaN(target) && (
                          <p className="text-[10px] text-slate-500">Mục tiêu: <span className="font-bold">{target}{def.unit}</span></p>
                        )}
                      </div>
                      {meetsTarget === true && <span className="text-emerald-500 text-base">✅</span>}
                      {meetsTarget === false && <span className="text-amber-500 text-base">⚠️</span>}
                    </div>

                    {defRecords.length > 0 ? (
                      <>
                        {/* Latest + mean summary */}
                        <div className="flex items-baseline gap-2 mb-2">
                          {latest && (
                            <>
                              <span className="text-[10px] text-slate-500 font-bold uppercase">Mới nhất:</span>
                              <span className="text-xl font-bold text-slate-900">{Number(latest.value).toFixed(2)}</span>
                              {def.unit && <span className="text-[10px] text-slate-500">{def.unit}</span>}
                            </>
                          )}
                        </div>
                        {numericValues.length > 1 && (
                          <p className="text-[10px] text-slate-500 mb-2">
                            Trung bình: <span className="font-bold text-slate-700">{mean.toFixed(2)}{def.unit}</span>
                            {' · '}{numericValues.length} lần đo
                          </p>
                        )}

                        {/* Mini sparkline */}
                        {numericValues.length > 1 && (
                          <Sparkline values={numericValues} target={target} unit={def.unit} />
                        )}

                        {/* History */}
                        {defRecords.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-[10px] text-indigo-600 font-bold cursor-pointer hover:underline">
                              Xem {defRecords.length} lần đo chi tiết
                            </summary>
                            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                              {defRecords.slice().reverse().map(r => (
                                <div key={r.id} className="flex items-center justify-between text-[10px] py-1 px-2 bg-white rounded border border-slate-100">
                                  <span className="text-slate-500 font-mono">
                                    {r.measuredAt ? new Date(r.measuredAt).toLocaleDateString('vi-VN') : '—'}
                                  </span>
                                  <span className="font-bold text-slate-900">
                                    {Number(r.value).toFixed(2)}{def.unit}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">Chưa có dữ liệu đo</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Sparkline (mini chart cho trend) ────────────────────────────────────────────
const Sparkline = ({ values, target, unit }) => {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values, target ?? Infinity);
  const max = Math.max(...values, target ?? -Infinity);
  const range = max - min || 1;
  const w = 200;
  const h = 40;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} className="text-indigo-500">
      {/* Target line */}
      {target !== null && !Number.isNaN(target) && (
        <line x1="0" y1={h - ((target - min) / range) * h}
          x2={w} y2={h - ((target - min) / range) * h}
          stroke="currentColor" strokeDasharray="2,2" opacity="0.4" strokeWidth="1" />
      )}
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return <circle key={i} cx={x} cy={y} r="2" fill="currentColor" />;
      })}
    </svg>
  );
};

// ── Stage Timeline ───────────────────────────────────────────────────────────
const StageTimeline = ({ stages, measurements, recordsByBatch, batches, tasks, taskReportsByBatch, groups }) => {
  const sorted = useMemo(() => [...stages].sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0)), [stages]);

  // Pre-compute per-stage stats để tránh tính lại trong map
  const stageStatsMap = useMemo(() => {
    const m = new Map();
    sorted.forEach(stage => {
      const stats = buildStageStatsByGroup(stage, measurements, recordsByBatch, batches, tasks, taskReportsByBatch, groups);
      m.set(stage.id, stats);
    });
    return m;
  }, [sorted, measurements, recordsByBatch, batches, tasks, taskReportsByBatch, groups]);

  return (
    <div className="relative pl-6 space-y-3">
      {/* vertical line */}
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-violet-300 via-indigo-300 to-emerald-300" />
      {sorted.map(stage => (
        <StageRow
          key={stage.id}
          stage={stage}
          batches={batches}
          recordsByBatch={recordsByBatch}
          tasks={tasks}
          taskReportsByBatch={taskReportsByBatch}
          perGroupStats={stageStatsMap.get(stage.id) || []}
        />
      ))}
    </div>
  );
};

// ── StageRow (mỗi dòng trong timeline) ───────────────────────────────────────
const StageRow = ({ stage, batches, recordsByBatch, tasks, taskReportsByBatch, perGroupStats }) => {
  const [open, setOpen] = useState(true);

  // Đếm các measurement records có stage này
  const stageRecords = batches.reduce((sum, batch) => {
    const recs = recordsByBatch.get(batch.id) || [];
    return sum + recs.filter(r => r.experimentStageId === stage.id).length;
  }, 0);

  // Stage tasks + reports count
  const stageTasks = tasks.filter(t => t.experimentStageId === stage.id || t.stageId === stage.id);
  const stageReportCount = batches.reduce((sum, batch) => {
    const recs = taskReportsByBatch?.[batch.id] || [];
    return sum + recs.filter(r => stageTasks.length === 0 || stageTasks.some(t => t.id === r.taskId)).length;
  }, 0);

  // Phân loại stage dựa trên stageType / stageName — dùng helper chung
  const planting = isPlantingStage(stage);
  const harvesting = isHarvestStageFn(stage);

  const stageColor =
    stage.status === 'Completed' ? 'bg-emerald-500' :
    stage.status === 'Active' || stage.status === 'InProgress' ? 'bg-amber-500' :
    'bg-slate-400';

  return (
    <div className="relative">
      <div className={`absolute -left-[18px] top-2 w-3 h-3 rounded-full ${stageColor} border-2 border-white shadow`} />
      <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
        <button onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between gap-2 flex-wrap text-left">
          <div>
            <p className="text-xs font-bold text-slate-900">
              <span className="text-slate-400 mr-1.5">#{stage.stageOrder || '?'}</span>
              {stage.stageName || stage.name || 'Giai đoạn'}
              {planting && <span className="ml-1 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">🌱 Gieo / Ươm</span>}
              {harvesting && <span className="ml-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">🌾 Thu hoạch</span>}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Loại: {stage.stageType || '—'} · Trạng thái: {stage.status || '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {stageRecords > 0 && (
              <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full"
                title="Số measurement records thuộc stage này">
                📊 {stageRecords} đo
              </span>
            )}
            {stageReportCount > 0 && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"
                title="Số task reports thuộc stage này (dùng cho Gieo hạt / Thu hoạch)">
                📋 {stageReportCount} báo cáo
              </span>
            )}
            {perGroupStats.length > 0 && (
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                📈 {perGroupStats.length} nhóm
              </span>
            )}
            <span className="text-slate-400 text-xs">{open ? '▾' : '▸'}</span>
          </div>
        </button>

        {/* Per-group stats detail */}
        {open && perGroupStats.length > 0 && (
          <div className="mt-3 space-y-2">
            {perGroupStats.map(g => (
              <div key={g.groupId} className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold text-slate-700">👥 {g.groupName}</span>
                  {g.groupType && (
                    <span className="text-[8px] font-bold uppercase text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {g.groupType}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                  {g.stats.map((s, idx) => (
                    <div key={idx}
                      className={`bg-white rounded-md px-2 py-1.5 border ${
                        s.source === 'taskReport' ? 'border-amber-200' : 'border-slate-200'
                      }`}>
                      <p className="text-[9px] font-bold text-slate-600 truncate">{s.label}</p>
                      <p className="text-sm font-bold text-slate-900">
                        {s.value.toFixed(2)}{s.unit && <span className="text-[9px] text-slate-500 ml-0.5">{s.unit}</span>}
                      </p>
                      <p className="text-[8px] text-slate-400">
                        {s.source === 'taskReport'
                          ? `📋 ${s.count} báo cáo`
                          : (s.target !== null && s.target !== undefined && !Number.isNaN(s.target)
                              ? `Target: ${s.target}${s.unit}`
                              : `${s.count} đo`)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state cho stages đặc biệt không có data */}
        {open && perGroupStats.length === 0 && (planting || harvesting) && (
          <div className="mt-3 px-3 py-2 bg-amber-50/40 border border-dashed border-amber-200 rounded-lg">
            <p className="text-[10px] text-amber-700 italic">
              Chưa có báo cáo task cho giai đoạn {harvesting ? 'Thu hoạch' : 'Gieo hạt / Ươm cây'}.
              {harvesting
                ? ' Số liệu "Số cây thu hoạch" và "Sản lượng" sẽ hiển thị khi có báo cáo.'
                : ' Số liệu "Số cây gieo" và "Tỷ lệ sống" sẽ hiển thị khi có báo cáo.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Measurements Index (flat overview) ─────────────────────────────────────────
const MeasurementsIndex = ({ measurements, groups, recordsByBatch, batchesByGroup, onUpdateMeasurement }) => {
  const grouped = useMemo(() => {
    const m = new Map();
    measurements.forEach(def => {
      const gid = def.groupId || '_global';
      if (!m.has(gid)) m.set(gid, []);
      m.get(gid).push(def);
    });
    return m;
  }, [measurements]);

  // Tính mean per (def × group) dựa trên recordsByBatch.
  // Chỉ lấy records của batches thuộc group tương ứng.
  const meanByDefGroup = useMemo(() => {
    const out = new Map(); // key: `${def.id}|${gid}`
    measurements.forEach(def => {
      const gid = def.groupId || '_global';
      // Lấy tất cả batches thuộc group này
      const groupBatches = (gid === '_global')
        ? Array.from(batchesByGroup?.values?.() || []).flat()
        : (batchesByGroup?.get?.(gid) || []);
      const values = [];
      groupBatches.forEach(b => {
        const recs = recordsByBatch.get(b.id) || [];
        recs.forEach(r => {
          if (r.measurementDefinitionId === def.id) {
            const v = Number(r.value);
            if (!Number.isNaN(v)) values.push(v);
          }
        });
      });
      if (values.length > 0) {
        const mean = values.reduce((s, v) => s + v, 0) / values.length;
        out.set(`${def.id}|${gid}`, { mean, count: values.length });
      }
    });
    return out;
  }, [measurements, recordsByBatch, batchesByGroup]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from(grouped.entries()).map(([gid, defs]) => {
        const grp = groups.find(g => g.id === gid);
        return (
          <div key={gid} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              {grp ? `👥 ${grp.groupName}` : '🌐 Toàn thí nghiệm'}
              {grp?.groupType && (
                <span className="text-[8px] font-bold normal-case text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {grp.groupType}
                </span>
              )}
            </p>
            <div className="space-y-1.5">
              {defs.map(def => (
                <MeasurementRow
                  key={def.id}
                  def={def}
                  stat={meanByDefGroup.get(`${def.id}|${gid}`)}
                  onUpdate={onUpdateMeasurement}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── MeasurementRow (1 chỉ số, có inline edit) ────────────────────────────────
const MeasurementRow = ({ def, stat, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    metricName: def.metricName || '',
    unit: def.unit || '',
    targetValue: def.targetValue ?? ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const target = (def.targetValue !== null && def.targetValue !== undefined && def.targetValue !== '')
    ? Number(def.targetValue) : null;
  const mean = stat?.mean ?? null;
  const count = stat?.count ?? 0;
  const hasTarget = target !== null && !Number.isNaN(target);
  const ratio = hasTarget && mean !== null ? mean / target : null;
  const meetsTarget = ratio !== null ? ratio >= 0.8 : null;

  const startEdit = () => {
    setDraft({
      metricName: def.metricName || '',
      unit: def.unit || '',
      targetValue: def.targetValue ?? ''
    });
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const saveEdit = async () => {
    const name = draft.metricName.trim();
    if (!name) {
      setError('Tên chỉ số không được để trống');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        metricName: name,
        unit: draft.unit.trim() || null,
        targetValue: draft.targetValue === '' ? null : Number(draft.targetValue)
      };
      const ok = await onUpdate?.(def.id, payload);
      if (ok) {
        setEditing(false);
      } else {
        setError('Không thể lưu — thử lại sau');
      }
    } catch (e) {
      setError(e?.message || 'Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-lg border ${
      meetsTarget === true ? 'bg-emerald-50/40 border-emerald-200' :
      meetsTarget === false ? 'bg-amber-50/40 border-amber-200' :
      'bg-white border-slate-100'
    }`}>
      {editing ? (
        <div className="p-2 space-y-1.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-1.5">
              <input
                autoFocus
                value={draft.metricName}
                onChange={e => setDraft(d => ({ ...d, metricName: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                placeholder="Tên chỉ số"
                className="w-full px-2 py-1 text-xs font-bold border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Đơn vị</label>
                  <input
                    value={draft.unit}
                    onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    placeholder="cm, kg, ..."
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Target</label>
                  <input
                    type="number"
                    step="any"
                    value={draft.targetValue}
                    onChange={e => setDraft(d => ({ ...d, targetValue: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    placeholder="0"
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>
          </div>
          {error && (
            <p className="text-[10px] text-rose-600 font-medium">{error}</p>
          )}
          <div className="flex items-center gap-1.5">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="px-2 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : '✓ Lưu'}
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              className="px-2 py-1 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-50"
            >
              ✕ Hủy
            </button>
            <span className="text-[9px] text-slate-400 ml-auto">Enter = lưu · Esc = hủy</span>
          </div>
        </div>
      ) : (
        <div className="p-2 group">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-bold text-slate-900 truncate flex-1">{def.metricName}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {mean !== null ? (
                <p className="text-sm font-bold text-slate-900">
                  {mean.toFixed(2)}{def.unit && <span className="text-[9px] text-slate-500 ml-0.5">{def.unit}</span>}
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 italic">Chưa đo</p>
              )}
              {onUpdate && (
                <button
                  onClick={startEdit}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-indigo-100 rounded text-slate-500 hover:text-indigo-600"
                  title="Chỉnh sửa chỉ số"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[10px] text-slate-500">
              {hasTarget && (
                <>Target: <span className="font-bold text-slate-700">{target}{def.unit}</span></>
              )}
            </p>
            {mean !== null && (
              <p className="text-[10px] text-slate-400">{count} lần đo</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Hierarchy Node (visual connector) ────────────────────────────────────────
const HierarchyNode = ({ level, icon, label, title, subtitle, badgeColor, children }) => {
  const badgeMap = {
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    violet: 'bg-violet-100 text-violet-700 border-violet-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200'
  };
  return (
    <div>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl border ${badgeMap[badgeColor] || badgeMap.indigo} flex items-center justify-center shrink-0 shadow-sm`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Level {level} · {label}</p>
          <h3 className="text-sm font-bold text-slate-900 truncate">{title}</h3>
          {subtitle && <p className="text-[10px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="ml-12 mt-3">{children}</div>
    </div>
  );
};

const Empty = ({ msg }) => (
  <div className="py-3 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
    <p className="text-[11px] text-slate-400 italic">{msg}</p>
  </div>
);

export default ExperimentHierarchyView;