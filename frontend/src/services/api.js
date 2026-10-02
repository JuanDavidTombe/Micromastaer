import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('micromaster_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('micromaster_token');
      localStorage.removeItem('micromaster_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  // Alta pública: guarda al solicitante con status = PENDING y NO devuelve token.
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

export const dashboard = {
  getKpis: () => api.get('/dashboard'),
};

export const cost = {
  getRecipes: () => api.get('/cost/recipes'),
  getStockCheck: (recipeId) => api.get(`/cost/recipes/${recipeId}/stock-check`),
  createRecipe: (data) => api.post('/cost/recipes', data),
  updateRecipe: (id, data) => api.patch(`/cost/recipes/${id}`, data),
  deleteRecipe: (id) => api.delete(`/cost/recipes/${id}`),
  simulateScale: (data) => api.post('/cost/simulate-scale', data),
  getIngredients: () => api.get('/cost/ingredients'),
};

export const stock = {
  getBatches: (params) => api.get('/stock/batches', { params }),
  createBatch: (data) => api.post('/stock/batches', data),
  getAlerts: () => api.get('/stock/alerts'),
  getIngredientStock: () => api.get('/stock/ingredients'),
  createEntry: (data) => api.post('/stock/entry', data),
  createExit: (data) => api.post('/stock/exit', data),
  // Escaneo QR de la app movil -> sincroniza con la base web
  qrScan: (data) => api.post('/stock/qr-scan', data),
};

export const reports = {
  get: () => api.get('/reports'),
  costs: () => api.get('/reports/costs'),
  stock: () => api.get('/reports/stock'),
  orders: () => api.get('/reports/orders'),
  // Descarga CSV real (blob)
  download: (type) => api.get('/reports/download', { params: { type }, responseType: 'blob' }),
};

export const delivery = {
  // Rutas (Google Maps)
  getRoutes: (params) => api.get('/delivery/routes', { params }),
  getRouteDetail: (id) => api.get(`/delivery/routes/${id}`),
  createRoute: (data) => api.post('/delivery/routes', data),
  updateRoute: (id, data) => api.patch(`/delivery/routes/${id}`, data),

  // Conductores
  getDrivers: () => api.get('/delivery/drivers'),

  // Pedidos y cobro OTP
  getOrders: (params) => api.get('/delivery/orders', { params }),
  verifyOtp: (code) => api.post('/delivery/verify-otp', { otp_code: code }),
  updatePayment: (data) => api.patch('/delivery/update-payment', data),
  completePayment: (data) => api.post('/delivery/complete-payment', data),

  // GPS del conductor (app movil -> API web)
  sendLocation: (data) => api.post('/delivery/location', data),

  // Novedades de campo
  getIncidents: (params) => api.get('/delivery/incidents', { params }),
  createIncident: (data) => api.post('/delivery/incidents', data),
  updateIncident: (id, data) => api.patch(`/delivery/incidents/${id}`, data),
};

export const orders = {
  list: (params) => api.get('/orders', { params }),
  create: (data) => api.post('/orders', data),
  get: (id) => api.get(`/orders/${id}`),
  update: (id, data) => api.patch(`/orders/${id}`, data),
  remove: (id) => api.delete(`/orders/${id}`),
};

export const profile = {
  // Pestaña 1: información personal y contacto
  get: () => api.get('/profile'),
  update: (data) => api.patch('/profile', data),
  uploadPhoto: (file) => {
    const form = new FormData();
    form.append('photo', file);
    return api.post('/profile/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getPhoto: () => api.get('/profile/photo', { responseType: 'blob' }),
  deletePhoto: () => api.delete('/profile/photo'),

  // Pestaña 3: seguridad y accesos
  changePassword: (data) => api.patch('/profile/password', data),
  revokeSessions: () => api.delete('/profile/sessions'),

  // Pestaña 4: preferencias de la aplicación (incluye el interruptor 2FA)
  updatePreferences: (data) => api.patch('/profile/preferences', data),
};

export const admin = {
  // GESTIÓN DE USUARIOS & ROLES
  getUsers: () => api.get('/settings/users'),
  createUser: (data) => api.post('/settings/users', data),
  updateUser: (id, data) => api.patch(`/settings/users/${id}`, data),
  toggleUserStatus: (id) => api.patch(`/settings/users/${id}/status`),

  // SOLICITUDES DE REGISTRO PENDIENTES (flujo /register)
  getPendingUsers: () => api.get('/admin/pending-users'),
  approveUser: (id, data) => api.post(`/admin/users/${id}/approve`, data || {}),
  rejectUser: (id, data) => api.post(`/admin/users/${id}/reject`, data || {}),

  // CONFIGURACIÓN DEL SISTEMA (perfil B2B)
  getCompany: () => api.get('/settings/company'),
  updateCompany: (data) => api.patch('/settings/company', data),
};

export default api;
