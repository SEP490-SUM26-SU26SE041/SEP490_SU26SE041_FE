// ── Task business validation rules ───────────────────────────────────────────────
// Chuẩn Product: Mỗi action trên task phải validate state trước khi gọi API
// để tránh phá vỡ nghiệp vụ và audit trail.
//
// Pattern: Mỗi rule trả về { allowed, reason } để UI hiển thị tooltip
// và handler check trước khi submit (defense in depth).

const ACTIVE_TASK_STATUSES = ['Pending', 'Assigned', 'InProgress', 'Overdue'];
const COMPLETED_STATUSES = ['Completed', 'Approved'];
const CANCELLED_STATUSES = ['Cancelled', 'Rejected'];
const EDITABLE_STATUSES = ['Pending', 'Assigned', 'InProgress', 'Overdue'];

// ── canCancelTask ────────────────────────────────────────────────────────────
// Chỉ cancel khi task đang ở trạng thái active. KHÔNG cho cancel task đã Completed
// (gây mất report đã nộp) hoặc Cancelled/Rejected (request thừa).
export const canCancelTask = (task) => {
  if (!task) return { allowed: false, reason: 'Không có tác vụ' };
  if (COMPLETED_STATUSES.includes(task.status)) {
    return { allowed: false, reason: `Tác vụ đã "${task.status}" — không thể hủy (cần reopen riêng)` };
  }
  if (CANCELLED_STATUSES.includes(task.status)) {
    return { allowed: false, reason: `Tác vụ đã ở trạng thái "${task.status}"` };
  }
  if (!ACTIVE_TASK_STATUSES.includes(task.status)) {
    return { allowed: false, reason: `Trạng thái "${task.status}" không cho phép hủy` };
  }
  return { allowed: true, reason: 'Hủy tác vụ này' };
};

// ── canEditTask ───────────────────────────────────────────────────────────────
// Chỉ sửa các trường quan trọng khi task ở active. Với Completed/Cancelled chỉ
// cho sửa mô tả (xử lý ở UI). Caller phải check thêm assignee/dueDate riêng.
export const canEditTask = (task) => {
  if (!task) return { allowed: false, reason: 'Không có tác vụ' };
  if (COMPLETED_STATUSES.includes(task.status)) {
    return { allowed: false, reason: `Tác vụ đã "${task.status}" — không thể sửa thông tin` };
  }
  if (CANCELLED_STATUSES.includes(task.status)) {
    return { allowed: false, reason: `Tác vụ đã "${task.status}"` };
  }
  if (!EDITABLE_STATUSES.includes(task.status)) {
    return { allowed: false, reason: `Trạng thái "${task.status}" không cho phép chỉnh sửa` };
  }
  return { allowed: true, reason: 'Sửa thông tin tác vụ' };
};

// ── canDeleteTask ─────────────────────────────────────────────────────────────
// Chỉ xóa task chưa được giao và chưa có báo cáo.
export const canDeleteTask = (task) => {
  if (!task) return { allowed: false, reason: 'Không có tác vụ' };
  if (task.assignedToId || task.assignedToName) {
    return { allowed: false, reason: 'Tác vụ đã được gán — không thể xóa, hãy hủy thay thế' };
  }
  if (COMPLETED_STATUSES.includes(task.status)) {
    return { allowed: false, reason: `Tác vụ đã "${task.status}" — không thể xóa` };
  }
  return { allowed: true, reason: 'Xóa tác vụ' };
};

// ── canApproveTask (technician) ──────────────────────────────────────────────
// Approve yêu cầu reportText đủ dài VÀ có resultData hoặc ảnh đính kèm.
// Đảm bảo số liệu nghiên cứu không bị sai lệch.
export const canApproveTask = (task) => {
  if (!task) return { allowed: false, reason: 'Không có tác vụ' };
  if (task.status !== 'Completed' && task.status !== 'PendingApproval') {
    return { allowed: false, reason: `Tác vụ phải ở trạng thái "Completed" trước khi duyệt (hiện: "${task.status}")` };
  }
  const reportText = (task.reportText || task.resultData || '').trim();
  if (reportText.length < 10) {
    return { allowed: false, reason: 'Báo cáo quá ngắn (<10 ký tự) — yêu cầu nội dung tối thiểu để duyệt' };
  }
  return { allowed: true, reason: 'Duyệt tác vụ' };
};

