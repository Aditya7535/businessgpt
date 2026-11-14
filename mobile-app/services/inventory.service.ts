import apiClient from './api';
import { Product, InventorySummary, StockMovement, ConversationalProposal } from '../types';

export const inventoryService = {
  async getSummary(): Promise<InventorySummary> {
    const response = await apiClient.get<InventorySummary>('/api/inventory/summary');
    return response.data;
  },

  async getProducts(params?: { category?: string; search?: string; low_stock?: boolean }): Promise<Product[]> {
    const response = await apiClient.get<Product[]>('/api/inventory/products', {
      params: {
        category: params?.category,
        status_filter: params?.low_stock ? 'LOW' : undefined,
      },
    });
    // Ensure unit_price and selling_price are synchronized
    return response.data.map((p: any) => ({
      ...p,
      selling_price: p.unit_price ?? p.selling_price ?? 0,
      unit_price: p.unit_price ?? p.selling_price ?? 0,
      min_stock_alert: p.reorder_point ?? p.min_stock_alert ?? 5,
    }));
  },

  async getProduct(id: string | number): Promise<Product> {
    const response = await apiClient.get<Product>(`/api/inventory/product/${id}`);
    const p = response.data;
    return {
      ...p,
      selling_price: p.unit_price ?? p.selling_price ?? 0,
      unit_price: p.unit_price ?? p.selling_price ?? 0,
      min_stock_alert: p.reorder_point ?? p.min_stock_alert ?? 5,
    };
  },

  async createProduct(product: Partial<Product>): Promise<Product> {
    const payload = {
      name: product.name,
      sku: product.sku || `SKU-${Date.now().toString().slice(-6)}`,
      category: product.category || 'General',
      unit_price: product.unit_price ?? product.selling_price ?? 0,
      current_stock: product.current_stock ?? 0,
      reorder_point: product.reorder_point ?? product.min_stock_alert ?? 10,
      unit: product.unit || 'pcs',
    };
    const response = await apiClient.post<Product>('/api/inventory/product', payload);
    return response.data;
  },

  async updateProduct(id: string | number, product: Partial<Product>): Promise<Product> {
    const payload: any = {};
    if (product.name !== undefined) payload.name = product.name;
    if (product.sku !== undefined) payload.sku = product.sku;
    if (product.category !== undefined) payload.category = product.category;
    if (product.unit_price !== undefined || product.selling_price !== undefined) {
      payload.unit_price = product.unit_price ?? product.selling_price;
    }
    if (product.reorder_point !== undefined || product.min_stock_alert !== undefined) {
      payload.reorder_point = product.reorder_point ?? product.min_stock_alert;
    }
    if (product.unit !== undefined) payload.unit = product.unit;

    const response = await apiClient.put<Product>(`/api/inventory/product/${id}`, payload);
    return response.data;
  },

  async deleteProduct(id: string | number): Promise<{ message: string; product_id: number }> {
    const response = await apiClient.delete(`/api/inventory/product/${id}`);
    return response.data;
  },

  async adjustStock(payload: {
    product_id: string | number;
    quantity: number;
    movement_type: 'IN' | 'OUT' | 'ADJUSTMENT';
    notes?: string;
  }): Promise<{ message: string }> {
    const response = await apiClient.post('/api/inventory/add-stock', {
      product_id: typeof payload.product_id === 'string' ? parseInt(payload.product_id, 10) : payload.product_id,
      quantity: payload.quantity,
      notes: payload.notes || `${payload.movement_type} stock adjustment from mobile`,
    });
    return response.data;
  },

  async getMovements(limit = 20): Promise<StockMovement[]> {
    const response = await apiClient.get<StockMovement[]>('/api/inventory/transactions', {
      params: { limit },
    });
    return response.data;
  },

  // Conversational Voice Stock Adjustment
  async proposeConversationalAdjustment(text: string): Promise<ConversationalProposal> {
    const response = await apiClient.post<ConversationalProposal>(
      '/api/inventory/natural-adjust',
      { message: text, command: text }
    );
    return response.data;
  },

  async confirmConversationalAdjustment(proposal: ConversationalProposal): Promise<any> {
    const response = await apiClient.post(
      '/api/inventory/natural-adjust/confirm',
      {
        pending_id: (proposal as any).pending_id || (proposal as any).id,
        session_id: (proposal as any).session_id,
      }
    );
    return response.data;
  },
};

export default inventoryService;
