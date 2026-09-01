import React from 'react';

/**
 * Tổng quan ngắn gọn về thí nghiệm — dạng "stat card" + "summary info".
 * Tránh table Excel dày đặc cột.
 */
const ExperimentOverviewSummary = ({
  experiment,
  groups = [],
  batches = [],
  measurements = [],
  measurementRecords = [],
  stages = [],
  decisionSummary = []
}) => {
  const completedStages = stages.filter(s => s.status === 'Completed').length;
  const activeStages = stages.filter(s => s.status === 'Active' || s.status === 'InProgress').length;

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
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-[10px] uppercase tracking-widest text-indigo-200/80 font-bold">Trạng thái</span>
            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold">
              {experiment.status || 'Draft'}
            </span>
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

      {/* Meta info */}
      <div className="px-6 py-4 border-t border-slate-100 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
        <MetaItem label="Mục tiêu" value={experiment.targetOutcome || experiment.objective} />
        <MetaItem label="Bắt đầu" value={experiment.startDate ? new Date(experiment.startDate).toLocaleDateString('vi-VN') : '—'} />
        <MetaItem label="Kết thúc" value={experiment.endDate ? new Date(experiment.endDate).toLocaleDateString('vi-VN') : '—'} />
        <MetaItem label="Thiết kế" value={experiment.designType || experiment.designName || '—'} />
      </div>
    </section>
  );
};

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

export default ExperimentOverviewSummary;