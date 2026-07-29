import React, { useEffect, useMemo, useState } from 'react';
import { experimentRequestsApi } from '../../../api/experimentApi';
import { farmsApi } from '../../../api/managerResourcesApi';
import { useToast } from '../../../context/ToastContext';
import {
  Card,
  SectionTitle,
  Modal,
  PrimaryButton,
  OutlineButton,
  StatusPill,
  EmptyState,
  Textarea
} from '../components/ui';
import { schemas, compose, maxLength } from '../components/validation';
import { useFormValidation } from '../components/useFormValidation';

const STATUS_FILTERS = [
  { value: '', label: 'Tất Cả' },
  { value: 'Pending', label: 'Chờ Duyệt' },
  { value: 'Approved', label: 'Đã Duyệt' },
  { value: 'Rejected', label: 'Từ Chối' },
  { value: 'Cancelled', label: 'Đã Hủy' }
];

const Requests = () => {
  const { showToast } = useToast();
  const [filter, setFilter] = useState('');
  const [filterFarm, setFilterFarm] = useState('');
  const [allRequests, setAllRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [farms, setFarms] = useState([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resourceSummary, setResourceSummary] = useState(null);
  const [reservedBeds, setReservedBeds] = useState([]);
  const [selectedBedIds, setSelectedBedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Review comment: required (>=10 chars) when rejecting; optional but <=500 when approving
  const reviewFormik = useFormValidation(
    { comment: '' },
    {
      comment: compose(maxLength(500, 'Lý do tối đa 500 ký tự'))
    }
  );

  const loadInbox = async () => {
    try {
      setLoading(true);
      const data = await experimentRequestsApi.getInbox();
      setAllRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách yêu cầu', 'error');
      setAllRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFarms = async () => {
    try {
      const data = await farmsApi.getMyFarms();
      setFarms(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Không thể tải danh sách nông trại');
    }
  };

  useEffect(() => { loadInbox(); loadFarms(); }, []);

  // Filter requests by farm and status
  const requests = useMemo(() => {
    return allRequests.filter(r => {
      if (filter && r.status !== filter) return false;
      if (filterFarm && String(r.farmId) !== String(filterFarm)) return false;
      return true;
    });
  }, [allRequests, filter, filterFarm]);

  const openDetail = async (req) => {
    setActiveRequest(req);
    setDetailOpen(true);
    setResourceSummary(null);
    setReservedBeds([]);
    setSelectedBedIds([]);
    reviewFormik.reset({ comment: '' });
    try {
      setDetailLoading(true);
      const [detail, summary, reserved] = await Promise.allSettled([
        experimentRequestsApi.getById(req.id),
        experimentRequestsApi.getResourceSummary(req.id),
        experimentRequestsApi.getReservedBeds(req.id)
      ]);
      if (detail.status === 'fulfilled') setActiveRequest(detail.value);
      if (summary.status === 'fulfilled') setResourceSummary(summary.value);
      if (reserved.status === 'fulfilled') setReservedBeds(Array.isArray(reserved.value) ? reserved.value : []);
    } catch (err) {
      showToast(err.message || 'Không thể tải chi tiết', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setActiveRequest(null);
    reviewFormik.reset({ comment: '' });
  };

  const toggleBed = (id) => {
    setSelectedBedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const submitReview = async (result) => {
    if (!activeRequest) return;

    // Business rule: approving requires at least 1 bed reserved
    if (result === 1 && selectedBedIds.length === 0) {
      showToast('Khi duyệt yêu cầu, cần chọn ít nhất một luống để giữ chỗ.', 'warning');
      return;
    }

    // Business rule: rejecting requires a comment (>=10 chars)
    const comment = (reviewFormik.values.comment || '').trim();
    if (result === 2 && (!comment || comment.length < 10)) {
      reviewFormik.handleBlur('comment');
      showToast('Khi từ chối, vui lòng nhập lý do (tối thiểu 10 ký tự).', 'warning');
      return;
    }
    if (comment.length > 500) {
      reviewFormik.handleBlur('comment');
      showToast('Lý do tối đa 500 ký tự.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        result,
        comment: comment || undefined,
        ...(result === 1 ? { reservedBedIds: selectedBedIds } : {})
      };
      await experimentRequestsApi.review(activeRequest.id, payload);
      showToast(result === 1 ? 'Đã duyệt yêu cầu' : 'Đã từ chối yêu cầu', 'success');
      closeDetail();
      await loadInbox();
    } catch (err) {
      showToast(err.message || 'Lỗi khi gửi đánh giá', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const stats = useMemo(() => {
    const pending = requests.filter(r => r.status === 'Pending').length;
    const approved = requests.filter(r => r.status === 'Approved').length;
    const rejected = requests.filter(r => r.status === 'Rejected').length;
    return { pending, approved, rejected, total: requests.length };
  }, [requests]);

  return (
    <div className="flex flex-col animate-fade-in w-full">
      <div className="px-6 lg:px-12 py-6 lg:py-10 space-y-6 lg:space-y-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <StatPill label="Tổng Cộng" value={stats.total} />
          <StatPill label="Chờ Duyệt" value={stats.pending} color="text-tertiary" />
          <StatPill label="Đã Duyệt" value={stats.approved} color="text-emerald-600" />
          <StatPill label="Từ Chối" value={stats.rejected} color="text-rose-600" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-white border border-outline-variant rounded-xl p-4 shadow-sm">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">Tìm kiếm</label>
            <input
              type="text"
              placeholder="Tên yêu cầu..."
              className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">Trạng Thái</label>
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {STATUS_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant mb-1">Nông Trại</label>
            <select
              value={filterFarm}
              onChange={e => setFilterFarm(e.target.value)}
              className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Tất Cả Nông Trại</option>
              {farms.map(f => <option key={f.id} value={f.id}>{f.farmName}</option>)}
            </select>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low/50 border-b border-outline-variant">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Yêu Cầu</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Nghiên Cứu Viên</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Nông Trại</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Thời Gian Dự Kiến</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Trạng Thái</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {loading ? (
                  <tr><td colSpan="6" className="px-6 py-8 text-center text-sm text-on-surface-variant">Đang tải...</td></tr>
                ) : requests.length === 0 ? (
                  <tr><td colSpan="6"><EmptyState message="Không có yêu cầu nào trong trạng thái này." /></td></tr>
                ) : (
                  requests.map(req => (
                    <tr key={req.id} className="hover:bg-surface-container/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-sm text-on-surface">{req.title}</div>
                        <div className="text-[10px] text-on-surface-variant mt-1 line-clamp-1">{req.cropVarietyName} • {req.procedureTemplateName}</div>
                      </td>
                      <td className="px-6 py-4 text-sm">{req.researcherName}</td>
                      <td className="px-6 py-4 text-sm">{req.farmName}</td>
                      <td className="px-6 py-4 text-xs font-mono text-on-surface-variant">
                        {req.expectedStartDate} → {req.expectedEndDate || '—'}
                      </td>
                      <td className="px-6 py-4"><StatusPill status={req.status} /></td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => openDetail(req)} className="text-primary font-bold text-[10px] uppercase hover:underline p-1">Chi tiết</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal
        open={detailOpen}
        onClose={closeDetail}
        title={activeRequest?.title || 'Chi tiết yêu cầu'}
        width="max-w-4xl"
      >
        {detailLoading && (
          <div className="p-6 text-center text-sm text-on-surface-variant">Đang tải chi tiết...</div>
        )}
        {!detailLoading && activeRequest && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <DetailItem label="Nghiên Cứu Viên" value={activeRequest.researcherName} />
              <DetailItem label="Nông Trại" value={activeRequest.farmName} />
              <DetailItem label="Giống Cây" value={activeRequest.cropVarietyName} />
              <DetailItem label="Quy Trình" value={activeRequest.procedureTemplateName} />
              <DetailItem label="Ngày Bắt Đầu" value={activeRequest.expectedStartDate} />
              <DetailItem label="Ngày Kết Thúc" value={activeRequest.expectedEndDate || '—'} />
              <div className="col-span-1 md:col-span-2">
                <DetailItem label="Mục Tiêu" value={activeRequest.objective} />
              </div>
              <ExecutionPlanViewer plan={activeRequest.monitoringPlan} />
              <div className="col-span-1 md:col-span-2 flex items-center gap-3">
                <span className="text-xs font-bold text-on-surface-variant">Trạng Thái:</span>
                <StatusPill status={activeRequest.status} />
              </div>
            </div>

            {resourceSummary && (
              <div className="border-t border-outline-variant pt-6">
                <h4 className="font-hanken font-bold text-base text-on-surface mb-4 uppercase tracking-wide">Tài Nguyên Nông Trại</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <ResourceStat label="Tổng Luống" value={resourceSummary?.resources?.totalBeds ?? '—'} />
                  <ResourceStat label="Luống Trống" value={resourceSummary?.resources?.availableBeds ?? '—'} color="text-emerald-600" />
                  <ResourceStat label="Đang Dùng" value={resourceSummary?.resources?.inUseBeds ?? '—'} />
                  <ResourceStat label="Bảo Trì" value={resourceSummary?.resources?.maintenanceBeds ?? '—'} />
                </div>
                <div className={`p-3 rounded-lg border text-xs font-bold ${resourceSummary.sufficientBeds ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                  {resourceSummary.message || (resourceSummary.sufficientBeds ? 'Tài nguyên đáp ứng đủ.' : 'Không đủ tài nguyên.')}
                </div>
              </div>
            )}

            {resourceSummary?.availableBeds?.length > 0 && activeRequest.status === 'Pending' && (
              <div className="border-t border-outline-variant pt-6">
                <h4 className="font-hanken font-bold text-base text-on-surface mb-3 uppercase tracking-wide">Chọn luống để giữ chỗ</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
                  {resourceSummary.availableBeds.map(bed => (
                    <label
                      key={bed.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedBedIds.includes(bed.id) ? 'border-primary bg-primary-container/30' : 'border-outline-variant hover:bg-surface-container'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedBedIds.includes(bed.id)}
                        onChange={() => toggleBed(bed.id)}
                        className="w-4 h-4 accent-primary"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-bold text-on-surface">{bed.bedCode}</div>
                        <div className="text-[10px] text-on-surface-variant">{bed.areaName}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {reservedBeds.length > 0 && (
              <div className="border-t border-outline-variant pt-6">
                <h4 className="font-hanken font-bold text-base text-on-surface mb-3 uppercase tracking-wide">Luống đã giữ</h4>
                <div className="flex flex-wrap gap-2">
                  {reservedBeds.map(bed => (
                    <span key={bed.id} className="px-3 py-1.5 rounded-full bg-primary-container text-primary text-xs font-bold">
                      {bed.bedCode} {bed.areaName ? `(${bed.areaName})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {activeRequest.status === 'Pending' && (
              <div className="border-t border-outline-variant pt-6">
                <Textarea
                  label="Ghi Chú / Lý Do Từ Chối"
                  rows={3}
                  value={reviewFormik.values.comment}
                  onChange={e => reviewFormik.handleChange('comment', e.target.value)}
                  onBlur={() => reviewFormik.handleBlur('comment')}
                  error={reviewFormik.showError('comment')}
                  placeholder="Khi duyệt: ghi chú cho nghiên cứu viên. Khi từ chối: nhập lý do (tối thiểu 10 ký tự)."
                  hint={`${(reviewFormik.values.comment || '').length}/500 ký tự`}
                  maxLength={500}
                />
              </div>
            )}

            {Array.isArray(activeRequest.reviews) && activeRequest.reviews.length > 0 && (
              <div className="border-t border-outline-variant pt-6">
                <h4 className="font-hanken font-bold text-base text-on-surface mb-3 uppercase tracking-wide">Lịch sử đánh giá</h4>
                <div className="space-y-3">
                  {activeRequest.reviews.map(r => (
                    <div key={r.id} className="p-3 bg-surface-container/40 rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold">{r.reviewer?.fullName || 'Reviewer'}</span>
                        <StatusPill status={r.result} />
                      </div>
                      {r.comment && <p className="text-xs text-on-surface-variant mb-1">{r.comment}</p>}
                      <p className="text-[10px] text-on-surface-variant font-mono">{r.reviewedAt ? new Date(r.reviewedAt).toLocaleString('vi-VN') : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeRequest.status === 'Pending' && (
              <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
                <OutlineButton
                  onClick={() => submitReview(2)}
                  disabled={submitting}
                  className="!text-rose-600 !border-rose-200 hover:!bg-rose-50"
                >
                  Từ Chối
                </OutlineButton>
                <PrimaryButton onClick={() => submitReview(1)} disabled={submitting}>
                  {submitting ? 'Đang xử lý...' : `Duyệt${selectedBedIds.length ? ` (${selectedBedIds.length} luống)` : ''}`}
                </PrimaryButton>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

const parsePlan = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
};

const PlanMetricCard = ({ icon, label, value, sub, color }) => {
  const colorMap = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    sky: 'bg-sky-50 border-sky-200 text-sky-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-700'
  };
  return (
    <div className={`rounded-xl border p-3 ${colorMap[color] || colorMap.slate}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="font-hanken font-bold text-lg leading-tight">{value}</div>
      {sub && <div className="text-[10px] opacity-70 mt-0.5 font-mono">{sub}</div>}
    </div>
  );
};

const ThresholdRow = ({ icon, label, value, color }) => {
  const colorMap = {
    rose: { dot: 'bg-rose-500', text: 'text-rose-700' },
    sky: { dot: 'bg-sky-500', text: 'text-sky-700' },
    amber: { dot: 'bg-amber-500', text: 'text-amber-700' }
  };
  const c = colorMap[color] || colorMap.slate || { dot: 'bg-slate-400', text: 'text-slate-700' };
  const minVal = value?.min ?? value?.Min;
  const maxVal = value?.max ?? value?.Max;
  const hasRange = minVal !== undefined && maxVal !== undefined && (minVal !== '' && maxVal !== '');
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg">
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full ${c.dot}`} />
        <span className="text-sm font-bold text-slate-800">{label}</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {hasRange ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Min</span>
              <span className="font-mono font-bold text-slate-900">{minVal}</span>
            </div>
            <span className="text-slate-300">→</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Max</span>
              <span className="font-mono font-bold text-slate-900">{maxVal}</span>
            </div>
          </>
        ) : minVal !== undefined && minVal !== '' ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Min</span>
            <span className="font-mono font-bold text-slate-900">{minVal}</span>
          </div>
        ) : maxVal !== undefined && maxVal !== '' ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Max</span>
            <span className="font-mono font-bold text-slate-900">{maxVal}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">Chưa thiết lập</span>
        )}
      </div>
    </div>
  );
};

const ExecutionPlanViewer = ({ plan }) => {
  const data = parsePlan(plan);
  if (!data) {
    return (
      <div className="col-span-1 md:col-span-2">
        <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50/50">
          <div className="text-3xl mb-1">📋</div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kế Hoạch Thực Hiện</p>
          <p className="text-xs text-slate-400 mt-1">Nghiên cứu viên chưa cung cấp kế hoạch chi tiết.</p>
        </div>
      </div>
    );
  }

  const scaleItems = [
    { key: 'groups', label: 'Số Nhóm', icon: '🔢', color: 'indigo' },
    { key: 'expectedBeds', label: 'Số Luống', icon: '🛏️', color: 'emerald' },
    { key: 'replications', label: 'Lần Lặp', icon: '🔁', color: 'sky' },
    { key: 'expectedPlants', label: 'Cây Dự Kiến', icon: '🌱', color: 'amber' }
  ];
  const thresholdItems = [
    { key: 'temperature', label: 'Nhiệt Độ', icon: '🌡️', color: 'rose' },
    { key: 'humidity', label: 'Độ Ẩm KK', icon: '💧', color: 'sky' },
    { key: 'soilMoisture', label: 'Độ Ẩm Đất', icon: '🪴', color: 'amber' }
  ];

  const filledScale = scaleItems.filter(i => data[i.key] !== undefined && data[i.key] !== null && data[i.key] !== '');
  const monitoring = data.monitoring || data.Monitoring || {};

  return (
    <div className="col-span-1 md:col-span-2">
      <div className="border border-indigo-200 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl">📋</div>
            <div>
              <p className="text-sm font-bold">Kế Hoạch Thực Hiện</p>
              <p className="text-[10px] opacity-80">Quy mô thí nghiệm & ngưỡng giám sát môi trường</p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full">
            Từ Nghiên Cứu Viên
          </span>
        </div>

        {filledScale.length > 0 && (
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">1</div>
              <div>
                <p className="text-xs font-bold text-slate-800">Quy Mô Thí Nghiệm</p>
                <p className="text-[10px] text-slate-500">Số lượng nhóm, luống, lần lặp và cây dự kiến</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {filledScale.map(i => (
                <PlanMetricCard key={i.key} icon={i.icon} label={i.label} value={data[i.key]} color={i.color} sub={i.key} />
              ))}
            </div>
          </div>
        )}

        {thresholdItems.some(i => monitoring[i.key]) && (
          <div className="p-5 bg-slate-50/50">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">2</div>
              <div>
                <p className="text-xs font-bold text-slate-800">Ngưỡng Giám Sát Môi Trường</p>
                <p className="text-[10px] text-slate-500">Khoảng cho phép của các chỉ số môi trường</p>
              </div>
            </div>
            <div className="space-y-2">
              {thresholdItems.filter(i => monitoring[i.key]).map(i => (
                <ThresholdRow key={i.key} icon={i.icon} label={`${i.label} (${i.key === 'temperature' ? '°C' : '%'})`} value={monitoring[i.key]} color={i.color} />
              ))}
            </div>
          </div>
        )}

        {filledScale.length === 0 && !thresholdItems.some(i => monitoring[i.key]) && (
          <div className="p-6 text-center text-xs text-slate-500">
            <p>Kế hoạch được cung cấp nhưng không có dữ liệu hiển thị.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const StatPill = ({ label, value, color = 'text-primary' }) => (
  <div className="bg-white border border-outline-variant p-4 lg:p-6 rounded-xl flex flex-col gap-1 lg:gap-2 shadow-sm">
    <span className="text-[9px] lg:text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</span>
    <span className={`font-hanken text-2xl lg:text-4xl font-bold ${color}`}>{value}</span>
  </div>
);

const DetailItem = ({ label, value }) => (
  <div>
    <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</div>
    <div className="text-sm font-semibold text-on-surface mt-1">{value || '—'}</div>
  </div>
);

const ResourceStat = ({ label, value, color = 'text-on-surface' }) => (
  <div className="bg-surface-container/40 rounded-lg p-3">
    <div className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</div>
    <div className={`font-hanken text-2xl font-bold mt-1 ${color}`}>{value}</div>
  </div>
);

export default Requests;
