export type Role = 'OWNER' | 'MANAGER' | 'EMPLOYEE';

export interface User {
  id: string | number;
  email?: string;
  name: string;
  role: Role;
  phone?: string;
  store_id?: string | number;
}

export interface Store {
  id: string | number;
  name: string;
  owner_name?: string;
  category?: string;
  address?: string;
  phone?: string;
  gstin?: string;
  currency: string;
  language: string;
}

export interface StoreSettings {
  store_id: string | number;
  store_name: string;
  currency: string;
  low_stock_threshold: number;
  enable_voice: boolean;
  enable_whatsapp: boolean;
  pos_require_customer: boolean;
}

export interface Product {
  id: string | number;
  name: string;
  sku?: string;
  category: string;
  unit_price: number;
  selling_price?: number;
  cost_price?: number;
  current_stock: number;
  reorder_point?: number;
  min_stock_alert?: number;
  unit: string;
  barcode?: string;
  status?: string;
  total_value?: number;
  is_active?: boolean;
}

export interface InventorySummary {
  total_products: number;
  total_stock_units: number;
  total_valuation: number;
  low_stock_count: number;
  out_of_stock_count: number;
  healthy_count: number;
}

export interface StockMovement {
  id: string | number;
  product_id: string | number;
  product_name?: string;
  movement_type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'SALE' | 'RETURN';
  quantity: number;
  unit_price?: number;
  reference?: string;
  notes?: string;
  created_at: string;
  created_by?: string;
}

export interface ConversationalProposal {
  operation: 'ADD' | 'REMOVE' | 'SET';
  product_id: string | number;
  product_name: string;
  quantity: number;
  unit: string;
  confidence: number;
  current_stock: number;
  projected_stock: number;
  needs_clarification: boolean;
  clarification_message?: string;
  pending_id?: number | string;
  session_id?: string;
}

export interface BillItem {
  product_id: string | number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit?: string;
}

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'CREDIT';

export interface POSBill {
  id: string | number;
  bill_number: string;
  customer_id?: string | number;
  customer_name?: string;
  customer_phone?: string;
  items: BillItem[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  created_at: string;
  notes?: string;
}

export interface Customer {
  id: string | number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  total_spent: number;
  total_visits: number;
  outstanding_balance: number;
  last_visit?: string;
  created_at?: string;
}

export interface CustomerSettings {
  mandatory_for_pos: boolean;
  credit_allowed: boolean;
}

export interface SalesAnalytics {
  today_sales: number;
  yesterday_sales: number;
  change_percentage: number;
  total_transactions: number;
  average_bill_value: number;
  top_payment_method: string;
}

export interface CategoryBreakdown {
  category: string;
  revenue: number;
  items_sold: number;
  percentage: number;
}

export interface TopProduct {
  id: string | number;
  name: string;
  quantity_sold: number;
  revenue: number;
}

export interface BusinessAlert {
  id: string | number;
  type: 'STOCKOUT' | 'LOW_STOCK' | 'DEAD_STOCK' | 'CREDIT_DUE' | 'FESTIVAL_SPIKE' | 'SYSTEM';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  message: string;
  action_label?: string;
  action_target?: string;
  created_at: string;
  is_resolved: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  proposal?: ConversationalProposal;
}

export interface WhatsAppStatus {
  is_connected: boolean;
  phone_number?: string;
  webhook_status: 'ACTIVE' | 'OFFLINE';
  last_synced?: string;
}
