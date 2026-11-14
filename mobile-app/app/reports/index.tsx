import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import reportsService from '../../services/reports.service';
import { FileText, Share2, DownloadCloud, CheckCircle } from 'lucide-react-native';

export default function ReportsScreen() {
  const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily');
  const [generating, setGenerating] = useState(false);

  const reportQuery = useQuery({
    queryKey: ['report', reportType],
    queryFn: () =>
      reportType === 'daily'
        ? reportsService.getDailyReport()
        : reportsService.getMonthlyReport(),
  });

  const report = reportQuery.data;

  const handleShareReport = async () => {
    if (!report) return;
    try {
      const summary = `*BUSINESSGPT STORE DOSSIER (${report.period})*\n\n` +
        `Revenue: ${formatCurrency(report.total_revenue)}\n` +
        `Orders: ${formatNumber(report.total_orders)}\n` +
        `Avg Order Value: ${formatCurrency(report.average_order_value)}\n\n` +
        `Generated on: ${report.date_generated}`;

      await Share.share({
        message: summary,
        title: `${report.title} Report`,
      });
    } catch {
      // Dismissed
    }
  };

  const handleGenerateFresh = async () => {
    try {
      setGenerating(true);
      await reportsService.generateReport(reportType);
      await reportQuery.refetch();
      Alert.alert('Report Ready', 'Executive business dossier updated successfully.');
    } catch (err: any) {
      Alert.alert('Generation Error', err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={reportQuery.isRefetching}
          onRefresh={() => reportQuery.refetch()}
          tintColor={Colors.black}
        />
      }
    >
      {/* Type Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          onPress={() => setReportType('daily')}
          style={[
            styles.toggleBtn,
            reportType === 'daily' && styles.toggleBtnActive,
          ]}
        >
          <Text
            style={[
              styles.toggleText,
              reportType === 'daily' && styles.toggleTextActive,
            ]}
          >
            Daily Store Closing
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setReportType('monthly')}
          style={[
            styles.toggleBtn,
            reportType === 'monthly' && styles.toggleBtnActive,
          ]}
        >
          <Text
            style={[
              styles.toggleText,
              reportType === 'monthly' && styles.toggleTextActive,
            ]}
          >
            Monthly Dossier
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Report Card */}
      <View style={styles.reportCard}>
        <View style={styles.reportHeader}>
          <View>
            <Text style={styles.reportTitle}>
              {report?.title || `${reportType === 'daily' ? 'Daily' : 'Monthly'} Financial Dossier`}
            </Text>
            <Text style={styles.reportPeriod}>{report?.period || 'Live Session'}</Text>
          </View>
          <Badge label="OFFICIAL DOSSIER" variant="lime" />
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Sales</Text>
            <Text style={styles.statVal}>{formatCurrency(report?.total_revenue ?? 0)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Bills</Text>
            <Text style={styles.statVal}>{formatNumber(report?.total_orders ?? 0)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Avg Bill Size</Text>
            <Text style={styles.statVal}>{formatCurrency(report?.average_order_value ?? 0)}</Text>
          </View>
        </View>

        {report?.executive_summary && (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Executive Audit Summary</Text>
            <Text style={styles.summaryText}>{report.executive_summary}</Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <Button
            title="Share Dossier"
            variant="outline"
            icon={<Share2 size={16} color={Colors.black} />}
            onPress={handleShareReport}
            style={{ flex: 1 }}
          />
          <Button
            title="Generate Fresh"
            variant="primary"
            loading={generating}
            icon={<DownloadCloud size={16} color={Colors.black} />}
            onPress={handleGenerateFresh}
            style={{ flex: 1.2 }}
          />
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
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Colors.black,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  toggleTextActive: {
    color: Colors.white,
  },
  reportCard: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 20,
    ...Shadows.brutalSm,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textMain,
  },
  reportPeriod: {
    fontSize: 12,
    color: Colors.textDim,
    marginTop: 2,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.warmBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
  },
  statVal: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textMain,
    marginTop: 4,
  },
  summaryBox: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
