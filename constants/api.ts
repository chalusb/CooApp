const sanitizeBaseUrl = (url?: string | null) => {
  if (!url) return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

const normalizePath = (path?: string | null) => {
  if (!path) return '';
  const trimmed = path.trim();
  if (!trimmed || trimmed === '/') return '';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
};

// Toggle between local and prod by setting EXPO_PUBLIC_API_USE_LOCAL=true in .env.
const resolveBaseUrl = () => {
  //const fallback = sanitizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
  const prod = sanitizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL_PROD);
  const local = sanitizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL_LOCAL);
  const useLocal = (process.env.EXPO_PUBLIC_API_USE_LOCAL || '').toLowerCase() === 'true';
  if (useLocal && local) return local;
  return prod || local;
};

const BASE_URL = resolveBaseUrl();
const DEFAULT_BASE_PATH = '/AppP';
const envBasePath = process.env.EXPO_PUBLIC_API_BASE_PATH;
const BASE_PATH = envBasePath === undefined ? DEFAULT_BASE_PATH : normalizePath(envBasePath);

const ensureApiRoot = (baseUrl: string, basePath: string) => {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  if (!basePath) return normalizedBase;
  if (!normalizedBase) return basePath;
  if (normalizedBase.endsWith(basePath)) {
    return normalizedBase;
  }
  return `${normalizedBase}${basePath}`;
};

const API_ROOT = ensureApiRoot(BASE_URL, BASE_PATH);

const ENDPOINTS = {
  CATEGORIES: 'categories',
  SUPERMARKET: 'supermarket',
  CALENDAR: 'calendar',
  NOTES: 'notes',
  NOTIFICATIONS: 'notifications',
};

export const API_CONFIG = {
  BASE_URL,
  ENDPOINTS,
  BASE_PATH,
  API_ROOT,
};

export const apiRoutes = {
  categories: (query: string = '') => `${API_ROOT}/${ENDPOINTS.CATEGORIES}${query}`,
  categoriesReorder: () => `${API_ROOT}/${ENDPOINTS.CATEGORIES}/reorder`,
  category: (categoryId: string) => `${API_ROOT}/${ENDPOINTS.CATEGORIES}/${categoryId}`,
  categoryTasks: (categoryId: string) => `${API_ROOT}/${ENDPOINTS.CATEGORIES}/${categoryId}/tasks`,
  categoryTask: (categoryId: string, taskId: string) => `${API_ROOT}/${ENDPOINTS.CATEGORIES}/${categoryId}/tasks/${taskId}`,
  categoryTasksReorder: (categoryId: string) => `${API_ROOT}/${ENDPOINTS.CATEGORIES}/${categoryId}/tasks/reorder`,
  supermarket: (query: string = '') => `${API_ROOT}/${ENDPOINTS.SUPERMARKET}${query}`,
  supermarketItem: (itemId: string) => `${API_ROOT}/${ENDPOINTS.SUPERMARKET}/${itemId}`,
  calendar: (query: string = '') => `${API_ROOT}/${ENDPOINTS.CALENDAR}${query}`,
  calendarEvent: (eventId: string) => `${API_ROOT}/${ENDPOINTS.CALENDAR}/${eventId}`,
  notes: (query: string = '') => `${API_ROOT}/${ENDPOINTS.NOTES}${query}`,
  note: (noteId: string) => `${API_ROOT}/${ENDPOINTS.NOTES}/${noteId}`,
  notificationsRegister: () => `${API_ROOT}/${ENDPOINTS.NOTIFICATIONS}/register`,
  notificationsBroadcast: () => `${API_ROOT}/${ENDPOINTS.NOTIFICATIONS}/broadcast`,
};

