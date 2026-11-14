import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import CustomerPickerModal from '../../components/pos/CustomerPickerModal';
import { Customer } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import customerService from '../../services/customer.service';
import { Search, UserPlus, Phone, ChevronRight } from 'lucide-react-native';

export default function CustomersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const customersQuery = useQuery({
    queryKey: ['customers', search],
    queryFn: () => customerService.getCustomers(search.trim() || undefined),
  });

  const customers = customersQuery.data || [];

  const totalDue = customers.reduce((sum, c) => sum + (c.outstanding_balance || 0), 0);

  return (
    <View style={styles.container}>
      {/* Total Due Banner */}
      <View style={styles.dueBanner}>
        <View>
          <Text style={styles.dueBannerLabel}>Total Market Udhar / Due</Text>
          <Text style={styles.dueBannerAmount}>{formatCurrency(totalDue)}</Text>
        </View>
        <Button
          title="+ Add Customer"
          size="sm"
          variant="primary"
          onPress={() => setShowAddModal(true)}
        />
      </View>

      <View style={styles.searchBar}>
        <Input
          placeholder="Search customer by name or phone..."
          value={search}
          onChangeText={setSearch}
          leftIcon={<Search size={16} color={Colors.textDim} />}
          style={{ height: 42 }}
        />
      </View>

      <FlatList
        data={customers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={customersQuery.isRefetching}
            onRefresh={() => customersQuery.refetch()}
            tintColor={Colors.black}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push(`/customers/${item.id}` as any)}
            style={styles.customerCard}
          >
            <View style={styles.customerLeft}>
              <View style={styles.avatarBox}>
                <Text style={styles.avatarText}>
                  {item.name ? item.name.charAt(0).toUpperCase() : 'C'}
                </Text>
              </View>
              <View>
                <Text style={styles.customerName}>{item.name}</Text>
                <View style={styles.phoneRow}>
                  <Phone size={12} color={Colors.textDim} />
                  <Text style={styles.customerPhone}>{item.phone}</Text>
                </View>
              </View>
            </View>

            <View style={styles.customerRight}>
              {item.outstanding_balance > 0 ? (
                <View style={styles.dueBox}>
                  <Text style={styles.dueLabel}>DUE / UDHAR</Text>
                  <Text style={styles.dueAmount}>
                    {formatCurrency(item.outstanding_balance)}
                  </Text>
                </View>
              ) : (
                <Badge label="CLEARED" variant="lime" size="sm" />
              )}
              <ChevronRight size={18} color={Colors.textDim} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              {customersQuery.isLoading ? 'Loading customers...' : 'No customers found'}
            </Text>
          </View>
        }
      />

      <CustomerPickerModal
        visible={showAddModal}
        selectedCustomer={null}
        onSelect={() => customersQuery.refetch()}
        onClose={() => setShowAddModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmBg,
  },
  dueBanner: {
    backgroundColor: Colors.white,
    borderBottomWidth: 2,
    borderColor: Colors.border,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dueBannerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
  },
  dueBannerAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.redDark,
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  list: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  customerCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Shadows.brutalSm,
  },
  customerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.limeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.black,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  customerPhone: {
    fontSize: 12,
    color: Colors.textDim,
    fontWeight: '600',
  },
  customerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dueBox: {
    alignItems: 'flex-end',
  },
  dueLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.redDark,
  },
  dueAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.redDark,
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    color: Colors.textDim,
  },
});
