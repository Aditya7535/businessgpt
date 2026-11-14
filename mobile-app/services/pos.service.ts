import apiClient from './api';
import { Product, POSBill, PaymentMethod, BillItem } from '../types';

export interface CreateBillPayload {
  items: Array<{
    product_id: string | number;
    quantity: number;
    unit_price?: number;
  }>;
  customer_id?: string | number;
  customer_name?: string;
  customer_phone?: string;
  payment_method: PaymentMethod;
  discount_amount?: number;
  tax_amount?: number;
  notes?: string;
}

export interface TodayBillsSummary {
  total_revenue: number;
  total_bills: number;
  bills: POSBill[];
}

export const posService = {
  async getProducts(search?: string): Promise<Product[]> {
    const response = await apiClient.get<Product[]>('/api/pos/products', {
      params: { q: search },
    });
    return response.data.map((p: any) => ({
      ...p,
      selling_price: p.unit_price ?? p.selling_price ?? 0,
      unit_price: p.unit_price ?? p.selling_price ?? 0,
      min_stock_alert: p.reorder_point ?? p.min_stock_alert ?? 5,
    }));
  },

  async createBill(payload: CreateBillPayload): Promise<POSBill> {
    const requestPayload = {
      items: payload.items.map((i) => ({
        product_id: typeof i.product_id === 'string' ? parseInt(i.product_id, 10) : i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price || 0,
      })),
      payment_method: payload.payment_method,
      customer_id: payload.customer_id
        ? typeof payload.customer_id === 'string'
          ? parseInt(payload.customer_id, 10)
          : payload.customer_id
        : undefined,
      customer_data: payload.customer_name
        ? { name: payload.customer_name, phone: payload.customer_phone }
        : undefined,
      notes: payload.notes,
    };

    const response = await apiClient.post<any>('/api/pos/bill', requestPayload);
    const data = response.data;
    return {
      id: data.id,
      bill_number: data.bill_number,
      customer_id: payload.customer_id,
      customer_name: payload.customer_name,
      customer_phone: payload.customer_phone,
      items: data.items || payload.items,
      subtotal: data.total_amount - (data.tax_amount || 0),
      discount_amount: 0,
      tax_amount: data.tax_amount || 0,
      total_amount: data.total_amount,
      payment_method: payload.payment_method,
      created_at: data.created_at || new Date().toISOString(),
      notes: payload.notes,
    };
  },

  async getTodayBills(): Promise<TodayBillsSummary> {
    const response = await apiClient.get<any[]>('/api/pos/bills');
    const bills = response.data || [];
    const totalRev = bills.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    return {
      total_revenue: totalRev,
      total_bills: bills.length,
      bills: bills.map((b: any) => ({
        id: b.id,
        bill_number: b.bill_number,
        customer_name: b.customer_name || 'Walk-in Customer',
        customer_phone: b.customer_phone,
        total_amount: b.total_amount,
        subtotal: b.total_amount,
        discount_amount: 0,
        tax_amount: b.tax_amount || 0,
        payment_method: b.payment_method || 'CASH',
        created_at: b.created_at || new Date().toISOString(),
        items: b.items || [],
      })),
    };
  },

  async getBillById(id: string | number): Promise<POSBill> {
    const response = await apiClient.get<any>(`/api/pos/bills/${id}`);
    const b = response.data;
    return {
      id: b.id,
      bill_number: b.bill_number,
      customer_name: b.customer_name || 'Walk-in',
      customer_phone: b.customer_phone,
      total_amount: b.total_amount,
      subtotal: b.total_amount,
      discount_amount: 0,
      tax_amount: b.tax_amount || 0,
      payment_method: b.payment_method || 'CASH',
      created_at: b.created_at || new Date().toISOString(),
      items: b.items || [],
    };
  },
};

export default posService;
