import { create } from 'zustand';
import { Product, Customer, PaymentMethod, BillItem } from '../types';

interface CartState {
  items: BillItem[];
  customer: Customer | null;
  paymentMethod: PaymentMethod;
  discountAmount: number;
  taxRate: number; // default 0 or e.g. 0.05
  notes: string;

  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string | number) => void;
  updateQuantity: (productId: string | number, quantity: number) => void;
  setCustomer: (customer: Customer | null) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setDiscount: (discount: number) => void;
  setNotes: (notes: string) => void;
  clearCart: () => void;

  getSubtotal: () => number;
  getTaxAmount: () => number;
  getTotalAmount: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customer: null,
  paymentMethod: 'CASH',
  discountAmount: 0,
  taxRate: 0,
  notes: '',

  addItem: (product: Product, quantity = 1) => {
    const items = [...get().items];
    const existingIndex = items.findIndex((i) => String(i.product_id) === String(product.id));
    const price = product.unit_price ?? product.selling_price ?? 0;

    if (existingIndex > -1) {
      const existing = items[existingIndex];
      const newQty = existing.quantity + quantity;
      items[existingIndex] = {
        ...existing,
        quantity: newQty,
        total_price: newQty * existing.unit_price,
      };
    } else {
      items.push({
        product_id: product.id,
        product_name: product.name,
        quantity: quantity,
        unit_price: price,
        total_price: quantity * price,
        unit: product.unit || 'pcs',
      });
    }

    set({ items });
  },

  removeItem: (productId: string | number) => {
    set({ items: get().items.filter((i) => String(i.product_id) !== String(productId)) });
  },

  updateQuantity: (productId: string | number, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    const items = get().items.map((i) => {
      if (String(i.product_id) === String(productId)) {
        return {
          ...i,
          quantity,
          total_price: quantity * i.unit_price,
        };
      }
      return i;
    });
    set({ items });
  },

  setCustomer: (customer) => set({ customer }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setDiscount: (discountAmount) => set({ discountAmount }),
  setNotes: (notes) => set({ notes }),

  clearCart: () =>
    set({
      items: [],
      customer: null,
      paymentMethod: 'CASH',
      discountAmount: 0,
      notes: '',
    }),

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.total_price, 0);
  },

  getTaxAmount: () => {
    const subtotal = get().getSubtotal();
    return Math.round(subtotal * get().taxRate * 100) / 100;
  },

  getTotalAmount: () => {
    const subtotal = get().getSubtotal();
    const tax = get().getTaxAmount();
    const discount = get().discountAmount;
    return Math.max(0, subtotal + tax - discount);
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));

export default useCartStore;
