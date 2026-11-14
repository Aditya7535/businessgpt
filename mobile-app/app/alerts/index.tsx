import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import alertsService from '../../services/alerts.service';
import { BusinessAlert } from '../../types';
import { Bell, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react-native';

export default function AlertsScreen() {
  const alertsQuery = useQuery({
    queryKey: ['pending-alerts'],
    queryFn: () => alertsService.getPendingAlerts(),
  });

  const alerts = alertsQuery.data || [];

  const handleDismiss = async (id: string | number) => {
    try {
      await alertsService.dismissAlert(String(id));
      alertsQuery.refetch();
    } catch {
      // Refresh list
      alertsQuery.refetch();
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return <Badge label="CRITICAL" variant="red" size="sm" />;
      case 'MEDIUM':
        return <Badge label="WARNING" variant="amber" size="sm" />;
      default:
        return <Badge label="INFO" variant="neutral" size="sm" />;
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={alertsQuery.isRefetching}
            onRefresh={() => alertsQuery.refetch()}
            tintColor={Colors.black}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.alertCard}>
            <View style={styles.cardHeader}>
              <View style={styles.titleRow}>
                <ShieldAlert
                  size={18}
                  color={item.severity === 'HIGH' ? Colors.redDark : Colors.black}
                />
                <Text style={styles.alertTitle}>{item.title}</Text>
              </View>
              {getSeverityBadge(item.severity)}
            </View>

            <Text style={styles.alertMessage}>{item.message}</Text>

            <View style={styles.cardFooter}>
              <Text style={styles.alertTime}>{item.created_at}</Text>
              <TouchableOpacity
                onPress={() => handleDismiss(item.id)}
                style={styles.dismissBtn}
              >
                <Text style={styles.dismissText}>Mark Handled</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <CheckCircle size={36} color={Colors.limeDark} />
            <Text style={styles.emptyTitle}>All Systems & Inventory Healthy</Text>
            <Text style={styles.emptySub}>
              No critical alerts or pending stockout warnings right now.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmBg,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  alertCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    ...Shadows.brutalSm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  alertMessage: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: Colors.borderLight,
  },
  alertTime: {
    fontSize: 11,
    color: Colors.textDim,
  },
  dismissBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  dismissText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.black,
    textDecorationLine: 'underline',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.textDim,
    textAlign: 'center',
  },
});
