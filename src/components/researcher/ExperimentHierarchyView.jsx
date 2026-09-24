import React, { useMemo, useState } from 'react';

/**
 * View phân cấp: Thí nghiệm → Nhóm → Lô → Giai đoạn → Chỉ số đo lường.
 *
 * Mục tiêu UX:
 *  - Hiển thị rõ quan hệ cha-con bằng cách "lồng nhau".
 *  - Cho mỗi batch hiển thị tất cả measurement records của nó.
 *  - Cho mỗi nhóm hiển thị tổng hợp target vs mean (mini).
 *  - Không phải bảng Excel dày cột.
 */
const ExperimentHierarchyView = ({
  experiment,
  groups = [],
  batchesByGroup = new Map(),
  stages = [],
  measurements = [],
  recordsByBatch = new Map(),
  onRenameGroup
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
              <StageTimeline stages={stages} measurements={measurements} recordsByBatch={recordsByBatch} batches={Array.from(batchesByGroup.values()).flat()} />
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
              <MeasurementsIndex measurements={measurements} groups={groups} />
            </HierarchyNode>
          </div>
        )}
      </div>
    </section>
  );
};

// ── LEVEL 2: Group ────────────────────────────────────────────────────────
const GroupNode = ({ group, batches, stages, measurements, recordsByBatch, onRenameGroup }) => {
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
      measurementStats.push({ def, mean, target, ratio: mean / target });
    });
    return measurementStats;
  }, [group, batches, measurements, recordsByBatch]);

  const isUnassigned = group.id === '_unassigned';

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
            <span className="text-[10px] text-slate-500 font-medium">{stats.length} chỉ số</span>
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
          {/* Group stats mini */}
          {stats.length > 0 && (
            <div className="mb-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {stats.map(({ def, mean, target, ratio }) => {
                const pct = Math.round(ratio * 100);
                const color = ratio >= 0.8 ? 'emerald' : ratio >= 0.5 ? 'amber' : 'rose';
                return (
                  <div key={def.id} className="bg-white rounded-xl p-2.5 border border-slate-200">
                    <p className="text-[10px] font-bold text-slate-700 truncate">{def.metricName}</p>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-base font-bold text-slate-900">{mean.toFixed(2)}</span>
                      {def.unit && <span className="text-[9px] text-slate-500">{def.unit}</span>}
                    </div>
                    <div className="mt-1 w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full bg-${color}-500`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">Target: {target}{def.unit} ({pct}%)</p>
                  </div>
                );
              })}
            </div>
          )}

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
const StageTimeline = ({ stages, measurements, recordsByBatch, batches }) => {
  const sorted = useMemo(() => [...stages].sort((a, b) => (a.stageOrder || 0) - (b.stageOrder || 0)), [stages]);

  return (
    <div className="relative pl-6 space-y-3">
      {/* vertical line */}
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-violet-300 via-indigo-300 to-emerald-300" />
      {sorted.map(stage => {
        // Đếm các measurement records có stage này
        const stageRecords = batches.reduce((sum, batch) => {
          const recs = recordsByBatch.get(batch.id) || [];
          return sum + recs.filter(r => r.experimentStageId === stage.id).length;
        }, 0);

        const stageColor =
          stage.status === 'Completed' ? 'bg-emerald-500' :
          stage.status === 'Active' || stage.status === 'InProgress' ? 'bg-amber-500' :
          'bg-slate-400';

        return (
          <div key={stage.id} className="relative">
            <div className={`absolute -left-[18px] top-2 w-3 h-3 rounded-full ${stageColor} border-2 border-white shadow`} />
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    <span className="text-slate-400 mr-1.5">#{stage.stageOrder || '?'}</span>
                    {stage.stageName || stage.name || 'Giai đoạn'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Loại: {stage.stageType || '—'} · Trạng thái: {stage.status || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">
                    📊 {stageRecords} lần đo
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Measurements Index (flat overview) ─────────────────────────────────────────
const MeasurementsIndex = ({ measurements, groups }) => {
  const grouped = useMemo(() => {
    const m = new Map();
    measurements.forEach(def => {
      const gid = def.groupId || '_global';
      if (!m.has(gid)) m.set(gid, []);
      m.get(gid).push(def);
    });
    return m;
  }, [measurements]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from(grouped.entries()).map(([gid, defs]) => {
        const grp = groups.find(g => g.id === gid);
        return (
          <div key={gid} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              {grp ? `👥 ${grp.groupName}` : '🌐 Toàn thí nghiệm'}
            </p>
            <div className="space-y-1.5">
              {defs.map(def => (
                <div key={def.id} className="bg-white rounded-lg p-2 border border-slate-100">
                  <p className="text-xs font-bold text-slate-900 truncate">{def.metricName}</p>
                  <p className="text-[10px] text-slate-500">
                    {def.unit && `Đơn vị: ${def.unit}`}
                    {def.targetValue !== null && def.targetValue !== undefined && def.targetValue !== '' &&
                      ` · Target: ${def.targetValue}${def.unit}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
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