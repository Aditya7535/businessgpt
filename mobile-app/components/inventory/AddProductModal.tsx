import React, { useState } from 'react';
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
import inventoryService from '../../services/inventory.service';
import { X } from 'lucide-react-native';

interface AddProductModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [minAlert, setMinAlert] = useState('5');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter a product name.');
      return;
    }
    const sp = parseFloat(sellingPrice);
    if (isNaN(sp) || sp < 0) {
      Alert.alert('Invalid Price', 'Please enter a valid selling price.');
      return;
    }

    try {
      setLoading(true);
      await inventoryService.createProduct({
        name: name.trim(),
        category: category.trim() || 'General',
        selling_price: sp,
        cost_price: parseFloat(costPrice) || 0,
        current_stock: parseFloat(currentStock) || 0,
        unit: unit.trim() || 'pcs',
        min_stock_alert: parseFloat(minAlert) || 5,
        is_active: true,
      });

      setName('');
      setCategory('');
      setSellingPrice('');
      setCostPrice('');
      setCurrentStock('');
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Creation Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalBox}>
          <View style={styles.header}>
            <Text style={styles.title}>Add New Product</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.black} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll}>
            <Input
              label="Product Name *"
              placeholder="e.g. Fortune Sunflower Oil 1L"
              value={name}
              onChangeText={setName}
            />

            <Input
              label="Category"
              placeholder="e.g. Groceries, Dairy, Snacks"
              value={category}
              onChangeText={setCategory}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Selling Price (₹) *"
                  placeholder="120"
                  keyboardType="numeric"
                  value={sellingPrice}
                  onChangeText={setSellingPrice}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Cost Price (₹)"
                  placeholder="100"
                  keyboardType="numeric"
                  value={costPrice}
                  onChangeText={setCostPrice}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Opening Stock"
                  placeholder="20"
                  keyboardType="numeric"
                  value={currentStock}
                  onChangeText={setCurrentStock}
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
              label="Low Stock Alert Threshold"
              placeholder="5"
              keyboardType="numeric"
              value={minAlert}
              onChangeText={setMinAlert}
            />
          </ScrollView>

          <View style={styles.actionRow}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={onClose}
              style={{ flex: 1 }}
            />
            <Button
              title="Save Product"
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
    padding: 16,
  },
  modalBox: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 20,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
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
  closeBtn: {
    padding: 4,
  },
  scroll: {
    maxHeight: 400,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: Colors.borderLight,
  },
});

export default AddProductModal;
