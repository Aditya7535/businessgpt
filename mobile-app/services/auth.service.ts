import apiClient from './api';
import Storage from '../utils/storage';
import { User, Store, Role } from '../types';

export interface LoginCredentials {
  role?: Role | string;
  user_id?: number;
  pin: string;
}

export interface RegisterPayload {
  name: string;
  role: string;
  pin?: string;
  email?: string;
  password?: string;
  phone?: string;
  store_name?: string;
  store_id?: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
  store?: Store;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const payload = {
      role: credentials.role || 'OWNER',
      pin: credentials.pin,
      ...(credentials.user_id ? { user_id: credentials.user_id } : {}),
    };

    const response = await apiClient.post<AuthResponse>('/api/auth/login', payload);
    if (response.data.access_token) {
      await Storage.setItem('auth_token', response.data.access_token);
      await Storage.setItem('auth_user', JSON.stringify(response.data.user));
      if (response.data.store) {
        await Storage.setItem('auth_store', JSON.stringify(response.data.store));
      }
    }
    return response.data;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/api/auth/register', payload);
    if (response.data.access_token) {
      await Storage.setItem('auth_token', response.data.access_token);
      await Storage.setItem('auth_user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  async getMe(): Promise<{ user: User; store?: Store }> {
    const response = await apiClient.get<{ user: User; store?: Store }>('/api/auth/me');
    return response.data;
  },

  async logout(): Promise<void> {
    await Storage.removeItem('auth_token');
    await Storage.removeItem('auth_user');
    await Storage.removeItem('auth_store');
  },
};

export default authService;
