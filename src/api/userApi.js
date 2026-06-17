const API_URL = 'https://localhost:7048/api';

const getToken = () => localStorage.getItem('token');

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

export const userApi = {
  getUsers: async () => {
    const res = await fetch(`${API_URL}/Users`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  getRoles: async () => {
    const res = await fetch(`${API_URL}/Roles`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!res.ok) throw new Error('Failed to fetch roles');
    return res.json();
  },

  createUser: async (userData) => {
    const res = await fetch(`${API_URL}/Users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create user');
    }
    return res.json();
  },

  updateUser: async (id, userData) => {
    const res = await fetch(`${API_URL}/Users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(userData)
    });
    if (!res.ok) throw new Error('Failed to update user');
    return true;
  },

  toggleStatus: async (id) => {
    const res = await fetch(`${API_URL}/Users/${id}/toggle-status`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!res.ok) throw new Error('Failed to toggle status');
    return true;
  },

  deleteUser: async (id) => {
    const res = await fetch(`${API_URL}/Users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!res.ok) throw new Error('Failed to delete user');
    return true;
  }
};
