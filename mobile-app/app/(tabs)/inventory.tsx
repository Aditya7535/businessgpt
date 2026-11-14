import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Colors from '../../constants/colors';
import Header from '../../components/ui/Header';
import OfflineBanner from '../../components/ui/OfflineBanner';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import ProductCard from '../../components/inventory/ProductCard';
import StockAdjustModal from '../../components/inventory/StockAdjustModal';
import AddProductModal from '../../components/inventory/AddProductModal';
import EditProductModal from '../../components/inventory/EditProductModal';
import { Product } from '../../types';
import inventoryService from '../../services/inventory.service';
import { Search, Plus, AlertTriangle } from 'lucide-react-native';

export default function InventoryScreen() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Modals
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch products
  const productsQuery = useQuery({
    queryKey: ['products', selectedCategory, onlyLowStock],
    queryFn: () =>
      inventoryService.getProducts({
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
        low_stock: onlyLowStock ? true : undefined,
      }),
  });

  const products = productsQuery.data || [];

  const filteredProducts = products.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.sku && p.sku.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term))
    );
  });

  // Extract unique categories
  const categories = ['ALL', ...Array.from(new Set(products.map((p) => p.category || 'General')))];

  const handleDeleteProduct = (product: Product) => {
    Alert.alert(
      'Delete Product',
      `Permanently delete "${product.name}" from catalog?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await inventoryService.deleteProduct(product.id);
              queryClient.invalidateQueries({ queryKey: ['products'] });
              queryClient.invalidateQueries({ queryKey: ['pos-products'] });
              queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const handleRefreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['pos-products'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
  };

  return (
    <View style={styles.container}>
      <Header
        title="Inventory Catalog"
        subtitle={`${products.length} Products listed · Tap to Edit`}
        rightAction={
          <Button
            title="+ Add Product"
            size="sm"
            variant="primary"
            onPress={() => setShowAddModal(true)}
          />
        }
      />
      <OfflineBanner />

      <View style={styles.topControls}>
        <Input
          placeholder="Search products by name, SKU..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={16} color={Colors.textDim} />}
          style={{ height: 42 }}
        />

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            <TouchableOpacity
              onPress={() => setOnlyLowStock(!onlyLowStock)}
              style={[
                styles.lowStockChip,
                onlyLowStock && styles.lowStockChipActive,
              ]}
            >
              <AlertTriangle size={13} color={onlyLowStock ? Colors.white : Colors.amberDark} />
              <Text
                style={[
                  styles.chipText,
                  onlyLowStock && { color: Colors.white, fontWeight: '800' },
                ]}
              >
                Low Stock
              </Text>
            </TouchableOpacity>

            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.chip,
                    active && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && styles.chipTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={productsQuery.isRefetching}
            onRefresh={handleRefreshAll}
            tintColor={Colors.black}
          />
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onAdjust={() => setAdjustProduct(item)}
            onEdit={() => setEditProduct(item)}
            onDelete={() => handleDeleteProduct(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {productsQuery.isLoading ? 'Loading catalog...' : 'No products found'}
            </Text>
            <Text style={styles.emptySub}>
              {onlyLowStock
                ? 'All products are currently at healthy stock levels.'
                : 'Try clearing your search or add a new product to inventory.'}
            </Text>
          </View>
        }
      />

      {/* Edit Product & Update Price Modal */}
      <EditProductModal
        visible={!!editProduct}
        product={editProduct}
        onClose={() => setEditProduct(null)}
        onSuccess={handleRefreshAll}
        onDeleted={handleRefreshAll}
      />

      {/* Direct Stock Adjustment Modal */}
      <StockAdjustModal
        visible={!!adjustProduct}
        product={adjustProduct}
        onClose={() => setAdjustProduct(null)}
        onSuccess={handleRefreshAll}
      />

      {/* Add New Product Modal */}
      <AddProductModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleRefreshAll}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmBg,
  },
  topControls: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  filterRow: {
    marginTop: -6,
    marginBottom: 8,
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    backgroundColor: Colors.white,
  },
  chipActive: {
    backgroundColor: Colors.black,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  chipTextActive: {
    color: Colors.white,
  },
  lowStockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: Colors.amberDark,
    borderRadius: 6,
    backgroundColor: Colors.amberBg,
  },
  lowStockChipActive: {
    backgroundColor: Colors.redDark,
    borderColor: Colors.border,
  },
  list: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textDim,
    textAlign: 'center',
  },
});
