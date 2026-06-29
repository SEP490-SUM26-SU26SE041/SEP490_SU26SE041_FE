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
  remove: (id) => apiClient.request('/tasks/' + id, { method: 'DELETE' })
};
