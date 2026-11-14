import apiClient from './api';
import { BusinessAlert } from '../types';

export const alertsService = {
  async getPendingAlerts(): Promise<BusinessAlert[]> {
    const response = await apiClient.get<BusinessAlert[]>('/api/alerts/pending');
    return response.data;
  },

  async generateAlerts(): Promise<{ success: boolean; generated_count: number }> {
    const response = await apiClient.post('/api/alerts/generate');
    return response.data;
  },

  async dismissAlert(id: string): Promise<void> {
    await apiClient.post(`/api/alerts/${id}/dismiss`);
  },
};

export default alertsService;
