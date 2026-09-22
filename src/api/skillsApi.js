import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

// ── Skills CRUD ────────────────────────────────────────────────────────────────
// Theo SKILLS_USER_COUNT_API.md §2:
//   GET    /api/skills            — mọi user auth
//   GET    /api/skills/{id}
//   POST   /api/skills            — chỉ Admin
//   PUT    /api/skills/{id}       — chỉ Admin
//   DELETE /api/skills/{id}       — chỉ Admin

export const skillsApi = {
  getAll: () => apiClient.request('/skills').then(u),
  getById: (id) => apiClient.request(`/skills/${id}`).then(u),
  create: (payload) =>
    apiClient.request('/skills', { method: 'POST', body: payload }),
  update: (id, payload) =>
    apiClient.request(`/skills/${id}`, { method: 'PUT', body: payload }),
  remove: (id) =>
    apiClient.request(`/skills/${id}`, { method: 'DELETE' })
};

// ── UserSkills CRUD ────────────────────────────────────────────────────────────
// Theo SKILLS_USER_COUNT_API.md §3:
//   GET    /api/user-skills                                       — mọi auth
//   GET    /api/user-skills/{userId}/{skillId}
//   GET    /api/user-skills/users/{userId}/skills
//   GET    /api/user-skills/skills/{skillId}/users
//   POST   /api/user-skills                                       — chỉ Admin
//   PUT    /api/user-skills/{userId}/{skillId}                    — chỉ Admin
//   DELETE /api/user-skills/{userId}/{skillId}                    — chỉ Admin

export const userSkillsApi = {
  getAll: () => apiClient.request('/user-skills').then(u),
  getByUser: (userId) =>
    apiClient.request(`/user-skills/users/${userId}/skills`).then(u),
  getBySkill: (skillId) =>
    apiClient.request(`/user-skills/skills/${skillId}/users`).then(u),
  getByPair: (userId, skillId) =>
    apiClient.request(`/user-skills/${userId}/${skillId}`).then(u),
  assign: (payload) =>
    apiClient.request('/user-skills', { method: 'POST', body: payload }),
  update: (userId, skillId, payload) =>
    apiClient.request(`/user-skills/${userId}/${skillId}`, { method: 'PUT', body: payload }),
  remove: (userId, skillId) =>
    apiClient.request(`/user-skills/${userId}/${skillId}`, { method: 'DELETE' })
};

// ── Task count theo user (cho researcher phân công) ────────────────────────────
// Theo SKILLS_USER_COUNT_API.md §4:
//   GET /api/tasks/count-by-user?date=YYYY-MM-DD&roles=Technician   — chỉ Technician
//   GET /api/tasks/count-by-user?date=YYYY-MM-DD&roles=Student      — chỉ Student
// Researcher only
//
// ⚠️ Lưu ý: trước đây gọi 1 lần với roles=Student,Technician → BE không trả đúng cho từng role,
// gây ra hiện tượng task đã giao cho Technician ngày 29 không liệt kê được.
// → Tách thành 2 hàm gọi RIÊNG để chắc chắn filter chính xác theo role.

const ROLE_TO_PARAM = {
  Student: 'Student',
  Technician: 'Technician'
};

export const tasksCountApi = {
  // Gọi chung — giữ để tương thích ngược, nhưng KHÔNG khuyến khích dùng khi cần filter 1 role
  countByUser: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.request(`/tasks/count-by-user${qs ? `?${qs}` : ''}`).then(u);
  },

  // 🆕 Gọi riêng cho Student — chính xác hơn so với gộp role
  countByStudents: ({ date } = {}) => {
    const qs = new URLSearchParams();
    qs.append('roles', ROLE_TO_PARAM.Student);
    if (date) qs.append('date', date);
    return apiClient.request(`/tasks/count-by-user?${qs.toString()}`).then(u);
  },

  // 🆕 Gọi riêng cho Technician — chính xác hơn so với gộp role
  countByTechnicians: ({ date } = {}) => {
    const qs = new URLSearchParams();
    qs.append('roles', ROLE_TO_PARAM.Technician);
    if (date) qs.append('date', date);
    return apiClient.request(`/tasks/count-by-user?${qs.toString()}`).then(u);
  },

  // 🆕 Gọi riêng 2 role rồi merge (Promise.allSettled) — fail 1 role không ảnh hưởng role kia
  countByStudentsAndTechnicians: async ({ date } = {}) => {
    const [stu, tech] = await Promise.allSettled([
      apiClient.request(`/tasks/count-by-user?roles=${ROLE_TO_PARAM.Student}${date ? `&date=${date}` : ''}`).then(u),
      apiClient.request(`/tasks/count-by-user?roles=${ROLE_TO_PARAM.Technician}${date ? `&date=${date}` : ''}`).then(u)
    ]);
    const studentUsers = (stu.status === 'fulfilled')
      ? (Array.isArray(stu.value) ? stu.value : (stu.value?.users || []))
      : [];
    const technicianUsers = (tech.status === 'fulfilled')
      ? (Array.isArray(tech.value) ? tech.value : (tech.value?.users || []))
      : [];
    return {
      users: [...studentUsers, ...technicianUsers],
      studentUsers,
      technicianUsers,
      // BE có thể trả top-level totalTasks
      totalTasks:
        (stu.status === 'fulfilled' ? (stu.value?.totalTasks || 0) : 0) +
        (tech.status === 'fulfilled' ? (tech.value?.totalTasks || 0) : 0)
    };
  }
};