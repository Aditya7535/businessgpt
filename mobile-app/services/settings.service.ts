import apiClient from './api';
import { StoreSettings } from '../types';

export const settingsService = {
  async getSettings(): Promise<StoreSettings> {
    const response = await apiClient.get<StoreSettings>('/api/settings/');
    return response.data;
  },

  async updateSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
    const response = await apiClient.put<StoreSettings>('/api/settings/', settings);
    return response.data;
  },
};

export default settingsService;
