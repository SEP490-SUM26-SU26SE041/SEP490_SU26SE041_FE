import { apiClient } from './apiClient';
import { unwrapData as u } from './apiClient';

export const userApi = {
  getUsers: () => apiClient.request('/users').then(u),
  getUserById: (id) => apiClient.request('/users/' + id).then(u),
  getUsersByRole: (role) => apiClient.request('/users?role=' + role).then(u),
  getSkillMatches: (taskId) => apiClient.request('/tasks/' + taskId + '/skill-matches').then(u),
  searchUsers: (query) => apiClient.request('/users/search?q=' + query).then(u),
};

export const stagesApi = {
  getByExperiment: (expId) => apiClient.request('/experiments/' + expId + '/stages').then(u),
  getById: (expId, stageId) => apiClient.request('/experiments/' + expId + '/stages/' + stageId).then(u),
  create: (expId, payload) => apiClient.request('/experiments/' + expId + '/stages', { method: 'POST', body: payload }),
  update: (stageId, payload) => apiClient.request('/experiments/stages/' + stageId, { method: 'PUT', body: payload }),
  remove: (stageId) => apiClient.request('/experiments/stages/' + stageId, { method: 'DELETE' }),
};

export const groupsApi = {
  getByExperiment: (expId) => apiClient.request('/experiments/' + expId + '/groups').then(u),
  create: (expId, payload) => apiClient.request('/experiments/' + expId + '/groups', { method: 'POST', body: payload }),
  update: (groupId, payload) => apiClient.request('/experiments/groups/' + groupId, { method: 'PUT', body: payload }),
  remove: (groupId) => apiClient.request('/experiments/groups/' + groupId, { method: 'DELETE' }),
};

export const designApi = {
  getByExperiment: (expId) => apiClient.request('/experiments/' + expId + '/design').then(u),
  create: (expId, payload) => apiClient.request('/experiments/' + expId + '/design', { method: 'POST', body: payload }),
  update: (expId, payload) => apiClient.request('/experiments/' + expId + '/design', { method: 'PUT', body: payload }),
  remove: (expId) => apiClient.request('/experiments/' + expId + '/design', { method: 'DELETE' }),
};

export const measurementsApi = {
  getByExperiment: (expId) => apiClient.request('/experiments/' + expId + '/measurements').then(u),
  /**
   * Lấy measurement definitions theo groupId.
   * BE không có route riêng — cách đúng là gọi getByExperiment rồi filter client-side.
   * Trả về instance BE, kèm fallback khi không truyền experimentId.
   */
  getByGroup: async (groupId, experimentId) => {
    if (!groupId) return [];
    // Case 1: có sẵn experimentId → lấy all rồi filter
    if (experimentId) {
      try {
        const list = await apiClient.request('/experiments/' + experimentId + '/measurements').then(u);
        return (Array.isArray(list) ? list : []).filter(m => m.groupId === groupId);
      } catch {
        return [];
      }
    }
    // Case 2: chỉ có groupId → fetch group để biết experimentId
    try {
      const group = await apiClient.request('/experiments/groups/' + groupId).then(u).catch(() => null);
      const expId = group?.experimentId || group?.experiment?.id;
      if (!expId) return [];
      const list = await apiClient.request('/experiments/' + expId + '/measurements').then(u);
      return (Array.isArray(list) ? list : []).filter(m => m.groupId === groupId);
    } catch {
      return [];
    }
  },
  create: (expId, payload) => apiClient.request('/experiments/' + expId + '/measurements', { method: 'POST', body: payload }),
  update: (mId, payload) => apiClient.request('/experiments/measurements/' + mId, { method: 'PUT', body: payload }),
  remove: (mId) => apiClient.request('/experiments/measurements/' + mId, { method: 'DELETE' }),
};

