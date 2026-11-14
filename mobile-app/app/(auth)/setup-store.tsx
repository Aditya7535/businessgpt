import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import authService from '../../services/auth.service';
import useAuthStore from '../../store/authStore';

export default function SetupStoreScreen() {
  const router = useRouter();
  const { initialize } = useAuthStore();

  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('Retail Kirana / Grocery');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!storeName.trim() || !ownerName.trim() || !email.trim() || !password) {
      Alert.alert('Required Fields', 'Please fill in Store Name, Owner Name, Email, and Password.');
      return;
    }

    try {
      setLoading(true);
      await authService.register({
        name: ownerName.trim(),
        email: email.trim(),
        password,
        role: 'OWNER',
        store_name: storeName.trim(),
        phone: phone.trim() || undefined,
      });

      await initialize();
      Alert.alert('Store Created', 'Your store has been successfully configured!', [
        { text: 'Start Managing', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (err: any) {
      Alert.alert('Setup Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>Configure Store Profile</Text>
          <Text style={styles.subtitle}>
            One account connects both this mobile app and your web dashboard.
          </Text>

          <Input
            label="Shop / Business Name *"
            placeholder="e.g. Laxmi Supermarket"
            value={storeName}
            onChangeText={setStoreName}
          />

          <Input
            label="Owner Full Name *"
            placeholder="e.g. Rajesh Sharma"
            value={ownerName}
            onChangeText={setOwnerName}
          />

          <Input
            label="Business Category"
            placeholder="e.g. Grocery, Pharmacy, Apparel, Hardware"
            value={category}
            onChangeText={setCategory}
          />

          <Input
            label="Email Address (Login ID) *"
            placeholder="rajesh@laxmistore.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Input
            label="Account Password *"
            placeholder="Minimum 6 characters"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Input
            label="Phone Number"
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Input
            label="GSTIN / Tax ID (Optional)"
            placeholder="27AAAAA0000A1Z5"
            autoCapitalize="characters"
            value={gstin}
            onChangeText={setGstin}
          />

          <Input
            label="Shop Address / Market Location"
            placeholder="Shop 4, Main Bazaar, Pune"
            value={address}
            onChangeText={setAddress}
          />

          <Button
            title="Complete Setup & Launch"
            variant="primary"
            size="lg"
            loading={loading}
            onPress={handleRegister}
            style={styles.btn}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmBg,
  },
  scroll: {
    padding: 20,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 20,
    ...Shadows.brutal,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textMain,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 20,
  },
  btn: {
    marginTop: 12,
  },
});
