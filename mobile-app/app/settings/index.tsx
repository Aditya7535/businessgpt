import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Config from '../../constants/config';
import settingsService from '../../services/settings.service';
import useAuthStore from '../../store/authStore';

export default function SettingsScreen() {
  const { store } = useAuthStore();
  const [storeName, setStoreName] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [requireCustomer, setRequireCustomer] = useState(false);
  const [enableVoice, setEnableVoice] = useState(true);
  const [saving, setSaving] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['store-settings'],
    queryFn: () => settingsService.getSettings(),
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setStoreName(settingsQuery.data.store_name || store?.name || '');
      setLowStockThreshold(String(settingsQuery.data.low_stock_threshold || 5));
      setRequireCustomer(Boolean(settingsQuery.data.pos_require_customer));
      setEnableVoice(settingsQuery.data.enable_voice !== false);
    }
  }, [settingsQuery.data]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await settingsService.updateSettings({
        store_name: storeName.trim(),
        low_stock_threshold: parseInt(lowStockThreshold, 10) || 5,
        pos_require_customer: requireCustomer,
        enable_voice: enableVoice,
      });
      await settingsQuery.refetch();
      Alert.alert('Settings Saved', 'Store configuration updated and synchronized across devices.');
    } catch (err: any) {
      Alert.alert('Save Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Store Profile Settings */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Store Profile</Text>

        <Input
          label="Business / Store Name"
          value={storeName}
          onChangeText={setStoreName}
        />

        <Input
          label="Default Currency"
          value="INR (₹) · Indian Rupee"
          editable={false}
        />

        <Input
          label="Low Stock Alert Threshold"
          keyboardType="numeric"
          value={lowStockThreshold}
          onChangeText={setLowStockThreshold}
          helper="Products at or below this count will trigger an urgent low-stock badge."
        />
      </View>

      {/* POS & Operational Rules */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>POS & Counter Rules</Text>

        <View style={styles.switchRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.switchLabel}>Require Customer on POS</Text>
            <Text style={styles.switchDesc}>
              Enforce selecting or creating a customer before completing any counter sale.
            </Text>
          </View>
          <Switch
            value={requireCustomer}
            onValueChange={setRequireCustomer}
            trackColor={{ false: Colors.borderLight, true: Colors.lime }}
            thumbColor={Colors.black}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.switchRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.switchLabel}>Enable Voice Assistant</Text>
            <Text style={styles.switchDesc}>
              Allow conversational inventory updates and microphone speech queries.
            </Text>
          </View>
          <Switch
            value={enableVoice}
            onValueChange={setEnableVoice}
            trackColor={{ false: Colors.borderLight, true: Colors.lime }}
            thumbColor={Colors.black}
          />
        </View>
      </View>

      {/* Server & Backend Diagnostics */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Backend Connection</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>FastAPI Endpoint</Text>
          <Text style={styles.metaVal}>{Config.API_URL}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Mobile App Engine</Text>
          <Text style={styles.metaVal}>Expo SDK 52 · TypeScript</Text>
        </View>
      </View>

      <Button
        title="Save & Sync Store Settings"
        variant="primary"
        size="lg"
        loading={saving}
        onPress={handleSave}
      />
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
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 18,
    ...Shadows.brutalSm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMain,
    marginBottom: 4,
  },
  switchDesc: {
    fontSize: 12,
    color: Colors.textDim,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  metaLabel: {
    fontSize: 12,
    color: Colors.textDim,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
});