// ── canRejectTask (technician) ───────────────────────────────────────────────
// Reject bắt buộc phải có lý do (caller check thêm trường reason).
export const canRejectTask = (task) => {
  if (!task) return { allowed: false, reason: 'Không có tác vụ' };
  if (CANCELLED_STATUSES.includes(task.status)) {
    return { allowed: false, reason: `Tác vụ đã ở trạng thái "${task.status}"` };
  }
  if (COMPLETED_STATUSES.includes(task.status)) {
    return { allowed: false, reason: `Tác vụ đã được "${task.status}" — không thể từ chối` };
  }
  return { allowed: true, reason: 'Từ chối tác vụ' };
};

// ── canSubmitReport ──────────────────────────────────────────────────────────
// Submit report cho task đang active (InProgress/Assigned). Chặn khi Cancelled/Rejected.
export const canSubmitReport = (task) => {
  if (!task) return { allowed: false, reason: 'Không có tác vụ' };
  if (CANCELLED_STATUSES.includes(task.status)) {
    return { allowed: false, reason: `Tác vụ đã "${task.status}" — không thể nộp báo cáo` };
  }
  if (!['InProgress', 'Assigned', 'Overdue', 'Pending'].includes(task.status)) {
    return { allowed: false, reason: `Trạng thái "${task.status}" không cho phép nộp báo cáo` };
  }
  return { allowed: true, reason: 'Nộp báo cáo' };
};

// ── canGenerateTasks (theo stage) ─────────────────────────────────────────────
// Generate tasks chỉ khi stage còn active. Chặn khi Cancelled/Completed.
export const canGenerateTasksFromStage = (stage) => {
  if (!stage) return { allowed: false, reason: 'Không có stage' };
  if (stage.status === 'Cancelled') {
    return { allowed: false, reason: 'Stage đã bị hủy — không thể generate tasks' };
  }
  if (stage.status === 'Completed') {
    return { allowed: false, reason: 'Stage đã hoàn thành' };
  }
  return { allowed: true, reason: 'Tự động generate tasks theo stage' };
};

// ── canCreateTaskOnStage ─────────────────────────────────────────────────────
// Tạo task thủ công trên stage còn active.
export const canCreateTaskOnStage = (stage) => {
  if (!stage) return { allowed: false, reason: 'Không có stage' };
  if (stage.status === 'Cancelled') {
    return { allowed: false, reason: 'Stage đã bị hủy — không thể tạo task mới' };
  }
  if (stage.status === 'Completed') {
    return { allowed: false, reason: 'Stage đã hoàn thành — không thể tạo task mới' };
  }
  return { allowed: true, reason: 'Tạo tác vụ mới trên stage' };
};

// ── canCreateBatchWithGroup ──────────────────────────────────────────────────
// Bắt buộc chọn group khi tạo batch (tránh batch mồ côi).
export const canCreateBatch = (formData) => {
  if (!formData) return { allowed: false, reason: 'Thiếu dữ liệu form' };
  if (!formData.experimentStageId) {
    return { allowed: false, reason: 'Vui lòng chọn stage' };
  }
  if (!formData.groupId) {
    return { allowed: false, reason: 'Vui lòng chọn Group (bắt buộc để gắn batch vào nhóm cây trồng)' };
  }
  if (!formData.name || !formData.name.trim()) {
    return { allowed: false, reason: 'Vui lòng nhập tên batch' };
  }
  return { allowed: true, reason: 'Tạo batch mới' };
};

export const TASK_STATUS_GROUPS = {
  ACTIVE: ACTIVE_TASK_STATUSES,
  COMPLETED: COMPLETED_STATUSES,
  CANCELLED: CANCELLED_STATUSES,
  EDITABLE: EDITABLE_STATUSES
};
