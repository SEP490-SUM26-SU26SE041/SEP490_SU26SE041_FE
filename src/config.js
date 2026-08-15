/// <reference types="vite/client" />

// Inject từ Vercel env. Có thể override URL backend bằng cách đặt VITE_API_BASE_URL
// trong Vercel Project Settings → Environment Variables.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://smartfarm-sep490-api-c3emdvfmdefybacs.eastasia-01.azurewebsites.net/api';
export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 'https://smartfarm-sep490-api-c3emdvfmdefybacs.eastasia-01.azurewebsites.net';
