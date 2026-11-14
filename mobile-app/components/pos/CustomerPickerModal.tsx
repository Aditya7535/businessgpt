import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { Customer } from '../../types';
import customerService from '../../services/customer.service';
import { X, UserPlus, Search, Check } from 'lucide-react-native';

interface CustomerPickerModalProps {
  visible: boolean;
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer | null) => void;
  onClose: () => void;
}

export const CustomerPickerModal: React.FC<CustomerPickerModalProps> = ({
  visible,
  selectedCustomer,
  onSelect,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // New customer form
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (visible) {
      loadCustomers();
    }
  }, [visible, search]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const list = await customerService.getCustomers(search.trim() || undefined);
      setCustomers(list);
    } catch {
      // Ignore or empty
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('Required Fields', 'Please enter both customer name and phone number.');
      return;
    }

    try {
      setCreating(true);
      const created = await customerService.createCustomer({
        name: newName.trim(),
        phone: newPhone.trim(),
      });
      setNewName('');
      setNewPhone('');
      setShowCreate(false);
      onSelect(created);
      onClose();
    } catch (err: any) {
      Alert.alert('Failed to Add Customer', err.message);
    } finally {
      setCreating(false);
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
            <Text style={styles.title}>
              {showCreate ? 'New Customer' : 'Select Customer'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.black} />
            </TouchableOpacity>
          </View>

          {showCreate ? (
            <View>
              <Input
                label="Customer Name *"
                placeholder="e.g. Ramesh Kumar"
                value={newName}
                onChangeText={setNewName}
              />
              <Input
                label="Phone Number (10 digits) *"
                placeholder="e.g. 9876543210"
                keyboardType="phone-pad"
                maxLength={10}
                value={newPhone}
                onChangeText={setNewPhone}
              />
              <View style={styles.actionRow}>
                <Button
                  title="Back"
                  variant="outline"
                  onPress={() => setShowCreate(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Create & Select"
                  variant="primary"
                  loading={creating}
                  onPress={handleCreateCustomer}
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <Input
                placeholder="Search by name or phone..."
                value={search}
                onChangeText={setSearch}
                leftIcon={<Search size={16} color={Colors.textDim} />}
              />

              <TouchableOpacity
                onPress={() => setShowCreate(true)}
                style={styles.addBtn}
              >
                <UserPlus size={16} color={Colors.black} />
                <Text style={styles.addBtnText}>+ Add New Customer</Text>
              </TouchableOpacity>

              {selectedCustomer && (
                <TouchableOpacity
                  onPress={() => {
                    onSelect(null);
                    onClose();
                  }}
                  style={styles.removeSelectedBtn}
                >
                  <Text style={styles.removeSelectedText}>Remove Attached Customer (Walk-in)</Text>
                </TouchableOpacity>
              )}

              <FlatList
                data={customers}
                keyExtractor={(item) => String(item.id)}
                style={styles.list}
                renderItem={({ item }) => {
                  const isSelected = selectedCustomer?.id === item.id;
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        onSelect(item);
                        onClose();
                      }}
                      style={[
                        styles.item,
                        isSelected && styles.itemSelected,
                      ]}
                    >
                      <View>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemPhone}>{item.phone}</Text>
                      </View>
                      {isSelected ? (
                        <Check size={18} color={Colors.limeDark} />
                      ) : (
                        item.outstanding_balance > 0 && (
                          <Text style={styles.balanceText}>
                            Due: ₹{item.outstanding_balance}
                          </Text>
                        )
                      )}
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>
                      {loading ? 'Searching...' : 'No customers found'}
                    </Text>
                  </View>
                }
              />
            </View>
          )}
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
    maxWidth: 440,
    maxHeight: '85%',
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.limeBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 10,
    justifyContent: 'center',
    marginBottom: 12,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.black,
  },
  removeSelectedBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  removeSelectedText: {
    fontSize: 12,
    color: Colors.redDark,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  list: {
    maxHeight: 280,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    borderRadius: 6,
    marginBottom: 8,
    backgroundColor: Colors.surfaceElevated,
  },
  itemSelected: {
    borderColor: Colors.border,
    backgroundColor: Colors.limeBg,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMain,
  },
  itemPhone: {
    fontSize: 12,
    color: Colors.textDim,
    marginTop: 2,
  },
  balanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.redDark,
  },
  empty: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textDim,
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
});

export default CustomerPickerModal;
