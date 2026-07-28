import { apiClient } from './apiClient';
import { unwrapData as u } from './apiClient';

// ========== T24: Real-time Monitoring Dashboard APIs ==========

export const dashboardApi = {
  // Overview - Tổng quan dashboard
  getOverview: (farmId) => apiClient.request('/dashboard/overview', {
    params: farmId ? { farmId } : {}
  }).then(u),

  // Farm health - Sức khỏe nông trại
  getFarmsHealth: () => apiClient.request('/dashboard/farms/health').then(u),
  getFarmHealth: (farmId) => apiClient.request(`/dashboard/farms/${farmId}/health`).then(u),

  // Sensor readings - Dữ liệu cảm biến
  getLatestSensorReadings: (params) => apiClient.request('/dashboard/sensors/latest', {
    params
  }).then(u),
  getSensorHistory: (sensorId, params) => apiClient.request(`/dashboard/sensors/${sensorId}/history`, {
    params
  }).then(u),

  // Alerts - Cảnh báo
  getActiveAlerts: (experimentId) => apiClient.request('/dashboard/alerts', {
    params: experimentId ? { experimentId } : {}
  }).then(u),

  // Experiment statuses - Trạng thái thí nghiệm
  getExperimentStatuses: (farmId) => apiClient.request('/dashboard/experiments/status', {
    params: farmId ? { farmId } : {}
  }).then(u),
};

// ========== T25: KPIs and Personnel Performance APIs ==========

export const kpisApi = {
  // Dashboard KPIs
  getKpis: (params) => apiClient.request('/dashboard/kpis', {
    params
  }).then(u),

  // Personnel performance
  getPersonnelPerformance: (params) => apiClient.request('/dashboard/personnel/performance', {
    params
  }).then(u),
  getPersonnelPerformanceById: (userId) => apiClient.request(`/dashboard/personnel/${userId}/performance`).then(u),

  // Experiment progress
  getExperimentProgress: (farmId) => apiClient.request('/dashboard/experiments/progress', {
    params: farmId ? { farmId } : {}
  }).then(u),
  getExperimentProgressById: (experimentId) => apiClient.request(`/dashboard/experiments/${experimentId}/progress`).then(u),
};

// ========== T26: Cultivation Method Comparison APIs ==========

export const comparisonApi = {
  // Get comparison for specific experiment
  // Returns null if not found or API error (so UI can fall back to local computation)
  getComparison: async (experimentId) => {
    try {
      const url = `${API_BASE_URL}/dashboard/experiments/${experimentId}/comparison`;
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const response = await fetch(url, { headers });
      
      if (response.status === 404) {
        console.log('Comparison API: No comparison data found (404)');
        return null;
      }
      
      if (!response.ok) {
        const error = await response.text();
        console.log('Comparison API error:', response.status, error);
        return null;
      }
      
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        return u(data);
      }
      return null;
    } catch (error) {
      console.log('Comparison API fetch error:', error);
      return null;
    }
  },

  // Get all comparisons for a farm
  getAllComparisons: (farmId) => apiClient.request('/dashboard/comparisons', {
    params: farmId ? { farmId } : {}
  }).then(u),
};

// ========== T27: Report Export APIs ==========

export const reportExportApi = {
  // Generate new report
  generateReport: (experimentId, payload) => apiClient.request(`/dashboard/experiments/${experimentId}/reports`, {
    method: 'POST',
    body: payload
  }),

  // Get all reports for an experiment
  getExperimentReports: (experimentId) => apiClient.request(`/dashboard/experiments/${experimentId}/reports`).then(u),

  // Get specific report
  getReport: (reportId) => apiClient.request(`/dashboard/reports/${reportId}`).then(u),

  // Delete report
  deleteReport: (reportId) => apiClient.request(`/dashboard/reports/${reportId}`, {
    method: 'DELETE'
  }),
};
