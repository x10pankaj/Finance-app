import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { getDashboard } from '../../src/api';
import { DashboardData } from '../../src/types';
import { useAppStore } from '../../src/store';
import { CurrencyToggle } from '../../src/components/CurrencyToggle';
import { StatCard, Card } from '../../src/components/Card';

const COLORS = ['#4CAF50','#2196F3','#FF9800','#E91E63','#9C27B0','#00BCD4','#FFEB3B','#795548','#607D8B','#F44336'];

export default function DashboardScreen() {
  const { currency, theme, dataVersion } = useAppStore();
  const c = theme.colors;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const dashboard = await getDashboard(currency);
      setData(dashboard);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [currency, dataVersion]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const formatCurrency = (amount: number) => {
    const symbol = currency === 'USD' ? '$' : '₹';
    if (amount >= 1000000) return `${symbol}${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${symbol}${(amount / 1000).toFixed(1)}K`;
    return `${symbol}${amount.toFixed(0)}`;
  };

  const getPieChartData = () => {
    if (!data || Object.keys(data.expenses_by_category).length === 0) return [];
    return Object.entries(data.expenses_by_category).map(([name, value], index) => ({
      value,
      color: COLORS[index % COLORS.length],
      text: name,
      focused: index === 0,
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: c.textSecondary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pieData = getPieChartData();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: c.text }]}>Budget Overview</Text>
            <Text style={[styles.year, { color: c.textSecondary }]}>{data?.current_year}</Text>
          </View>
          <View style={styles.headerActions}>
            <CurrencyToggle />
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard title="Total Income" value={formatCurrency(data?.totals.income || 0)} icon="cash-outline" color={c.income} />
          <View style={{ width: 12 }} />
          <StatCard title="Net Expenses" value={formatCurrency(data?.totals.net_expenses || 0)} icon="wallet-outline" color={c.expense} />
        </View>
        <View style={styles.statsRow}>
          <StatCard title="Investments" value={formatCurrency(data?.totals.investments || 0)} icon="trending-up-outline" color={c.investment} />
          <View style={{ width: 12 }} />
          <StatCard title="Net Savings" value={formatCurrency(data?.totals.net_savings || 0)} icon="save-outline" color={data?.totals.net_savings && data.totals.net_savings >= 0 ? c.income : c.expense} />
        </View>

        <Card style={styles.countsCard}>
          <Text style={[styles.cardTitle, { color: c.text }]}>Your Budget Items</Text>
          <View style={styles.countsRow}>
            <View style={styles.countItem}>
              <View style={[styles.countIcon, { backgroundColor: c.statusCard2 }]}>
                <Ionicons name="receipt-outline" size={20} color={c.expense} />
              </View>
              <Text style={[styles.countValue, { color: c.text }]}>{data?.counts.expenses || 0}</Text>
              <Text style={[styles.countLabel, { color: c.textSecondary }]}>Expenses</Text>
            </View>
            <View style={styles.countItem}>
              <View style={[styles.countIcon, { backgroundColor: c.statusCard1 }]}>
                <Ionicons name="briefcase-outline" size={20} color={c.income} />
              </View>
              <Text style={[styles.countValue, { color: c.text }]}>{data?.counts.income_sources || 0}</Text>
              <Text style={[styles.countLabel, { color: c.textSecondary }]}>Income</Text>
            </View>
            <View style={styles.countItem}>
              <View style={[styles.countIcon, { backgroundColor: c.statusCard3 }]}>
                <Ionicons name="pie-chart-outline" size={20} color={c.investment} />
              </View>
              <Text style={[styles.countValue, { color: c.text }]}>{data?.counts.investments || 0}</Text>
              <Text style={[styles.countLabel, { color: c.textSecondary }]}>Investments</Text>
            </View>
          </View>
        </Card>

        {pieData.length > 0 && (
          <Card>
            <Text style={[styles.cardTitle, { color: c.text }]}>Expenses by Category</Text>
            <View style={styles.chartContainer}>
              <PieChart
                data={pieData}
                donut
                radius={80}
                innerRadius={50}
                innerCircleColor={c.card}
                centerLabelComponent={() => (
                  <View style={styles.centerLabel}>
                    <Text style={[styles.centerLabelText, { color: c.textSecondary }]}>Total</Text>
                    <Text style={[styles.centerLabelValue, { color: c.text }]}>{formatCurrency(data?.totals.expenses_debit || 0)}</Text>
                  </View>
                )}
              />
            </View>
            <View style={styles.legendContainer}>
              {pieData.map((item, index) => (
                <View key={index} style={[styles.legendItem, { borderBottomColor: c.surface }]}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.legendText, { color: c.text }]} numberOfLines={1}>{item.text}</Text>
                  <Text style={[styles.legendValue, { color: c.text }]}>{formatCurrency(item.value)}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {pieData.length === 0 && (
          <Card>
            <View style={styles.emptyChart}>
              <Ionicons name="pie-chart-outline" size={48} color={c.textMuted} />
              <Text style={[styles.emptyChartText, { color: c.text }]}>No expense data yet</Text>
              <Text style={[styles.emptyChartSubtext, { color: c.textSecondary }]}>Add expenses to see category breakdown</Text>
            </View>
          </Card>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 24 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greeting: { fontSize: 26, fontWeight: 'bold' },
  year: { fontSize: 16, marginTop: 4 },
  statsRow: { flexDirection: 'row', marginBottom: 12 },
  countsCard: { marginTop: 4 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  countsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  countItem: { alignItems: 'center' },
  countIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  countValue: { fontSize: 24, fontWeight: 'bold' },
  countLabel: { fontSize: 13, marginTop: 4 },
  chartContainer: { alignItems: 'center', marginVertical: 16 },
  centerLabel: { alignItems: 'center' },
  centerLabelText: { fontSize: 12 },
  centerLabelValue: { fontSize: 16, fontWeight: 'bold' },
  legendContainer: { marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  legendText: { flex: 1, fontSize: 14 },
  legendValue: { fontSize: 14, fontWeight: '600' },
  emptyChart: { alignItems: 'center', paddingVertical: 32 },
  emptyChartText: { fontSize: 16, fontWeight: '600', marginTop: 16 },
  emptyChartSubtext: { fontSize: 14, marginTop: 4 },
});
