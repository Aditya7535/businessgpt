import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { formatCurrency } from '../../utils/formatters';
import analyticsService from '../../services/analytics.service';
import { Sparkles, Calendar, TrendingUp, AlertCircle, ShoppingCart } from 'lucide-react-native';

export default function ForecastingScreen() {
  const [forecastDays, setForecastDays] = useState(7);

  const forecastQuery = useQuery({
    queryKey: ['sales-forecast', forecastDays],
    queryFn: () => analyticsService.getSalesForecast(forecastDays),
  });

  const data = forecastQuery.data;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={forecastQuery.isRefetching}
          onRefresh={() => forecastQuery.refetch()}
          tintColor={Colors.black}
        />
      }
    >
      {/* Time Horizon Selector */}
      <View style={styles.horizonRow}>
        {[7, 14, 30].map((d) => (
          <TouchableOpacity
            key={d}
            onPress={() => setForecastDays(d)}
            style={[
              styles.horizonBtn,
              forecastDays === d && styles.horizonBtnActive,
            ]}
          >
            <Text
              style={[
                styles.horizonText,
                forecastDays === d && styles.horizonTextActive,
              ]}
            >
              {d} Days Projections
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* AI Forecast Summary Banner */}
      <View style={styles.summaryCard}>
        <View style={styles.badgeRow}>
          <View style={styles.aiBadge}>
            <Sparkles size={14} color={Colors.black} />
            <Text style={styles.aiBadgeText}>AI Demand Model</Text>
          </View>
          <Text style={styles.horizonLabel}>Next {forecastDays} Days</Text>
        </View>

        <Text style={styles.summaryTitle}>
          Projected Sales: {formatCurrency(data?.projected_revenue ?? 245000)}
        </Text>
        <Text style={styles.summaryDesc}>
          Based on 90-day moving averages, seasonal shopping patterns, and local market trends.
        </Text>
      </View>

      {/* Festival Spike Alert */}
      <View style={styles.festivalCard}>
        <View style={styles.festHeader}>
          <Calendar size={18} color={Colors.black} />
          <Text style={styles.festTitle}>Upcoming Seasonal Spike</Text>
        </View>
        <Text style={styles.festDesc}>
          Demand for sweets, dry fruits, gift packs, and cooking oil is projected to surge by +35% over the next two weeks.
        </Text>
      </View>

      {/* Recommended Purchase Orders */}
      <View style={styles.reorderCard}>
        <View style={styles.reorderHeader}>
          <ShoppingCart size={18} color={Colors.black} />
          <Text style={styles.reorderTitle}>Recommended Reorders</Text>
        </View>

        <View style={styles.reorderItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prodName}>Tata Salt 1kg</Text>
            <Text style={styles.prodMeta}>Current stock: 8 units · Expected demand: 45 units</Text>
          </View>
          <Badge label="+40 Reorder" variant="lime" />
        </View>

        <View style={styles.reorderItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prodName}>Fortune Sunflower Oil 1L</Text>
            <Text style={styles.prodMeta}>Current stock: 4 units · Expected demand: 30 units</Text>
          </View>
          <Badge label="+30 Reorder" variant="lime" />
        </View>

        <View style={styles.reorderItem}>
          <View style={{ flex: 1 }}>
            <Text style={styles.prodName}>Aashirvaad Atta 5kg</Text>
            <Text style={styles.prodMeta}>Current stock: 12 units · Expected demand: 50 units</Text>
          </View>
          <Badge label="+40 Reorder" variant="lime" />
        </View>
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
  horizonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  horizonBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    alignItems: 'center',
  },
  horizonBtnActive: {
    backgroundColor: Colors.black,
  },
  horizonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  horizonTextActive: {
    color: Colors.white,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 18,
    ...Shadows.brutalSm,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  horizonLabel: {
    fontSize: 11,
    color: Colors.textDim,
    fontWeight: '700',
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textMain,
    marginBottom: 6,
  },
  summaryDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  festivalCard: {
    backgroundColor: Colors.limeBg,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    ...Shadows.brutalSm,
  },
  festHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  festTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.black,
    textTransform: 'uppercase',
  },
  festDesc: {
    fontSize: 13,
    color: Colors.black,
    lineHeight: 18,
    fontWeight: '500',
  },
  reorderCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    ...Shadows.brutalSm,
  },
  reorderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  reorderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
    textTransform: 'uppercase',
  },
  reorderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight,
  },
  prodName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textMain,
  },
  prodMeta: {
    fontSize: 11,
    color: Colors.textDim,
    marginTop: 2,
  },
});
