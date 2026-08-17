import { apiClient, unwrapData } from './apiClient';

const u = unwrapData;

export const systemLogApi = {
  getLogs: (params) =>
    apiClient.request('/SystemLogs', { params }).then(u),
  addMockLog: () =>
    apiClient.request('/SystemLogs/mock', { method: 'POST' })
};
