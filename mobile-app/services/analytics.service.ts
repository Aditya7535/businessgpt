import apiClient from './api';
import { SalesAnalytics, CategoryBreakdown, TopProduct } from '../types';

export const analyticsService = {
  async getSalesOverview(): Promise<SalesAnalytics> {
    const response = await apiClient.get<SalesAnalytics>('/api/analytics/sales');
    return response.data;
  },

  async getTrends(days = 7): Promise<Array<{ date: string; revenue: number; orders: number }>> {
    const response = await apiClient.get('/api/analytics/trends', { params: { days } });
    return response.data;
  },

  async getCategories(): Promise<CategoryBreakdown[]> {
    const response = await apiClient.get<CategoryBreakdown[]>('/api/analytics/categories');
    return response.data;
  },

  async getTopProducts(limit = 10): Promise<TopProduct[]> {
    const response = await apiClient.get<TopProduct[]>('/api/analytics/top-products', { params: { limit } });
    return response.data;
  },

  async getSalesForecast(days = 7): Promise<any> {
    const response = await apiClient.post('/api/forecast/sales', { days });
    return response.data;
  },
};

export default analyticsService;
