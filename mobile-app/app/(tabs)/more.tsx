import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Header from '../../components/ui/Header';
import OfflineBanner from '../../components/ui/OfflineBanner';
import useAuthStore from '../../store/authStore';
import {
  Users,
  TrendingUp,
  LineChart,
  FileText,
  Bell,
  MessageSquare,
  Settings,
  LogOut,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react-native';

const MENU_SECTIONS = [
  {
    title: 'Business Operations',
    items: [
      {
        title: 'Customer Ledger & Udhar',
        subtitle: 'Balances, credit limits & customer profiles',
        icon: <Users size={20} color={Colors.black} />,
        route: '/customers',
        badge: 'Khata',
      },
      {
        title: 'Sales & Revenue Analytics',
        subtitle: 'Breakdowns, margins & payment splits',
        icon: <TrendingUp size={20} color={Colors.black} />,
        route: '/analytics',
      },
      {
        title: 'AI Demand Forecasting',
        subtitle: 'Festival planning & predictive orders',
        icon: <LineChart size={20} color={Colors.black} />,
        route: '/forecasting',
      },
      {
        title: 'Dossier Business Reports',
        subtitle: 'Daily & monthly executive PDF/CSV downloads',
        icon: <FileText size={20} color={Colors.black} />,
        route: '/reports',
      },
    ],
  },
  {
    title: 'System & Connectivity',
    items: [
      {
        title: 'Action Alerts',
        subtitle: 'Stockouts, expiring items, unpaid dues',
        icon: <Bell size={20} color={Colors.black} />,
        route: '/alerts',
      },
      {
        title: 'WhatsApp Integration',
        subtitle: 'Webhook status, receipts & messaging',
        icon: <MessageSquare size={20} color={Colors.black} />,
        route: '/whatsapp',
      },
      {
        title: 'Store Settings',
        subtitle: 'POS validation, currency, language & tax',
        icon: <Settings size={20} color={Colors.black} />,
        route: '/settings',
      },
    ],
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const { user, store, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to sign out from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Menu & Tools" subtitle="All Store Operations" />
      <OfflineBanner />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* User Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{user?.name || 'Store Manager'}</Text>
            <Text style={styles.userRole}>
              Role: {user?.role || 'OWNER'} · {user?.email}
            </Text>
            <Text style={styles.storeName}>Store: {store?.name || 'BusinessGPT Store'}</Text>
          </View>
        </View>

        {/* Menu Sections */}
        {MENU_SECTIONS.map((sec, sIdx) => (
          <View key={sIdx} style={styles.section}>
            <Text style={styles.sectionTitle}>{sec.title}</Text>
            <View style={styles.menuBox}>
              {sec.items.map((item, iIdx) => (
                <TouchableOpacity
                  key={iIdx}
                  onPress={() => router.push(item.route as any)}
                  style={[
                    styles.menuItem,
                    iIdx < sec.items.length - 1 && styles.menuItemBorder,
                  ]}
                >
                  <View style={styles.menuLeft}>
                    <View style={styles.iconBox}>{item.icon}</View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.itemTitleRow}>
                        <Text style={styles.itemTitle}>{item.title}</Text>
                        {item.badge && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{item.badge}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={Colors.textDim} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Log Out */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <LogOut size={18} color={Colors.redDark} />
          <Text style={styles.logoutText}>Sign Out from Store</Text>
        </TouchableOpacity>

        <View style={styles.versionInfo}>
          <Text style={styles.versionText}>
            BusinessGPT Mobile v1.0.0 · Unified Engine
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmBg,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    ...Shadows.brutalSm,
  },
  profileInfo: {
    gap: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textMain,
  },
  userRole: {
    fontSize: 12,
    color: Colors.textDim,
    fontWeight: '600',
  },
  storeName: {
    fontSize: 13,
    color: Colors.limeDark,
    fontWeight: '800',
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingLeft: 4,
  },
  menuBox: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    ...Shadows.brutalSm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  badge: {
    backgroundColor: Colors.lime,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.black,
  },
  itemSubtitle: {
    fontSize: 11,
    color: Colors.textDim,
    marginTop: 2,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.redBg,
    borderWidth: 2,
    borderColor: Colors.redDark,
    borderRadius: 8,
    paddingVertical: 14,
    marginTop: 10,
    ...Shadows.brutalSm,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.redDark,
  },
  versionInfo: {
    alignItems: 'center',
    marginTop: 24,
  },
  versionText: {
    fontSize: 11,
    color: Colors.textDim,
  },
});