export const schedulesApi = {
  getByExperiment: (expId) => apiClient.request('/experiments/' + expId + '/schedules').then(u),
  create: (expId, payload) => apiClient.request('/experiments/' + expId + '/schedules', { method: 'POST', body: payload }),
  update: (sId, payload) => apiClient.request('/experiments/schedules/' + sId, { method: 'PUT', body: payload }),
  remove: (sId) => apiClient.request('/experiments/schedules/' + sId, { method: 'DELETE' }),
};

export const batchesApi = {
  create: (payload) => apiClient.request('/batches', { method: 'POST', body: payload }),
  getByExperiment: (expId) => apiClient.request('/batches/experiments/' + expId).then(u),
  getById: (id) => apiClient.request('/batches/' + id).then(u),
  update: (id, payload) => apiClient.request('/batches/' + id, { method: 'PUT', body: payload }),
  remove: (id) => apiClient.request('/batches/' + id, { method: 'DELETE' }),
};

export const bedAssignmentsApi = {
  getByExperiment: (expId) => apiClient.request('/farms/experiments/' + expId + '/bed-assignments').then(u),
  create: (payload) => apiClient.request('/farms/bed-assignments', { method: 'POST', body: payload }),
  update: (id, payload) => apiClient.request('/farms/bed-assignments/' + id, { method: 'PUT', body: payload }),
  remove: (id) => apiClient.request('/farms/bed-assignments/' + id, { method: 'DELETE' }),
};

export const areasApi = {
  getByFarm: (farmId) => apiClient.request('/farms/farms/' + farmId + '/areas').then(u),
};

export const tasksApi = {
  getByExperiment: (expId) => apiClient.request('/tasks/experiment/' + expId).then(u),
  getById: (id) => apiClient.request('/tasks/' + id).then(u),
  create: (payload) => apiClient.request('/tasks', { method: 'POST', body: payload }),
  update: (id, payload) => apiClient.request('/tasks/' + id, { method: 'PUT', body: payload }),
  remove: (id) => apiClient.request('/tasks/' + id, { method: 'DELETE' }),
  generateByExperiment: (id) => apiClient.request(`/tasks/generate-by-experiment/${id}`, { method: 'POST' }),
  generateByStage: (id) => apiClient.request(`/tasks/generate-by-stage/${id}`, { method: 'POST' }),
  assign: (payload) => apiClient.request('/tasks/assign', { method: 'POST', body: payload }),
  reassign: (payload) => apiClient.request('/tasks/reassign', { method: 'POST', body: payload }),
  getAssignments: (taskId) => apiClient.request(`/tasks/${taskId}/assignments`).then(u),
  // Bulk update status cho tất cả tasks thuộc 1 experiment (chưa Completed).
  // BE: PATCH /api/tasks/bulk-update-by-experiment/{experimentId}
  //   Body: { status: 'Cancelled' | 'Pending' }
  //   Response: { experimentId, experimentStatus, requestedStatus, affectedTasks, updatedAt }
  // Quy tắc (mirror BE):
  //   Experiment=Cancelled  → body Cancelled  ✅   | body Pending ❌ 400
  //   Experiment=Paused     → body Cancelled  ✅   | body Pending ✅
  //   Experiment=Active     → body Cancelled  ❌ 400 | body Pending ✅ (resume)
  //   Experiment=Completed  → cả 2 ❌ 400
  bulkUpdateStatusByExperiment: (experimentId, status) =>
    apiClient.request(`/tasks/bulk-update-by-experiment/${experimentId}`, {
      method: 'PATCH',
      body: { status },
    }).then(u),
  // ⚠️ Wrapper giữ tương thích ngược — nên dùng tasksCountApi.countByStudentsAndTechnicians từ skillsApi.js
  // vì BE đôi khi không tách đúng khi truyền roles=Student,Technician (gây ra task giao cho Technician ngày 29 không liệt kê).
  countByUser: ({ roles, date } = {}) => {
    const params = new URLSearchParams();
    if (roles) params.append('roles', roles);
    if (date) params.append('date', date);
    const qs = params.toString();
    return apiClient.request('/tasks/count-by-user' + (qs ? `?${qs}` : '')).then(u);
  }
};
