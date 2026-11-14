import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../../constants/colors';
import useOfflineStore from '../../store/offlineStore';
import { WifiOff } from 'lucide-react-native';

export const OfflineBanner: React.FC = () => {
  const { isOnline, pendingAdjustmentsCount } = useOfflineStore();

  if (isOnline) return null;

  return (
    <View style={styles.banner}>
      <WifiOff size={16} color={Colors.white} />
      <Text style={styles.text}>
        Offline Mode Active · Showing cached data · Sales/Inventory sync paused
        {pendingAdjustmentsCount > 0 ? ` (${pendingAdjustmentsCount} pending)` : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
    borderBottomWidth: 2,
    borderColor: Colors.border,
  },
  text: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default OfflineBanner;
