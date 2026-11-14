import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Colors from '../../constants/colors';
import { BillItem } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { Minus, Plus, Trash2 } from 'lucide-react-native';

interface CartItemProps {
  item: BillItem;
  onUpdateQty: (qty: number) => void;
  onRemove: () => void;
}

export const CartItem: React.FC<CartItemProps> = ({
  item,
  onUpdateQty,
  onRemove,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.product_name}
        </Text>
        <Text style={styles.unitPrice}>
          {formatCurrency(item.unit_price)} / {item.unit || 'unit'}
        </Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.qtyBox}>
          <TouchableOpacity
            onPress={() => onUpdateQty(item.quantity - 1)}
            style={styles.qtyBtn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Minus size={14} color={Colors.black} />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{item.quantity}</Text>
          <TouchableOpacity
            onPress={() => onUpdateQty(item.quantity + 1)}
            style={styles.qtyBtn}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Plus size={14} color={Colors.black} />
          </TouchableOpacity>
        </View>

        <Text style={styles.totalPrice}>
          {formatCurrency(item.total_price)}
        </Text>

        <TouchableOpacity
          onPress={onRemove}
          style={styles.deleteBtn}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Trash2 size={16} color={Colors.redDark} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMain,
  },
  unitPrice: {
    fontSize: 12,
    color: Colors.textDim,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 4,
    backgroundColor: Colors.surfaceElevated,
  },
  qtyBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
    paddingHorizontal: 8,
  },
  totalPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
    minWidth: 65,
    textAlign: 'right',
  },
  deleteBtn: {
    padding: 4,
  },
});

export default CartItem;
