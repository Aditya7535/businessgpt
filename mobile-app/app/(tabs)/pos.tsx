import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Header from '../../components/ui/Header';
import OfflineBanner from '../../components/ui/OfflineBanner';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import CartItem from '../../components/pos/CartItem';
import CustomerPickerModal from '../../components/pos/CustomerPickerModal';
import ReceiptModal from '../../components/pos/ReceiptModal';
import { Product, POSBill, PaymentMethod } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import posService from '../../services/pos.service';
import settingsService from '../../services/settings.service';
import useCartStore from '../../store/cartStore';
import {
  Search,
  ShoppingCart,
  User,
  Plus,
  CreditCard,
  Banknote,
  Smartphone,
  X,
  FileCheck,
} from 'lucide-react-native';

export default function POSScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCartModal, setShowCartModal] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [completedBill, setCompletedBill] = useState<POSBill | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  // Cart store
  const {
    items,
    customer,
    paymentMethod,
    addItem,
    removeItem,
    updateQuantity,
    setCustomer,
    setPaymentMethod,
    clearCart,
    getSubtotal,
    getTotalAmount,
    getItemCount,
  } = useCartStore();

  // Load POS products
  const productsQuery = useQuery({
    queryKey: ['pos-products'],
    queryFn: () => posService.getProducts(),
  });

  // Load Store Settings for mandatory customer validation
  const settingsQuery = useQuery({
    queryKey: ['store-settings'],
    queryFn: () => settingsService.getSettings(),
  });

  const products = productsQuery.data || [];
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode && p.barcode.includes(search))
  );

  const handleCheckout = async () => {
    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Please add at least one product to the bill.');
      return;
    }

    // Check mandatory customer requirement if enabled
    const requireCustomer = settingsQuery.data?.pos_require_customer;
    if (requireCustomer && !customer) {
      Alert.alert(
        'Customer Required',
        'Store settings require attaching a customer to every bill. Please select or add a customer.',
        [{ text: 'Select Customer', onPress: () => setShowCustomerPicker(true) }]
      );
      return;
    }

    try {
      setCheckingOut(true);
      const bill = await posService.createBill({
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        customer_id: customer?.id,
        customer_name: customer?.name,
        customer_phone: customer?.phone,
        payment_method: paymentMethod,
        discount_amount: useCartStore.getState().discountAmount,
      });

      // Clear cart, close cart modal, show receipt
      clearCart();
      setShowCartModal(false);
      setCompletedBill(bill);

      // Invalidate queries so dashboard & inventory immediately reflect the sale!
      queryClient.invalidateQueries({ queryKey: ['today-bills'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['sales-overview'] });
    } catch (err: any) {
      Alert.alert('Checkout Failed', err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  const totalAmount = getTotalAmount();
  const itemCount = getItemCount();

  return (
    <View style={styles.container}>
      <Header
        title="POS Counter Register"
        subtitle="Quick Billing & Invoicing"
        rightAction={
          <TouchableOpacity
            onPress={() => setShowCartModal(true)}
            style={styles.cartHeaderBtn}
          >
            <ShoppingCart size={20} color={Colors.black} />
            {itemCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{itemCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        }
      />
      <OfflineBanner />

      {/* Search Input */}
      <View style={styles.searchBar}>
        <Input
          placeholder="Scan barcode or type product name..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={16} color={Colors.textDim} />}
          style={{ height: 42 }}
        />
      </View>

      {/* Product Catalog Grid */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.catalogGrid}
        renderItem={({ item }) => {
          const inCart = items.find((i) => i.product_id === item.id);
          const isOutOfStock = item.current_stock <= 0;

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              disabled={isOutOfStock}
              onPress={() => addItem(item, 1)}
              style={[
                styles.productTile,
                isOutOfStock && styles.tileOutOfStock,
                inCart && styles.tileInCart,
              ]}
            >
              <View style={styles.tileHeader}>
                <Badge
                  label={item.category || 'General'}
                  size="sm"
                  variant="neutral"
                />
                {inCart && (
                  <View style={styles.inCartCount}>
                    <Text style={styles.inCartText}>{inCart.quantity}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.tileName} numberOfLines={2}>
                {item.name}
              </Text>

              <View style={styles.tileFooter}>
                <Text style={styles.tilePrice}>{formatCurrency(item.unit_price ?? item.selling_price ?? 0)}</Text>
                <Text style={styles.tileStock}>
                  {isOutOfStock ? 'OUT OF STOCK' : `${item.current_stock} ${item.unit || 'left'}`}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyGrid}>
            <Text style={styles.emptyText}>No products found matching &quot;{search}&quot;</Text>
          </View>
        }
      />

      {/* Floating Bottom Cart Bar */}
      {itemCount > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowCartModal(true)}
            style={styles.floatingCheckout}
          >
            <View style={styles.barLeft}>
              <View style={styles.barIconCircle}>
                <ShoppingCart size={18} color={Colors.black} />
              </View>
              <View>
                <Text style={styles.barItemsCount}>
                  {itemCount} {itemCount === 1 ? 'Item' : 'Items'} in Bill
                </Text>
                <Text style={styles.barCustomerText}>
                  {customer ? `Customer: ${customer.name}` : 'Walk-in Customer'}
                </Text>
              </View>
            </View>

            <View style={styles.barRight}>
              <Text style={styles.barTotal}>{formatCurrency(totalAmount)}</Text>
              <Text style={styles.barCheckoutAction}>View Bill &rarr;</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Cart & Billing Checkout Modal */}
      <Modal visible={showCartModal} animationType="slide">
        <View style={styles.cartModalContainer}>
          <View style={styles.cartModalHeader}>
            <View>
              <Text style={styles.cartModalTitle}>Current Bill</Text>
              <Text style={styles.cartModalSubtitle}>
                {itemCount} items · Total {formatCurrency(totalAmount)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowCartModal(false)}
              style={styles.closeBtn}
            >
              <X size={22} color={Colors.black} />
            </TouchableOpacity>
          </View>

          {/* Customer Attachment Button */}
          <TouchableOpacity
            onPress={() => setShowCustomerPicker(true)}
            style={styles.customerAttachBar}
          >
            <User size={18} color={Colors.black} />
            <Text style={styles.customerAttachText}>
              {customer ? `${customer.name} (${customer.phone})` : '+ Attach Customer (Optional / Udhar)'}
            </Text>
          </TouchableOpacity>

          {/* Cart Items List */}
          <FlatList
            data={items}
            keyExtractor={(item) => String(item.product_id)}
            contentContainerStyle={styles.cartItemsList}
            renderItem={({ item }) => (
              <CartItem
                item={item}
                onUpdateQty={(q) => updateQuantity(item.product_id, q)}
                onRemove={() => removeItem(item.product_id)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyCartBox}>
                <Text style={styles.emptyCartText}>No items added to current bill yet.</Text>
              </View>
            }
          />

          {/* Checkout Footer */}
          <View style={styles.checkoutFooter}>
            <Text style={styles.paymentMethodTitle}>Select Payment Method</Text>
            <View style={styles.paymentMethodsRow}>
              {(['CASH', 'UPI', 'CARD', 'CREDIT'] as PaymentMethod[]).map((method) => {
                const active = paymentMethod === method;
                return (
                  <TouchableOpacity
                    key={method}
                    onPress={() => setPaymentMethod(method)}
                    style={[
                      styles.methodChip,
                      active && styles.methodChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.methodText,
                        active && styles.methodTextActive,
                      ]}
                    >
                      {method}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.billTotalRow}>
              <Text style={styles.billTotalLabel}>Total Amount Payable</Text>
              <Text style={styles.billTotalVal}>{formatCurrency(totalAmount)}</Text>
            </View>

            <View style={styles.checkoutActionRow}>
              <Button
                title="Clear"
                variant="outline"
                onPress={() => {
                  clearCart();
                  setShowCartModal(false);
                }}
                style={{ flex: 1 }}
              />
              <Button
                title="Charge & Print Bill"
                variant="primary"
                size="lg"
                loading={checkingOut}
                onPress={handleCheckout}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Customer Picker / Inline Creation Modal */}
      <CustomerPickerModal
        visible={showCustomerPicker}
        selectedCustomer={customer}
        onSelect={(c) => setCustomer(c)}
        onClose={() => setShowCustomerPicker(false)}
      />

      {/* Success Receipt Modal */}
      <ReceiptModal
        visible={!!completedBill}
        bill={completedBill}
        onClose={() => setCompletedBill(null)}
        onNewSale={() => {
          setCompletedBill(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmBg,
  },
  cartHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.brutalSm,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.black,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '900',
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  catalogGrid: {
    padding: 12,
    paddingBottom: 90,
  },
  productTile: {
    flex: 1,
    margin: 4,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 125,
    justifyContent: 'space-between',
    ...Shadows.brutalSm,
  },
  tileInCart: {
    borderColor: Colors.black,
    backgroundColor: '#FAFFE8',
    borderWidth: 2.5,
  },
  tileOutOfStock: {
    opacity: 0.5,
    backgroundColor: '#F3F3F3',
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inCartCount: {
    backgroundColor: Colors.lime,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  inCartText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.black,
  },
  tileName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
    marginVertical: 6,
  },
  tileFooter: {
    flexDirection: 'column',
    gap: 2,
  },
  tilePrice: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textMain,
  },
  tileStock: {
    fontSize: 10,
    color: Colors.textDim,
    fontWeight: '600',
  },
  emptyGrid: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textDim,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  floatingCheckout: {
    backgroundColor: Colors.lime,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Shadows.brutal,
  },
  barLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barItemsCount: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.black,
  },
  barCustomerText: {
    fontSize: 11,
    color: '#3f5e00',
    fontWeight: '600',
  },
  barRight: {
    alignItems: 'flex-end',
  },
  barTotal: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.black,
  },
  barCheckoutAction: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.black,
    textTransform: 'uppercase',
  },
  cartModalContainer: {
    flex: 1,
    backgroundColor: Colors.warmBg,
  },
  cartModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  cartModalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textMain,
  },
  cartModalSubtitle: {
    fontSize: 12,
    color: Colors.textDim,
  },
  closeBtn: {
    padding: 6,
  },
  customerAttachBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  customerAttachText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
  },
  cartItemsList: {
    padding: 16,
  },
  emptyCartBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyCartText: {
    color: Colors.textDim,
    fontSize: 13,
  },
  checkoutFooter: {
    backgroundColor: Colors.white,
    borderTopWidth: 2,
    borderColor: Colors.border,
    padding: 16,
    paddingBottom: 24,
  },
  paymentMethodTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  methodChip: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
  },
  methodChipActive: {
    backgroundColor: Colors.black,
  },
  methodText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
  },
  methodTextActive: {
    color: Colors.white,
  },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  billTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textDim,
  },
  billTotalVal: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.textMain,
  },
  checkoutActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
