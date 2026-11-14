import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Product } from '../../types';
import inventoryService from '../../services/inventory.service';
import { X } from 'lucide-react-native';

interface StockAdjustModalProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  visible,
  product,
  onClose,
  onSuccess,
}) => {
  const [movementType, setMovementType] = useState<'IN' | 'OUT' | 'ADJUSTMENT'>('IN');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!product) return null;

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid positive number for quantity.');
      return;
    }

    try {
      setLoading(true);
      await inventoryService.adjustStock({
        product_id: product.id,
        quantity: qty,
        movement_type: movementType,
        notes: notes.trim() || undefined,
      });
      setQuantity('');
      setNotes('');
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Adjustment Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalBox}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Adjust Stock</Text>
              <Text style={styles.productName}>{product.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.black} />
            </TouchableOpacity>
          </View>

          <View style={styles.currentStockBox}>
            <Text style={styles.currentStockLabel}>Current Stock</Text>
            <Text style={styles.currentStockVal}>
              {product.current_stock} {product.unit || 'units'}
            </Text>
          </View>

          <Text style={styles.typeLabel}>Select Operation</Text>
          <View style={styles.typeRow}>
            {(['IN', 'OUT', 'ADJUSTMENT'] as const).map((type) => {
              const active = movementType === type;
              return (
                <TouchableOpacity
                  key={type}
                  onPress={() => setMovementType(type)}
                  style={[
                    styles.typeBtn,
                    active && styles.typeBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeText,
                      active && styles.typeTextActive,
                    ]}
                  >
                    {type === 'IN' ? '+ Stock IN' : type === 'OUT' ? '- Stock OUT' : 'Reset Stock'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Input
            label="Quantity"
            placeholder="e.g. 10"
            keyboardType="numeric"
            value={quantity}
            onChangeText={setQuantity}
          />

          <Input
            label="Reason / Notes (Optional)"
            placeholder="e.g. Supplier delivery, damage, audit"
            value={notes}
            onChangeText={setNotes}
          />

          <View style={styles.actionRow}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <Button
              title="Confirm Update"
              variant="primary"
              loading={loading}
              onPress={handleSubmit}
              style={{ flex: 1.5 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    ...Shadows.brutalLg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
  },
  productName: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  currentStockBox: {
    backgroundColor: Colors.warmBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 10,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  currentStockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDim,
    textTransform: 'uppercase',
  },
  currentStockVal: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: Colors.lime,
    borderWidth: 2,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textDim,
  },
  typeTextActive: {
    color: Colors.black,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
});

export default StockAdjustModal;
