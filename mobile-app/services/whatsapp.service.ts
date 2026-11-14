import apiClient from './api';
import { WhatsAppStatus } from '../types';

export const whatsappService = {
  async getStatus(): Promise<WhatsAppStatus> {
    const response = await apiClient.get<WhatsAppStatus>('/api/whatsapp/status');
    return response.data;
  },

  async sendTestMessage(phone: string, message: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/api/whatsapp/test', { phone, message });
    return response.data;
  },

  async sendBillInvoice(billId: string, phone: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/api/whatsapp/send-bill', { bill_id: billId, phone });
    return response.data;
  },
};

export default whatsappService;
