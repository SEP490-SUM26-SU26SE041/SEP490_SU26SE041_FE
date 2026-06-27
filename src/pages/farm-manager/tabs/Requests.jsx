import React, { useEffect, useMemo, useState } from 'react';
import { experimentRequestsApi } from '../../../api/experimentApi';
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
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

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
      const res = await experimentRequestsApi.getInbox(filter || undefined);
      const data = res?.data ?? res ?? [];
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách yêu cầu', 'error');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInbox(); }, [filter]);

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

        <div className="flex flex-wrap gap-2 bg-white border border-outline-variant rounded-xl p-2 shadow-sm">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${filter === f.value ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container'}`}
            >
              {f.label}
            </button>
          ))}
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
              <div className="col-span-1 md:col-span-2">
                <DetailItem label="Kế Hoạch Giám Sát" value={activeRequest.monitoringPlan || '—'} />
              </div>
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
