import { API_BASE_URL, API_ORIGIN } from '../config';

export { API_BASE_URL, API_ORIGIN };

const getToken = () => localStorage.getItem('token');

// Format date về ISO string để backend .NET DateOnly parse được
const formatDateForBE = (date) => {
  if (!date) return undefined;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const d = new Date(date);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString().split('T')[0];
};

// Deep format all date fields trong object
const formatDatesDeep = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(formatDatesDeep);
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (Array.isArray(value)) {
      result[key] = value.map(v => typeof v === 'object' ? formatDatesDeep(v) : v);
    } else if (typeof value === 'object') {
      if (value instanceof Date) {
        result[key] = value.toISOString().split('T')[0];
      } else {
        result[key] = formatDatesDeep(value);
      }
    } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      // String date format "2026-06-28" - giữ nguyên
      result[key] = value;
    } else {
      result[key] = value;
    }
  }
  return result;
};

// Custom JSON replacer để format tất cả date fields
const jsonReplacer = (key, value) => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return value;
};

const buildHeaders = (extra = {}) => {
  const token = getToken();
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const handleResponse = async (res, responseType) => {
  if (res.status === 204) return null;

  // Trả về blob thô (cho file download)
  if (responseType === 'blob') {
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const message = text || `Yêu cầu thất bại (${res.status})`;
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }
    return await res.blob();
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message =
      (isJson && (body?.message || body?.title)) ||
      (typeof body === 'string' && body) ||
      `Yêu cầu thất bại (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    error.body = body;
    throw error;
  }
  return body;
};

const request = async (path, { method = 'GET', body, headers = {}, params, responseType } = {}) => {
  let url = `${API_BASE_URL}${path}`;
  if (params && Object.keys(params).length > 0) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    if (query) url += `?${query}`;
  }

  const isFormData = body instanceof FormData;

  const fetchOptions = {
    method,
    headers: isFormData
      ? buildHeaders(headers)
      : buildHeaders(body ? { 'Content-Type': 'application/json', ...headers } : headers)
  };
  if (body !== undefined) {
    if (isFormData) {
      fetchOptions.body = body;
    } else {
      const formattedBody = formatDatesDeep(body);
      fetchOptions.body = JSON.stringify(formattedBody, jsonReplacer);
    }
  }

  try {
    const res = await fetch(url, fetchOptions);
    return await handleResponse(res, responseType);
  } catch (err) {
    if (err.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    throw err;
  }
};

export const apiClient = { request };
export const API_BASE = API_BASE_URL;

export const unwrapData = (payload) => {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data;
  return payload;
};
