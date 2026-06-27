import React, { useEffect, useMemo, useState } from 'react';
import { experimentsApi } from '../../../api/experimentApi';
import { useToast } from '../../../context/ToastContext';
import {
  Card,
  Modal,
  StatusPill,
  EmptyState,
  OutlineButton
} from '../components/ui';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất Cả Trạng Thái' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Active', label: 'Active' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Cancelled', label: 'Cancelled' }
];

const Experiments = () => {
  const { showToast } = useToast();
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFarm, setFilterFarm] = useState('');
  const [search, setSearch] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [bedAssignments, setBedAssignments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetch = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterFarm) params.farmId = filterFarm;
      const data = await experimentsApi.getAll(params);
      setExperiments(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách thí nghiệm', 'error');
      setExperiments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [filterFarm]);

  const farmOptions = useMemo(() => {
    const map = new Map();
    experiments.forEach(e => {
      if (e.farmId && !map.has(e.farmId)) map.set(e.farmId, e.farmName || e.farmId);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [experiments]);

  const filtered = useMemo(() => {
    return experiments.filter(e => {
      if (filterStatus && e.status !== filterStatus) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (e.title || '').toLowerCase().includes(q) ||
        (e.experimentCode || '').toLowerCase().includes(q) ||
        (e.farmName || '').toLowerCase().includes(q) ||
        (e.researcherName || '').toLowerCase().includes(q) ||
        (e.objective || '').toLowerCase().includes(q)
      );
    });
  }, [experiments, filterStatus, search]);

  const stats = useMemo(() => {
    return {
      total: experiments.length,
      draft: experiments.filter(e => e.status === 'Draft').length,
      active: experiments.filter(e => e.status === 'Active').length,
      completed: experiments.filter(e => e.status === 'Completed').length
    };
  }, [experiments]);

  const openDetail = async (exp) => {
    setActive(exp);
    setDetailOpen(true);
    setBedAssignments([]);
    setSchedules([]);
    try {
      setDetailLoading(true);
      const [ba, sc] = await Promise.allSettled([
        fetch(`/farms/experiments/${exp.id}/bed-assignments`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }).then(r => r.ok ? r.json() : []),
        experimentsApi.getSchedules(exp.id)
      ]);
      if (ba.status === 'fulfilled') setBedAssignments(Array.isArray(ba.value) ? ba.value : []);
      if (sc.status === 'fulfilled') setSchedules(Array.isArray(sc.value) ? sc.value : []);
    } catch (err) {
      showToast(err.message || 'Không thể tải chi tiết thí nghiệm', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="flex flex-col animate-fade-in w-full">
      <div className="px-6 lg:px-12 py-6 lg:py-10 space-y-6 lg:space-y-10">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <StatBox label="Tổng Thí Nghiệm" value={loading ? '…' : stats.total} color="text-primary" />
          <StatBox label="Đang Soạn Thảo" value={loading ? '…' : stats.draft} color="text-on-surface-variant" />
          <StatBox label="Đang Triển Khai" value={loading ? '…' : stats.active} color="text-primary" />
          <StatBox label="Hoàn Thành" value={loading ? '…' : stats.completed} color="text-emerald-600" />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Tìm Kiếm">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                type="text"
                placeholder="Tên, mã, nông trại, mục tiêu..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
              />
            </div>
          </Field>
          <Field label="Trạng Thái">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Nông Trại">
            <select
              value={filterFarm}
              onChange={e => setFilterFarm(e.target.value)}
              className="w-full px-3 py-2.5 border border-outline-variant rounded-xl bg-white text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
            >
              <option value="">Tất Cả Nông Trại</option>
              {farmOptions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
        </div>

        {/* Cards Grid */}
        {loading ? (
          <Card className="p-12 text-center text-on-surface-variant text-sm">Đang tải...</Card>
        ) : filtered.length === 0 ? (
          <Card><EmptyState message="Không tìm thấy thí nghiệm nào phù hợp." /></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
            {filtered.map(exp => <ExperimentCard key={exp.id} exp={exp} onOpen={openDetail} />)}
          </div>
        )}
      </div>

      <ExperimentDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        experiment={active}
        loading={detailLoading}
        bedAssignments={bedAssignments}
        schedules={schedules}
      />
    </div>
  );
};

const StatBox = ({ label, value, color = 'text-primary' }) => (
  <div className="bg-white border border-outline-variant p-4 lg:p-6 rounded-xl flex flex-col gap-1 lg:gap-2 transition-transform hover:-translate-y-1 shadow-sm">
    <span className="text-[9px] lg:text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</span>
    <span className={`font-hanken text-2xl lg:text-4xl font-bold ${color}`}>{value}</span>
  </div>
);

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-bold text-on-surface-variant mb-1">{label}</label>
    {children}
  </div>
);

const ExperimentCard = ({ exp, onOpen }) => {
  const progress = computeProgress(exp);
  return (
    <button
      onClick={() => onOpen(exp)}
      className="group bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left flex flex-col"
    >
      {/* Cover */}
      <div className="relative h-32 bg-gradient-to-br from-primary via-[#5a7a3e] to-[#3d5728] overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, white 0%, transparent 50%), radial-gradient(circle at 80% 30%, white 0%, transparent 40%)'
        }} />
        <div className="absolute top-3 right-3">
          <StatusPill status={exp.status} />
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <div className="text-[9px] font-black text-white/80 uppercase tracking-widest">{exp.experimentCode || 'NO-CODE'}</div>
          <h3 className="font-hanken text-lg font-bold text-white leading-tight line-clamp-1">{exp.title || '—'}</h3>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-3">
        {exp.objective && (
          <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">{exp.objective}</p>
        )}

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <MetaCell icon={<FarmIcon />} label="Nông Trại" value={exp.farmName || '—'} />
          <MetaCell icon={<UserIcon />} label="Nghiên Cứu Viên" value={exp.researcherName || '—'} />
          <MetaCell icon={<CalIcon />} label="Bắt Đầu" value={exp.startDate || '—'} />
          <MetaCell icon={<CalIcon />} label="Kết Thúc" value={exp.endDate || '—'} />
        </div>

        {progress !== null && (
          <div>
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
              <span>Tiến Độ</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : 'bg-primary'}`}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </div>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between border-t border-outline-variant">
          <span className="text-[10px] text-on-surface-variant font-mono">
            Tạo: {exp.createdAt ? new Date(exp.createdAt).toLocaleDateString('vi-VN') : '—'}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary group-hover:translate-x-1 transition-transform">
            Xem chi tiết →
          </span>
        </div>
      </div>
    </button>
  );
};

const MetaCell = ({ icon, label, value }) => (
  <div className="flex items-start gap-1.5 min-w-0">
    <span className="text-on-surface-variant mt-0.5 shrink-0">{icon}</span>
    <div className="min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant leading-none">{label}</div>
      <div className="text-[11px] font-bold text-on-surface truncate">{value}</div>
    </div>
  </div>
);

const FarmIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

const CalIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);

const ExperimentDetailModal = ({ open, onClose, experiment, loading, bedAssignments, schedules }) => {
  if (!open || !experiment) return null;
  const progress = computeProgress(experiment);

  return (
    <Modal open={open} onClose={onClose} title={null} width="max-w-6xl">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-primary via-[#5a7a3e] to-[#3d5728] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-15" style={{
          backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 40%), radial-gradient(circle at 20% 80%, white 0%, transparent 35%)'
        }} />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center transition-colors z-10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div className="relative p-8">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-3xl shrink-0">
              🌱
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-[10px] font-mono font-bold uppercase tracking-wider">
                  {experiment.experimentCode}
                </span>
                <StatusPill status={experiment.status} />
              </div>
              <h2 className="font-hanken text-2xl lg:text-3xl font-bold leading-tight mb-2">{experiment.title}</h2>
              <div className="flex flex-wrap gap-3 text-xs text-white/85">
                <Pill icon={<FarmIcon />} text={experiment.farmName} />
                <Pill icon={<UserIcon />} text={experiment.researcherName} />
                <Pill icon={<CalIcon />} text={`${experiment.startDate || '—'} → ${experiment.endDate || '—'}`} />
              </div>
            </div>
          </div>

          {progress !== null && (
            <div className="mt-6">
              <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-white/85 mb-1.5">
                <span>Tiến Độ Triển Khai</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-white/15 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-emerald-300' : 'bg-white'}`}
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {loading && <div className="p-8 text-center text-sm text-on-surface-variant">Đang tải chi tiết...</div>}

      {!loading && (
        <div className="p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Objectives & Hypothesis */}
          <div className="lg:col-span-2 space-y-6">
            <SectionCard
              title="Mục Tiêu"
              icon={<TargetIcon />}
              accent="emerald"
            >
              <p className="text-sm text-on-surface leading-relaxed whitespace-pre-line">
                {experiment.objective || <span className="text-on-surface-variant italic">Chưa có mô tả.</span>}
              </p>
            </SectionCard>

            <SectionCard
              title="Giả Thuyết"
              icon={<BeakerIcon />}
              accent="amber"
            >
              <p className="text-sm text-on-surface leading-relaxed whitespace-pre-line">
                {experiment.hypothesis || <span className="text-on-surface-variant italic">Chưa có giả thuyết.</span>}
              </p>
            </SectionCard>

            {experiment.stages?.length > 0 && (
              <SectionCard title="Giai Đoạn Thí Nghiệm" icon={<TimelineIcon />} accent="primary">
                <ol className="space-y-3">
                  {experiment.stages.map((stage, i) => (
                    <li key={stage.id || i} className="flex gap-3 p-3 rounded-xl bg-surface-container/40">
                      <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{stage.name || stage.stageName || `Giai đoạn ${i + 1}`}</div>
                        {stage.description && <div className="text-xs text-on-surface-variant mt-1">{stage.description}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              </SectionCard>
            )}

            {experiment.groups?.length > 0 && (
              <SectionCard title="Nhóm Thí Nghiệm" icon={<GroupIcon />} accent="primary">
                <div className="flex flex-wrap gap-2">
                  {experiment.groups.map((g, i) => (
                    <span key={g.id || i} className="px-3 py-2 rounded-xl bg-secondary-container text-on-secondary-container text-xs font-bold">
                      {g.name || g.groupName} {g.plantCount ? `(${g.plantCount} cây)` : ''}
                    </span>
                  ))}
                </div>
              </SectionCard>
            )}

            {experiment.measurementDefinitions?.length > 0 && (
              <SectionCard title="Chỉ Số Đo Lường" icon={<RulerIcon />} accent="primary">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {experiment.measurementDefinitions.map((m, i) => (
                    <div key={m.id || i} className="p-3 rounded-xl bg-surface-container/40 border border-outline-variant">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        {m.name || m.measurementName}
                      </div>
                      {m.unit && <div className="text-sm font-bold text-primary mt-0.5">{m.unit}</div>}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {schedules?.length > 0 && (
              <SectionCard title="Lịch Chăm Sóc" icon={<CalIcon />} accent="primary">
                <ul className="space-y-2">
                  {schedules.map((s, i) => (
                    <li key={s.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container/40">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <div className="flex-1">
                        <div className="text-sm font-bold">{s.activityName || s.name || 'Hoạt động'}</div>
                        <div className="text-[10px] text-on-surface-variant font-mono">
                          {s.scheduledDate || s.date} {s.time ? `· ${s.time}` : ''}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {experiment.design && (
              <SectionCard title="Thiết Kế Thí Nghiệm" icon={<BeakerIcon />} accent="primary">
                <pre className="text-xs bg-surface-container/40 p-3 rounded-xl overflow-x-auto">
                  {typeof experiment.design === 'string'
                    ? experiment.design
                    : JSON.stringify(experiment.design, null, 2)}
                </pre>
              </SectionCard>
            )}
          </div>

          {/* Right column: Metadata & Bed Assignments */}
          <div className="space-y-6">
            <SectionCard title="Thông Tin" icon={<InfoIcon />} accent="primary">
              <dl className="space-y-3 text-xs">
                <MetaRow label="Mã Thí Nghiệm" value={experiment.experimentCode} mono />
                <MetaRow label="Trạng Thái" value={<StatusPill status={experiment.status} />} />
                <MetaRow label="Nông Trại" value={experiment.farmName} />
                <MetaRow label="Nghiên Cứu Viên" value={experiment.researcherName} />
                <MetaRow label="Giống Cây" value={experiment.cropVarietyName || <Empty />} />
                <MetaRow label="Quy Trình" value={experiment.procedureTemplateName || <Empty />} />
                <MetaRow label="Yêu Cầu Gốc" value={experiment.requestId ? <code className="text-[10px]">{experiment.requestId}</code> : '—'} />
                <div className="pt-3 border-t border-outline-variant space-y-3">
                  <MetaRow label="Ngày Tạo" value={experiment.createdAt ? new Date(experiment.createdAt).toLocaleString('vi-VN') : '—'} small />
                  <MetaRow label="Cập Nhật" value={experiment.updatedAt ? new Date(experiment.updatedAt).toLocaleString('vi-VN') : '—'} small />
                </div>
              </dl>
            </SectionCard>

            <SectionCard title="Luống Đã Gán" icon={<FarmIcon />} accent="emerald">
              {bedAssignments.length === 0 ? (
                <div className="text-xs text-on-surface-variant italic py-2">Chưa gán luống nào.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {bedAssignments.map((b, i) => (
                    <span key={b.id || i} className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                      {b.bedCode || b.code} {b.areaName ? `(${b.areaName})` : ''}
                    </span>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      <div className="px-6 lg:px-8 py-4 border-t border-outline-variant bg-surface-container-low/30 flex justify-end">
        <OutlineButton onClick={onClose}>Đóng</OutlineButton>
      </div>
    </Modal>
  );
};

const SectionCard = ({ title, icon, accent = 'primary', children }) => {
  const accentMap = {
    primary: 'text-primary bg-primary/10',
    emerald: 'text-emerald-700 bg-emerald-100',
    amber: 'text-amber-700 bg-amber-100'
  };
  return (
    <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentMap[accent]}`}>{icon}</span>
        <h3 className="font-hanken font-bold text-base text-on-surface">{title}</h3>
      </div>
      {children}
    </div>
  );
};

const MetaRow = ({ label, value, mono = false, small = false }) => (
  <div className="flex justify-between items-start gap-3">
    <dt className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant shrink-0 pt-0.5">{label}</dt>
    <dd className={`text-right ${small ? 'text-[10px] font-mono' : 'text-xs'} ${mono ? 'font-mono font-bold text-primary' : 'text-on-surface'} break-words max-w-[60%]`}>
      {value || '—'}
    </dd>
  </div>
);

const Empty = () => <span className="text-on-surface-variant italic text-xs">chưa có</span>;

const Pill = ({ icon, text }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-medium">
    {icon}{text}
  </span>
);

const TargetIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);

const BeakerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/></svg>
);

const TimelineIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);

const GroupIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);

const RulerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20"/><path d="M6 8v8"/><path d="M10 6v12"/><path d="M14 8v8"/><path d="M18 6v12"/><path d="M22 8v8"/></svg>
);

const InfoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
);

const computeProgress = (exp) => {
  if (!exp?.startDate || !exp?.endDate) return null;
  const start = new Date(exp.startDate).getTime();
  const end = new Date(exp.endDate).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return null;
  const now = Date.now();
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
};

export default Experiments;
