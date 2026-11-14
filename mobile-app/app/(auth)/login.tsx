import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Button from '../../components/ui/Button';
import useAuthStore from '../../store/authStore';
import { apiClient, updateApiBaseUrl } from '../../services/api';
import Config, { CLOUD_BACKEND_URL, LOCAL_LAN_URL, LOCAL_DEV_URL } from '../../constants/config';
import { Crown, Boxes, ShoppingCart, Delete, ArrowRight, ShieldCheck, Globe } from 'lucide-react-native';

const ROLES = [
  {
    id: 'OWNER',
    title: 'Store Owner',
    subtitle: 'Aditya (Owner) · Full Access',
    defaultPin: '1111',
    icon: <Crown size={22} color={Colors.black} />,
  },
  {
    id: 'MANAGER',
    title: 'Store Manager',
    subtitle: 'Rajesh (Manager) · Stock & Audits',
    defaultPin: '2222',
    icon: <Boxes size={22} color={Colors.black} />,
  },
  {
    id: 'EMPLOYEE',
    title: 'Counter Staff',
    subtitle: 'Pooja (Counter) · POS Register',
    defaultPin: '3333',
    icon: <ShoppingCart size={22} color={Colors.black} />,
  },
];

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [selectedRole, setSelectedRole] = useState<'OWNER' | 'MANAGER' | 'EMPLOYEE'>('OWNER');
  const [pin, setPin] = useState('');
  const [currentUrl, setCurrentUrl] = useState<string>(
    apiClient.defaults.baseURL || Config.API_URL || CLOUD_BACKEND_URL
  );

  const activeRoleData = ROLES.find((r) => r.id === selectedRole) || ROLES[0];

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleSwitchUrl = async (newUrl: string) => {
    await updateApiBaseUrl(newUrl);
    setCurrentUrl(newUrl);
    clearError();
  };

  const handleQuickLogin = async (role: any, quickPin: string) => {
    setSelectedRole(role);
    setPin(quickPin);
    clearError();
    const success = await login({
      role,
      pin: quickPin,
    });
    if (success) {
      router.replace('/(tabs)');
    }
  };

  const handleSubmit = async () => {
    if (pin.length < 4) {
      Alert.alert('PIN Required', 'Please enter your 4-digit security PIN.');
      return;
    }

    clearError();
    const success = await login({
      role: selectedRole,
      pin,
    });

    if (success) {
      router.replace('/(tabs)');
    } else {
      setPin('');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Backend Connection Target Selector */}
      <View style={styles.connectionCard}>
        <View style={styles.connectionHeader}>
          <Globe size={14} color={Colors.black} />
          <Text style={styles.connectionTitle}>Target Backend URL:</Text>
          <Text style={styles.currentUrlText} numberOfLines={1}>
            {currentUrl}
          </Text>
        </View>

        <View style={styles.urlChipsRow}>
          <TouchableOpacity
            onPress={() => handleSwitchUrl(CLOUD_BACKEND_URL)}
            style={[
              styles.urlChip,
              currentUrl === CLOUD_BACKEND_URL && styles.urlChipActive,
            ]}
          >
            <Text
              style={[
                styles.urlChipText,
                currentUrl === CLOUD_BACKEND_URL && styles.urlChipTextActive,
              ]}
            >
              Cloud Tunnel (Phones)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSwitchUrl(LOCAL_LAN_URL)}
            style={[
              styles.urlChip,
              currentUrl === LOCAL_LAN_URL && styles.urlChipActive,
            ]}
          >
            <Text
              style={[
                styles.urlChipText,
                currentUrl === LOCAL_LAN_URL && styles.urlChipTextActive,
              ]}
            >
              Wi-Fi (192.168.1.8)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSwitchUrl(LOCAL_DEV_URL)}
            style={[
              styles.urlChip,
              currentUrl === LOCAL_DEV_URL && styles.urlChipActive,
            ]}
          >
            <Text
              style={[
                styles.urlChipText,
                currentUrl === LOCAL_DEV_URL && styles.urlChipTextActive,
              ]}
            >
              Localhost
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Role Selection Cards */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Select Your Role</Text>
      </View>

      <View style={styles.rolesGrid}>
        {ROLES.map((r) => {
          const isSelected = selectedRole === r.id;
          return (
            <TouchableOpacity
              key={r.id}
              activeOpacity={0.8}
              onPress={() => {
                setSelectedRole(r.id as any);
                setPin('');
              }}
              style={[
                styles.roleCard,
                isSelected && styles.roleCardActive,
              ]}
            >
              <View style={styles.roleIconBox}>{r.icon}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.roleTitle}>{r.title}</Text>
                <Text style={styles.roleSub}>{r.subtitle}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleQuickLogin(r.id, r.defaultPin)}
                style={styles.quickTapBtn}
              >
                <Text style={styles.quickTapText}>1-TAP PIN: {r.defaultPin}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* PIN Pad Console */}
      <View style={styles.pinConsole}>
        <View style={styles.consoleHeader}>
          <Text style={styles.consoleTitle}>
            Enter 4-Digit Security PIN
          </Text>
          <Text style={styles.consoleRoleTag}>
            Logging in as {activeRoleData.title} (PIN: {activeRoleData.defaultPin})
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* 4 PIN Indicators */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((idx) => {
            const filled = pin.length > idx;
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  filled && styles.dotFilled,
                ]}
              >
                {filled && <Text style={styles.dotText}>●</Text>}
              </View>
            );
          })}
        </View>

        {/* Numeric Keypad (1 to 9, Clear, 0, Backspace) */}
        <View style={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <TouchableOpacity
              key={digit}
              onPress={() => handleKeyPress(digit)}
              style={styles.keyBtn}
            >
              <Text style={styles.keyText}>{digit}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={handleClear} style={[styles.keyBtn, styles.fnKey]}>
            <Text style={styles.fnKeyText}>CLR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleKeyPress('0')}
            style={styles.keyBtn}
          >
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleBackspace} style={[styles.keyBtn, styles.fnKey]}>
            <Delete size={20} color={Colors.black} />
          </TouchableOpacity>
        </View>

        <Button
          title={`Sign In as ${activeRoleData.title}`}
          variant="primary"
          size="lg"
          loading={isLoading}
          disabled={pin.length < 4}
          onPress={handleSubmit}
          icon={<ArrowRight size={18} color={Colors.black} />}
          style={styles.submitBtn}
        />
      </View>

      <View style={styles.securityFooter}>
        <ShieldCheck size={14} color={Colors.textDim} />
        <Text style={styles.securityText}>
          Connected to BusinessGPT Store Engine · SQLite / PostgreSQL
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmBg,
  },
  scroll: {
    padding: 16,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  connectionCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    ...Shadows.brutalSm,
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  connectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
  },
  currentUrlText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.limeDark,
    flex: 1,
  },
  urlChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  urlChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    alignItems: 'center',
  },
  urlChipActive: {
    backgroundColor: Colors.lime,
    borderWidth: 2,
  },
  urlChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMain,
  },
  urlChipTextActive: {
    fontWeight: '900',
    color: Colors.black,
  },
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rolesGrid: {
    gap: 10,
    marginBottom: 16,
  },
  roleCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Shadows.brutalSm,
  },
  roleCardActive: {
    backgroundColor: Colors.limeBg,
    borderColor: Colors.black,
    borderWidth: 2.5,
  },
  roleIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  roleSub: {
    fontSize: 11,
    color: Colors.textDim,
    marginTop: 2,
  },
  quickTapBtn: {
    backgroundColor: Colors.black,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  quickTapText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.lime,
  },
  pinConsole: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 18,
    ...Shadows.brutal,
  },
  consoleHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  consoleTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  consoleRoleTag: {
    fontSize: 11,
    color: Colors.textDim,
    marginTop: 2,
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: Colors.redBg,
    borderWidth: 1.5,
    borderColor: Colors.redDark,
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  errorText: {
    color: Colors.redDark,
    fontSize: 12,
    fontWeight: '700',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginVertical: 14,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFilled: {
    backgroundColor: Colors.lime,
    borderColor: Colors.black,
  },
  dotText: {
    fontSize: 14,
    color: Colors.black,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginVertical: 10,
  },
  keyBtn: {
    width: '30%',
    height: 52,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.brutalSm,
  },
  keyText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textMain,
  },
  fnKey: {
    backgroundColor: Colors.warmBg,
  },
  fnKeyText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textDim,
  },
  submitBtn: {
    marginTop: 14,
  },
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  securityText: {
    fontSize: 11,
    color: Colors.textDim,
  },
});
