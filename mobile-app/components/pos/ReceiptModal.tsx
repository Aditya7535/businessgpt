import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Button from '../ui/Button';
import { POSBill } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import whatsappService from '../../services/whatsapp.service';
import { CheckCircle2, MessageSquare, Share2, X } from 'lucide-react-native';

interface ReceiptModalProps {
  visible: boolean;
  bill: POSBill | null;
  onClose: () => void;
  onNewSale: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  visible,
  bill,
  onClose,
  onNewSale,
}) => {
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  if (!bill) return null;

  const handleShare = async () => {
    try {
      const itemsText = bill.items
        .map((i) => `${i.product_name} x ${i.quantity} = ${formatCurrency(i.total_price)}`)
        .join('\n');
      const shareText = `*BUSINESSGPT INVOICE*\nBill #${bill.bill_number}\nDate: ${formatDateTime(bill.created_at)}\nCustomer: ${bill.customer_name || 'Walk-in'}\n\n*ITEMS:*\n${itemsText}\n\n*TOTAL: ${formatCurrency(bill.total_amount)}*\nPayment: ${bill.payment_method}\n\nThank you for your business!`;

      await Share.share({
        message: shareText,
        title: `Invoice #${bill.bill_number}`,
      });
    } catch {
      // User dismissed share
    }
  };

  const handleSendWhatsApp = async () => {
    if (!bill.customer_phone) {
      Alert.alert(
        'Phone Number Required',
        'This bill does not have an attached customer phone number. Use "Share Receipt" to send manually.'
      );
      return;
    }

    try {
      setSendingWhatsapp(true);
      await whatsappService.sendBillInvoice(String(bill.id), bill.customer_phone);
      Alert.alert('Sent', `Invoice sent to WhatsApp on ${bill.customer_phone}!`);
    } catch (err: any) {
      Alert.alert('WhatsApp Error', err.message);
    } finally {
      setSendingWhatsapp(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <CheckCircle2 size={24} color={Colors.limeDark} />
              <View>
                <Text style={styles.title}>Sale Recorded</Text>
                <Text style={styles.billNumber}>Bill #{bill.bill_number}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.black} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.receiptBody}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date & Time</Text>
              <Text style={styles.metaVal}>{formatDateTime(bill.created_at)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Customer</Text>
              <Text style={styles.metaVal}>
                {bill.customer_name || 'Walk-in'} {bill.customer_phone ? `(${bill.customer_phone})` : ''}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payment Method</Text>
              <Text style={[styles.metaVal, { fontWeight: '800' }]}>{bill.payment_method}</Text>
            </View>

            <View style={styles.dashedDivider} />

            <Text style={styles.sectionHeader}>Billed Items</Text>
            {bill.items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  <Text style={styles.itemQty}>
                    {item.quantity} x {formatCurrency(item.unit_price)}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>{formatCurrency(item.total_price)}</Text>
              </View>
            ))}

            <View style={styles.dashedDivider} />

            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Subtotal</Text>
              <Text style={styles.calcVal}>{formatCurrency(bill.subtotal)}</Text>
            </View>
            {bill.discount_amount > 0 && (
              <View style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: Colors.limeDark }]}>Discount</Text>
                <Text style={[styles.calcVal, { color: Colors.limeDark }]}>
                  -{formatCurrency(bill.discount_amount)}
                </Text>
              </View>
            )}
            {bill.tax_amount > 0 && (
              <View style={styles.calcRow}>
                <Text style={styles.calcLabel}>GST / Tax</Text>
                <Text style={styles.calcVal}>+{formatCurrency(bill.tax_amount)}</Text>
              </View>
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL PAID</Text>
              <Text style={styles.totalVal}>{formatCurrency(bill.total_amount)}</Text>
            </View>
          </ScrollView>

          <View style={styles.buttonStack}>
            <View style={styles.shareRow}>
              <Button
                title="Share"
                variant="outline"
                icon={<Share2 size={16} color={Colors.black} />}
                onPress={handleShare}
                style={{ flex: 1 }}
              />
              <Button
                title="WhatsApp"
                variant="lavender"
                loading={sendingWhatsapp}
                icon={<MessageSquare size={16} color={Colors.black} />}
                onPress={handleSendWhatsApp}
                style={{ flex: 1.2 }}
              />
            </View>

            <Button
              title="Start New Sale"
              variant="primary"
              size="lg"
              onPress={() => {
                onClose();
                onNewSale();
              }}
            />
          </View>
        </View>
      </View>
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
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
  },
  billNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textDim,
  },
  closeBtn: {
    padding: 4,
  },
  receiptBody: {
    maxHeight: 340,
    backgroundColor: Colors.warmBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 11,
    color: Colors.textDim,
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 12,
    color: Colors.textMain,
    fontWeight: '600',
  },
  dashedDivider: {
    borderBottomWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    marginVertical: 10,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
  },
  itemQty: {
    fontSize: 11,
    color: Colors.textDim,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  calcLabel: {
    fontSize: 12,
    color: Colors.textDim,
    fontWeight: '600',
  },
  calcVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderColor: Colors.border,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.textMain,
  },
  totalVal: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textMain,
  },
  buttonStack: {
    marginTop: 16,
    gap: 10,
  },
  shareRow: {
    flexDirection: 'row',
    gap: 10,
  },
});

export default ReceiptModal;
