import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import MetricCard from '../../components/ui/MetricCard';
import Badge from '../../components/ui/Badge';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import analyticsService from '../../services/analytics.service';
import { TrendingUp, BarChart3, PieChart, ShoppingBag } from 'lucide-react-native';

export default function AnalyticsScreen() {
  const salesQuery = useQuery({
    queryKey: ['sales-overview'],
    queryFn: () => analyticsService.getSalesOverview(),
  });

  const trendsQuery = useQuery({
    queryKey: ['sales-trends'],
    queryFn: () => analyticsService.getTrends(7),
  });

  const categoriesQuery = useQuery({
    queryKey: ['category-breakdown'],
    queryFn: () => analyticsService.getCategories(),
  });

  const topProductsQuery = useQuery({
    queryKey: ['top-products'],
    queryFn: () => analyticsService.getTopProducts(5),
  });

  const isRefreshing =
    salesQuery.isRefetching ||
    trendsQuery.isRefetching ||
    categoriesQuery.isRefetching ||
    topProductsQuery.isRefetching;

  const onRefresh = () => {
    salesQuery.refetch();
    trendsQuery.refetch();
    categoriesQuery.refetch();
    topProductsQuery.refetch();
  };

  const sales = salesQuery.data;
  const trends = trendsQuery.data || [];
  const categories = categoriesQuery.data || [];
  const topProducts = topProductsQuery.data || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={Colors.black}
        />
      }
    >
      {/* Overview Cards */}
      <View style={styles.metricsRow}>
        <MetricCard
          label="Today's Revenue"
          value={formatCurrency(sales?.today_sales ?? 0)}
          subtitle={`${sales?.total_transactions ?? 0} transactions`}
          icon={<TrendingUp size={16} color={Colors.limeDark} />}
          variant="lime"
        />
        <MetricCard
          label="Avg Bill Size"
          value={formatCurrency(sales?.average_bill_value ?? 0)}
          subtitle={`Top method: ${sales?.top_payment_method ?? 'Cash'}`}
          icon={<BarChart3 size={16} color={Colors.black} />}
        />
      </View>

      {/* 7-Day Revenue Trend Bars */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <BarChart3 size={18} color={Colors.black} />
          <Text style={styles.cardTitle}>7-Day Sales Trend</Text>
        </View>

        {trends.length > 0 ? (
          <View style={styles.trendList}>
            {trends.map((t, idx) => (
              <View key={idx} style={styles.trendRow}>
                <Text style={styles.trendDate}>{t.date}</Text>
                <View style={styles.trendBarTrack}>
                  <View
                    style={[
                      styles.trendBarFill,
                      {
                        width: `${Math.min(
                          100,
                          Math.max(15, (t.revenue / (Math.max(...trends.map((x) => x.revenue)) || 1)) * 100)
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.trendAmount}>{formatCurrency(t.revenue)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No historical sales trend data available yet.</Text>
        )}
      </View>

      {/* Top Selling Products */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <ShoppingBag size={18} color={Colors.black} />
          <Text style={styles.cardTitle}>Top Moving Products</Text>
        </View>

        {topProducts.length > 0 ? (
          topProducts.map((p, idx) => (
            <View key={idx} style={styles.productRow}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{p.name}</Text>
                <Text style={styles.productQty}>{formatNumber(p.quantity_sold)} units sold</Text>
              </View>
              <Text style={styles.productRev}>{formatCurrency(p.revenue)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Top products will appear here after recording sales.</Text>
        )}
      </View>

      {/* Category Breakdown */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <PieChart size={18} color={Colors.black} />
          <Text style={styles.cardTitle}>Category Contribution</Text>
        </View>

        {categories.length > 0 ? (
          categories.map((c, idx) => (
            <View key={idx} style={styles.catRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.catName}>{c.category}</Text>
                <Text style={styles.catItems}>{c.items_sold} items</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.catRev}>{formatCurrency(c.revenue)}</Text>
                <Text style={styles.catPct}>{c.percentage}% of total</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No category distribution recorded yet.</Text>
        )}
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
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    ...Shadows.brutalSm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trendList: {
    gap: 10,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trendDate: {
    width: 60,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textDim,
  },
  trendBarTrack: {
    flex: 1,
    height: 14,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trendBarFill: {
    height: '100%',
    backgroundColor: Colors.lime,
  },
  trendAmount: {
    width: 80,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
    textAlign: 'right',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.limeBg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.black,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMain,
  },
  productQty: {
    fontSize: 11,
    color: Colors.textDim,
  },
  productRev: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  catName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
  },
  catItems: {
    fontSize: 11,
    color: Colors.textDim,
  },
  catRev: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  catPct: {
    fontSize: 11,
    color: Colors.limeDark,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textDim,
    fontStyle: 'italic',
  },
});
