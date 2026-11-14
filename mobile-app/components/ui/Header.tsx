import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Colors from '../../constants/colors';
import useAuthStore from '../../store/authStore';
import useOfflineStore from '../../store/offlineStore';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  rightAction,
}) => {
  const { store } = useAuthStore();
  const { isOnline } = useOfflineStore();

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Image
          source={require('../../assets/logo_mark.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title || store?.name || 'BusinessGPT'}</Text>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? Colors.limeDark : Colors.redDark },
              ]}
            />
          </View>
          <Text style={styles.subtitle}>
            {subtitle || (store?.owner_name ? `Owner: ${store.owner_name}` : 'AI Business Partner')}
          </Text>
        </View>
      </View>
      {rightAction && <View style={styles.right}>{rightAction}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.warmBg,
    borderBottomWidth: 2,
    borderColor: Colors.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 38,
    height: 38,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.black,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textMain,
    letterSpacing: -0.3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default Header;
