import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Header from '../../components/ui/Header';
import OfflineBanner from '../../components/ui/OfflineBanner';
import MetricCard from '../../components/ui/MetricCard';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import analyticsService from '../../services/analytics.service';
import inventoryService from '../../services/inventory.service';
import posService from '../../services/pos.service';
import alertsService from '../../services/alerts.service';
import {
  TrendingUp,
  Receipt,
  Boxes,
  AlertTriangle,
  Sparkles,
  Plus,
  ArrowRight,
  ShoppingBag,
  Mic,
} from 'lucide-react-native';

export default function DashboardScreen() {
  const router = useRouter();

  // Queries
  const salesQuery = useQuery({
    queryKey: ['sales-overview'],
    queryFn: () => analyticsService.getSalesOverview(),
  });

  const inventorySummaryQuery = useQuery({
    queryKey: ['inventory-summary'],
    queryFn: () => inventoryService.getSummary(),
  });

  const todayBillsQuery = useQuery({
    queryKey: ['today-bills'],
    queryFn: () => posService.getTodayBills(),
  });

  const alertsQuery = useQuery({
    queryKey: ['pending-alerts'],
    queryFn: () => alertsService.getPendingAlerts(),
  });

  const isRefreshing =
    salesQuery.isRefetching ||
    inventorySummaryQuery.isRefetching ||
    todayBillsQuery.isRefetching ||
    alertsQuery.isRefetching;

  const onRefresh = () => {
    salesQuery.refetch();
    inventorySummaryQuery.refetch();
    todayBillsQuery.refetch();
    alertsQuery.refetch();
  };

  const salesData = salesQuery.data;
  const invData = inventorySummaryQuery.data;
  const billsData = todayBillsQuery.data;
  const alertsData = alertsQuery.data || [];

  return (
    <View style={styles.container}>
      <Header />
      <OfflineBanner />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.black}
          />
        }
      >
        {/* Quick Launchpad Buttons */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/pos')}
            style={[styles.actionBtn, { backgroundColor: Colors.lime }]}
          >
            <ShoppingBag size={20} color={Colors.black} />
            <Text style={styles.actionBtnText}>New POS Bill</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/chat')}
            style={[styles.actionBtn, { backgroundColor: Colors.lavender }]}
          >
            <Mic size={20} color={Colors.black} />
            <Text style={styles.actionBtnText}>Voice Stock</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(tabs)/inventory')}
            style={[styles.actionBtn, { backgroundColor: Colors.white }]}
          >
            <Plus size={20} color={Colors.black} />
            <Text style={styles.actionBtnText}>Stock List</Text>
          </TouchableOpacity>
        </View>

        {/* AI Insight Card */}
        <View style={styles.aiInsightCard}>
          <View style={styles.aiHeader}>
            <View style={styles.aiBadge}>
              <Sparkles size={14} color={Colors.black} />
              <Text style={styles.aiBadgeText}>AI Daily Intelligence</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/chat')}>
              <Text style={styles.askAiLink}>Ask AI &rarr;</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.aiText}>
            {alertsData.length > 0
              ? alertsData[0].message
              : 'Your store metrics are syncing live. Ask the AI assistant about today\'s top-moving items or fast inventory updates.'}
          </Text>
        </View>

        {/* Core Financial & Inventory Metrics */}
        <View style={styles.metricsGrid}>
          <MetricCard
            label="Today's Sales"
            value={formatCurrency(salesData?.today_sales ?? billsData?.total_revenue ?? 0)}
            subtitle={
              salesData?.change_percentage !== undefined
                ? `${salesData.change_percentage >= 0 ? '+' : ''}${salesData.change_percentage}% vs yesterday`
                : 'Live transactions'
            }
            icon={<TrendingUp size={16} color={Colors.limeDark} />}
            variant="lime"
          />

          <MetricCard
            label="Bills Today"
            value={String(billsData?.total_bills ?? salesData?.total_transactions ?? 0)}
            subtitle="Counter sales recorded"
            icon={<Receipt size={16} color={Colors.black} />}
            variant="white"
          />
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard
            label="Stock Valuation"
            value={formatCurrency(invData?.total_valuation ?? 0)}
            subtitle={`${invData?.total_products ?? 0} total products`}
            icon={<Boxes size={16} color={Colors.blueDark} />}
            variant="white"
          />

          <MetricCard
            label="Low / Out of Stock"
            value={`${(invData?.low_stock_count ?? 0) + (invData?.out_of_stock_count ?? 0)}`}
            subtitle={`${invData?.out_of_stock_count ?? 0} completely out`}
            icon={<AlertTriangle size={16} color={Colors.redDark} />}
            variant="amber"
          />
        </View>

        {/* Today's Recent Bills */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent POS Bills Today</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/pos')}>
              <Text style={styles.seeAllText}>Open Register &rarr;</Text>
            </TouchableOpacity>
          </View>

          {billsData?.bills && billsData.bills.length > 0 ? (
            billsData.bills.slice(0, 5).map((bill) => (
              <View key={bill.id} style={styles.billItem}>
                <View>
                  <Text style={styles.billNumber}>#{bill.bill_number}</Text>
                  <Text style={styles.billMeta}>
                    {bill.customer_name || 'Walk-in Customer'} · {formatDateTime(bill.created_at)}
                  </Text>
                </View>
                <View style={styles.billRight}>
                  <Text style={styles.billAmount}>{formatCurrency(bill.total_amount)}</Text>
                  <Badge label={bill.payment_method} size="sm" variant="neutral" />
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyBills}>
              <Receipt size={24} color={Colors.textDim} />
              <Text style={styles.emptyBillsText}>No sales recorded yet today.</Text>
            </View>
          )}
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
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Shadows.brutalSm,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.black,
  },
  aiInsightCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    ...Shadows.brutalSm,
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.lavender,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.black,
    textTransform: 'uppercase',
  },
  askAiLink: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.lavenderDark,
  },
  aiText: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textMain,
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  section: {
    marginTop: 8,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    ...Shadows.brutalSm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.black,
  },
  billItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  billNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  billMeta: {
    fontSize: 11,
    color: Colors.textDim,
    marginTop: 2,
  },
  billRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  billAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  emptyBills: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyBillsText: {
    fontSize: 12,
    color: Colors.textDim,
  },
});
