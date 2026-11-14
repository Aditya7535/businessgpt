import apiClient from './api';
import { Customer, CustomerSettings } from '../types';

export const customerService = {
  async getCustomers(search?: string): Promise<Customer[]> {
    const response = await apiClient.get<Customer[]>('/api/customers', {
      params: search ? { search } : undefined,
    });
    return response.data;
  },

  async getCustomer(id: string): Promise<Customer> {
    const response = await apiClient.get<Customer>(`/api/customers/${id}`);
    return response.data;
  },

  async createCustomer(payload: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
  }): Promise<Customer> {
    const response = await apiClient.post<Customer>('/api/customers', payload);
    return response.data;
  },

  async updateCustomer(id: string, payload: Partial<Customer>): Promise<Customer> {
    const response = await apiClient.put<Customer>(`/api/customers/${id}`, payload);
    return response.data;
  },

  async getSettings(): Promise<CustomerSettings> {
    const response = await apiClient.get<CustomerSettings>('/api/customers/settings');
    return response.data;
  },
};

export default customerService;
