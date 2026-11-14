import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
import { X, Trash2, Edit3, AlertTriangle } from 'lucide-react-native';

interface EditProductModalProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
  onDeleted?: () => void;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({
  visible,
  product,
  onClose,
  onSuccess,
  onDeleted,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('');
  const [reorderPoint, setReorderPoint] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name || '');
      setCategory(product.category || 'General');
      const p = product.unit_price ?? product.selling_price ?? 0;
      setPrice(String(p));
      setUnit(product.unit || 'pcs');
      setReorderPoint(String(product.reorder_point ?? product.min_stock_alert ?? 10));
    }
  }, [product]);

  if (!product) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Product name cannot be empty.');
      return;
    }
    const unitPrice = parseFloat(price);
    if (isNaN(unitPrice) || unitPrice < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price (greater than or equal to 0).');
      return;
    }

    try {
      setSaving(true);
      await inventoryService.updateProduct(product.id, {
        name: name.trim(),
        category: category.trim() || 'General',
        unit_price: unitPrice,
        unit: unit.trim() || 'pcs',
        reorder_point: parseInt(reorderPoint, 10) || 10,
      });

      Alert.alert('Success', `Updated details for ${name.trim()}!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to permanently delete "${product.name}" from your store catalog? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await inventoryService.deleteProduct(product.id);
              Alert.alert('Deleted', `Product "${product.name}" deleted from store catalog.`);
              if (onDeleted) {
                onDeleted();
              } else {
                onSuccess();
              }
              onClose();
            } catch (err: any) {
              Alert.alert('Delete Failed', err.message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalBox}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Edit3 size={20} color={Colors.black} />
              <Text style={styles.title}>Edit Product & Price</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.black} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll}>
            <Input
              label="Product Name *"
              value={name}
              onChangeText={setName}
            />

            <Input
              label="Selling Price (₹) *"
              keyboardType="numeric"
              placeholder="e.g. 150"
              value={price}
              onChangeText={setPrice}
              helper="Price charged to customers at POS counter checkout."
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Category"
                  value={category}
                  onChangeText={setCategory}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Unit"
                  placeholder="pcs, kg, ltr, pkt"
                  value={unit}
                  onChangeText={setUnit}
                />
              </View>
            </View>

            <Input
              label="Low Stock Reorder Alert"
              keyboardType="numeric"
              value={reorderPoint}
              onChangeText={setReorderPoint}
              helper="Alert triggers when stock drops below this quantity."
            />

            {/* Current Stock Banner */}
            <View style={styles.stockNotice}>
              <Text style={styles.stockNoticeLabel}>Current Available Stock</Text>
              <Text style={styles.stockNoticeVal}>
                {product.current_stock} {product.unit || 'units'}
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionColumn}>
            <View style={styles.saveRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={onClose}
                style={{ flex: 1 }}
              />
              <Button
                title="Save Changes"
                variant="primary"
                loading={saving}
                onPress={handleSave}
                style={{ flex: 1.5 }}
              />
            </View>

            <TouchableOpacity
              onPress={handleDelete}
              disabled={deleting}
              style={styles.deleteBtn}
            >
              <Trash2 size={16} color={Colors.redDark} />
              <Text style={styles.deleteBtnText}>
                {deleting ? 'Deleting...' : 'Delete Product from Store'}
              </Text>
            </TouchableOpacity>
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
    padding: 16,
  },
  modalBox: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 20,
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    ...Shadows.brutalLg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    maxHeight: 380,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  stockNotice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.warmBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  stockNoticeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDim,
  },
  stockNoticeVal: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textMain,
  },
  actionColumn: {
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: Colors.borderLight,
  },
  saveRow: {
    flexDirection: 'row',
    gap: 10,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.redBg,
    borderWidth: 1.5,
    borderColor: Colors.redDark,
    borderRadius: 6,
    paddingVertical: 10,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.redDark,
  },
});

export default EditProductModal;
