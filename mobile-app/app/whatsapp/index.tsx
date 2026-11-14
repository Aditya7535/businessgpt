import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import whatsappService from '../../services/whatsapp.service';
import { MessageSquare, CheckCircle2, AlertCircle, Send, Globe } from 'lucide-react-native';

export default function WhatsAppScreen() {
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Namaste from BusinessGPT! Your store connection is active.');
  const [sending, setSending] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => whatsappService.getStatus(),
  });

  const status = statusQuery.data;

  const handleSendTest = async () => {
    if (!testPhone.trim() || testPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setSending(true);
      const res = await whatsappService.sendTestMessage(testPhone.trim(), testMessage.trim());
      Alert.alert('Message Sent', res.message || 'WhatsApp message queued successfully!');
    } catch (err: any) {
      Alert.alert('Dispatch Error', err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={statusQuery.isRefetching}
          onRefresh={() => statusQuery.refetch()}
          tintColor={Colors.black}
        />
      }
    >
      {/* Connection Status Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <MessageSquare size={22} color={Colors.limeDark} />
            <View>
              <Text style={styles.title}>WhatsApp Business Gateway</Text>
              <Text style={styles.subtitle}>Meta Cloud Webhook Service</Text>
            </View>
          </View>
          <Badge
            label={status?.webhook_status === 'ACTIVE' || status?.is_connected ? 'CONNECTED' : 'STANDBY'}
            variant={status?.webhook_status === 'ACTIVE' || status?.is_connected ? 'lime' : 'amber'}
          />
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Webhook Tunnel</Text>
          <Text style={styles.infoVal}>Active (Cloud Router)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Auto Receipt Sharing</Text>
          <Text style={styles.infoVal}>Enabled on POS Checkout</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Udhar Reminders</Text>
          <Text style={styles.infoVal}>1-Click Direct WhatsApp API</Text>
        </View>
      </View>

      {/* Test Dispatch Card */}
      <View style={styles.card}>
        <Text style={styles.sectionHeading}>Send Test WhatsApp Message</Text>
        <Text style={styles.sectionDesc}>
          Verify that outgoing messages and customer notifications arrive properly on your phone.
        </Text>

        <Input
          label="Recipient Phone (10 digits) *"
          placeholder="e.g. 9876543210"
          keyboardType="phone-pad"
          maxLength={10}
          value={testPhone}
          onChangeText={setTestPhone}
        />

        <Input
          label="Test Message Content"
          placeholder="Message to send"
          multiline
          numberOfLines={3}
          value={testMessage}
          onChangeText={setTestMessage}
          style={{ height: 70, textAlignVertical: 'top' }}
        />

        <Button
          title="Send Test Message"
          variant="primary"
          loading={sending}
          icon={<Send size={16} color={Colors.black} />}
          onPress={handleSendTest}
        />
      </View>
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
  card: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 18,
    ...Shadows.brutalSm,
  },
  cardHeader: {
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
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textMain,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textDim,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textDim,
    fontWeight: '600',
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
});
