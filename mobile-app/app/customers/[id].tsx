import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { formatCurrency, formatDate } from '../../utils/formatters';
import customerService from '../../services/customer.service';
import { Phone, MessageSquare, IndianRupee, History, X } from 'lucide-react-native';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [recording, setRecording] = useState(false);

  const customerQuery = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerService.getCustomer(id as string),
    enabled: !!id,
  });

  const customer = customerQuery.data;

  const handleCall = () => {
    if (customer?.phone) {
      Linking.openURL(`tel:${customer.phone}`);
    }
  };

  const handleWhatsAppReminder = () => {
    if (customer?.phone) {
      const msg = `Namaste ${customer.name}, this is a gentle reminder from your store regarding your outstanding balance of ${formatCurrency(customer.outstanding_balance)}. Please settle at your earliest convenience. Thank you!`;
      Linking.openURL(`whatsapp://send?phone=91${customer.phone}&text=${encodeURIComponent(msg)}`);
    }
  };

  const handleRecordPayment = async () => {
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    try {
      setRecording(true);
      const newBal = Math.max(0, (customer?.outstanding_balance || 0) - amt);
      await customerService.updateCustomer(id as string, {
        outstanding_balance: newBal,
      });
      setPaymentAmount('');
      setShowPaymentModal(false);
      customerQuery.refetch();
      Alert.alert('Payment Recorded', `Payment of ${formatCurrency(amt)} recorded successfully.`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setRecording(false);
    }
  };

  if (!customer) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>Loading customer details...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.name}>{customer.name}</Text>
            <Text style={styles.phone}>{customer.phone}</Text>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity onPress={handleCall} style={styles.iconBtn}>
              <Phone size={18} color={Colors.black} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleWhatsAppReminder} style={styles.iconBtn}>
              <MessageSquare size={18} color={Colors.limeDark} />
            </TouchableOpacity>
          </View>
        </View>

        {customer.address && (
          <Text style={styles.address}>Address: {customer.address}</Text>
        )}

        <View style={styles.divider} />

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Purchased</Text>
            <Text style={styles.statVal}>{formatCurrency(customer.total_spent)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Visits</Text>
            <Text style={styles.statVal}>{customer.total_visits || 1}</Text>
          </View>
        </View>
      </View>

      {/* Due / Udhar Section */}
      <View style={[styles.card, styles.dueCard]}>
        <View style={styles.dueHeader}>
          <Text style={styles.dueTitle}>Outstanding Udhar Balance</Text>
          <Badge
            label={customer.outstanding_balance > 0 ? 'PAYMENT DUE' : 'SETTLED'}
            variant={customer.outstanding_balance > 0 ? 'red' : 'lime'}
          />
        </View>

        <Text style={styles.dueVal}>{formatCurrency(customer.outstanding_balance)}</Text>

        <View style={styles.btnRow}>
          <Button
            title="Record Settle Payment"
            variant="primary"
            onPress={() => setShowPaymentModal(true)}
            style={{ flex: 1 }}
          />
          <Button
            title="Send WhatsApp"
            variant="lavender"
            onPress={handleWhatsAppReminder}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      {/* Payment Recording Modal */}
      <Modal visible={showPaymentModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Customer Payment</Text>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)}>
                <X size={20} color={Colors.black} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Current Outstanding Due: {formatCurrency(customer.outstanding_balance)}
            </Text>

            <Input
              label="Amount Received (₹) *"
              placeholder="e.g. 500"
              keyboardType="numeric"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowPaymentModal(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Save Payment"
                variant="primary"
                loading={recording}
                onPress={handleRecordPayment}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmBg,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.warmBg,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textDim,
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 18,
    ...Shadows.brutalSm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textMain,
  },
  phone: {
    fontSize: 13,
    color: Colors.textDim,
    marginTop: 2,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  address: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textDim,
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.textMain,
    marginTop: 2,
  },
  dueCard: {
    backgroundColor: Colors.redBg,
    borderColor: Colors.redDark,
  },
  dueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dueTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.redDark,
    textTransform: 'uppercase',
  },
  dueVal: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.redDark,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalOverlay: {
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
    maxWidth: 400,
    ...Shadows.brutalLg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textMain,
  },
  modalSub: {
    fontSize: 12,
    color: Colors.textDim,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
});
