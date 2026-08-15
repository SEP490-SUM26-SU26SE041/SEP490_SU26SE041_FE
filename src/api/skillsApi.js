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
//   GET /api/tasks/count-by-user?date=YYYY-MM-DD&roles=Technician,Student  — Researcher only

export const tasksCountApi = {
  countByUser: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiClient.request(`/tasks/count-by-user${qs ? `?${qs}` : ''}`).then(u);
  }
};