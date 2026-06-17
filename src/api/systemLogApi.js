const API_URL = 'https://localhost:7048/api';

const getToken = () => localStorage.getItem('token');

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

export const systemLogApi = {
  getLogs: async (params) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_URL}/SystemLogs?${query}`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      const errorBody = await res.text();
      console.error('API Error Response:', errorBody);
      throw new Error('Failed to fetch logs');
    }
    return res.json();
  },
  
  addMockLog: async () => {
    const res = await fetch(`${API_URL}/SystemLogs/mock`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error('Failed to add mock log');
    return res.json();
  }
};
