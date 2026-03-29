import { Capacitor } from '@capacitor/core';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
const API_BASE_URL_STORAGE_KEY = 'api_base_url';

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '';
const envApiBaseUrl = rawApiBaseUrl ? trimTrailingSlash(rawApiBaseUrl) : '';

export const isNativeRuntime = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return Capacitor.isNativePlatform() || window.location.origin === 'https://localhost' || window.location.protocol === 'capacitor:';
};

export const getStoredApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  const storedValue = window.localStorage.getItem(API_BASE_URL_STORAGE_KEY)?.trim() || '';
  return storedValue ? trimTrailingSlash(storedValue) : '';
};

export const getApiBaseUrl = () => getStoredApiBaseUrl() || envApiBaseUrl;

export const setApiBaseUrl = (value: string) => {
  if (typeof window === 'undefined') {
    return '';
  }

  const normalizedValue = value.trim() ? trimTrailingSlash(value.trim()) : '';

  if (normalizedValue) {
    window.localStorage.setItem(API_BASE_URL_STORAGE_KEY, normalizedValue);
  } else {
    window.localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
  }

  return normalizedValue;
};

export const API_BASE_CONFIGURATION_MESSAGE = 'Integrações Google indisponíveis neste APK. Configure a URL do backend HTTPS em Configurações > Integrações.';

export const buildApiUrl = (path: string) => {
  if (!path.startsWith('/')) {
    throw new Error(`API path inválido: ${path}`);
  }

  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl && isNativeRuntime()) {
    throw new Error(API_BASE_CONFIGURATION_MESSAGE);
  }

  return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
};
