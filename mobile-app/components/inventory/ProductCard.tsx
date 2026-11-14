import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Colors from '../../constants/colors';
import Badge from '../ui/Badge';
import { Product } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Shadows } from '../../constants/theme';
import { PlusCircle, AlertTriangle, Edit3, Trash2 } from 'lucide-react-native';

interface ProductCardProps {
  product: Product;
  onPress?: () => void;
  onAdjust?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  onAdjust,
  onEdit,
  onDelete,
}) => {
  const isOutOfStock = product.current_stock <= 0;
  const reorderPoint = product.reorder_point ?? product.min_stock_alert ?? 10;
  const isLowStock = !isOutOfStock && product.current_stock <= reorderPoint;
  const displayPrice = product.unit_price ?? product.selling_price ?? 0;

  const getStockBadge = () => {
    if (isOutOfStock) {
      return <Badge label="Out of Stock" variant="red" size="sm" />;
    }
    if (isLowStock) {
      return <Badge label="Low Stock" variant="amber" size="sm" />;
    }
    return <Badge label="In Stock" variant="lime" size="sm" />;
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.name} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={styles.category}>{product.category || 'General'}</Text>
        </View>
        <View style={styles.badgeActions}>
          {getStockBadge()}
          {onDelete && (
            <TouchableOpacity
              onPress={onDelete}
              style={styles.deleteMiniBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 size={15} color={Colors.redDark} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={styles.stockCol}>
          <Text style={styles.stockLabel}>Available Stock</Text>
          <View style={styles.stockRow}>
            {isLowStock && <AlertTriangle size={14} color={Colors.amberDark} />}
            <Text
              style={[
                styles.stockValue,
                isOutOfStock ? styles.stockOut : isLowStock ? styles.stockLow : null,
              ]}
            >
              {product.current_stock} {product.unit || 'units'}
            </Text>
          </View>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Selling Price</Text>
          <Text style={styles.priceValue}>{formatCurrency(displayPrice)}</Text>
        </View>

        <View style={styles.btnGroup}>
          {onEdit && (
            <TouchableOpacity
              onPress={onEdit}
              style={styles.editBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Edit3 size={15} color={Colors.black} />
              <Text style={styles.btnText}>Edit Price</Text>
            </TouchableOpacity>
          )}

          {onAdjust && (
            <TouchableOpacity
              onPress={onAdjust}
              style={styles.adjustBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <PlusCircle size={15} color={Colors.black} />
              <Text style={styles.btnText}>Stock</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    ...Shadows.brutalSm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 2,
  },
  category: {
    fontSize: 12,
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  badgeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteMiniBtn: {
    padding: 4,
    backgroundColor: Colors.redBg,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.redDark,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockCol: {
    minWidth: 80,
  },
  stockLabel: {
    fontSize: 10,
    color: Colors.textDim,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  stockValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  stockLow: {
    color: Colors.amberDark,
  },
  stockOut: {
    color: Colors.redDark,
  },
  priceContainer: {
    alignItems: 'flex-start',
    minWidth: 80,
  },
  priceLabel: {
    fontSize: 10,
    color: Colors.textDim,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textMain,
    marginTop: 2,
  },
  btnGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  adjustBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.lime,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  btnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.black,
  },
});

export default ProductCard;
