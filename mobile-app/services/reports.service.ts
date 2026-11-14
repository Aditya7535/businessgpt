import apiClient from './api';

export interface ReportData {
  title: string;
  period: string;
  date_generated: string;
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  top_categories: Array<{ category: string; revenue: number }>;
  top_products: Array<{ name: string; quantity: number; revenue: number }>;
  executive_summary?: string;
}

export const reportsService = {
  async getDailyReport(date?: string): Promise<ReportData> {
    const response = await apiClient.get<ReportData>('/api/reports/daily', {
      params: date ? { date } : undefined,
    });
    return response.data;
  },

  async getMonthlyReport(month?: string): Promise<ReportData> {
    const response = await apiClient.get<ReportData>('/api/reports/monthly', {
      params: month ? { month } : undefined,
    });
    return response.data;
  },

  async generateReport(type: 'daily' | 'monthly' | 'custom'): Promise<{ success: boolean; message: string; report_url?: string }> {
    const response = await apiClient.post('/api/reports/generate', { report_type: type });
    return response.data;
  },
};

export default reportsService;
