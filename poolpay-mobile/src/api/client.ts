import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

export const BASE_URL = API_BASE_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    // Necesario para que ngrok no bloquee las requests desde la app
    'ngrok-skip-browser-warning': 'true',
  },
});

// Interceptor: adjunta X-Piletero-Key automáticamente en cada request
api.interceptors.request.use(async (config) => {
  const key = await SecureStore.getItemAsync('piletero_api_key');
  if (key) {
    config.headers['X-Piletero-Key'] = key;
  }
  return config;
});
