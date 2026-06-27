const API_BASE_URL = 'https://localhost:7048/api';

const getToken = () => localStorage.getItem('token');

const buildHeaders = (extra = {}) => {
  const token = getToken();
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const handleResponse = async (res) => {
  if (res.status === 204) return null;
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

const request = async (path, { method = 'GET', body, headers = {}, params } = {}) => {
  let url = `${API_BASE_URL}${path}`;
  if (params && Object.keys(params).length > 0) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    if (query) url += `?${query}`;
  }

  const fetchOptions = {
    method,
    headers: buildHeaders(body ? { 'Content-Type': 'application/json', ...headers } : headers)
  };
  if (body !== undefined) fetchOptions.body = JSON.stringify(body);

  try {
    const res = await fetch(url, fetchOptions);
    return await handleResponse(res);
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
