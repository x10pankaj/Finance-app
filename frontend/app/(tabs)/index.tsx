import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { getDashboard } from '../../src/api';
import { DashboardData, Currency } from '../../src/types';
import { useAppStore } from '../../src/store';
import { CurrencyToggle } from '../../src/components/CurrencyToggle';
import { StatCard, Card } from '../../src/components/Card';

const { width } = Dimensions.get('window');

const COLORS = [
  '#4CAF50',
  '#2196F3',
  '#FF9800',
  '#E91E63',
  '#9C27B0',
  '#00BCD4',
  '#FFEB3B',
  '#795548',
  '#607D8B',
  '#F44336',
];

export default function DashboardScreen() {
  const { currency } = useAppStore();
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

  useEffect(() => {
    loadData();
  }, [currency]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatCurrency = (amount: number) => {
    const symbol = currency === 'USD' ? '$' : '₹';
    if (amount >= 1000000) {
      return `${symbol}${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${symbol}${(amount / 1000).toFixed(1)}K`;
    }
    return `${symbol}${amount.toFixed(0)}`;
  };

  const getPieChartData = () => {
    if (!data || Object.keys(data.expenses_by_category).length === 0) {
      return [];
    }
    return Object.entries(data.expenses_by_category).map(([name, value], index) => ({
      value,
      color: COLORS[index % COLORS.length],
      text: name,
      focused: index === 0,
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pieData = getPieChartData();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4CAF50"
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Budget Overview</Text>
            <Text style={styles.year}>{data?.current_year}</Text>
          </View>
          <CurrencyToggle />
        </View>

        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <StatCard
            title="Total Income"
            value={formatCurrency(data?.totals.income || 0)}
            icon="cash-outline"
            color="#4CAF50"
          />
          <View style={{ width: 12 }} />
          <StatCard
            title="Net Expenses"
            value={formatCurrency(data?.totals.net_expenses || 0)}
            icon="wallet-outline"
            color="#f44336"
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard
            title="Investments"
            value={formatCurrency(data?.totals.investments || 0)}
            icon="trending-up-outline"
            color="#2196F3"
          />
          <View style={{ width: 12 }} />
          <StatCard
            title="Net Savings"
            value={formatCurrency(data?.totals.net_savings || 0)}
            icon="save-outline"
            color={data?.totals.net_savings && data.totals.net_savings >= 0 ? '#4CAF50' : '#f44336'}
          />
        </View>

        {/* Items Count */}
        <Card style={styles.countsCard}>
          <Text style={styles.cardTitle}>Your Budget Items</Text>
          <View style={styles.countsRow}>
            <View style={styles.countItem}>
              <View style={[styles.countIcon, { backgroundColor: '#f4433620' }]}>
                <Ionicons name="receipt-outline" size={20} color="#f44336" />
              </View>
              <Text style={styles.countValue}>{data?.counts.expenses || 0}</Text>
              <Text style={styles.countLabel}>Expenses</Text>
            </View>
            <View style={styles.countItem}>
              <View style={[styles.countIcon, { backgroundColor: '#4CAF5020' }]}>
                <Ionicons name="briefcase-outline" size={20} color="#4CAF50" />
              </View>
              <Text style={styles.countValue}>{data?.counts.income_sources || 0}</Text>
              <Text style={styles.countLabel}>Income</Text>
            </View>
            <View style={styles.countItem}>
              <View style={[styles.countIcon, { backgroundColor: '#2196F320' }]}>
                <Ionicons name="pie-chart-outline" size={20} color="#2196F3" />
              </View>
              <Text style={styles.countValue}>{data?.counts.investments || 0}</Text>
              <Text style={styles.countLabel}>Investments</Text>
            </View>
          </View>
        </Card>

        {/* Expenses by Category Chart */}
        {pieData.length > 0 && (
          <Card>
            <Text style={styles.cardTitle}>Expenses by Category</Text>
            <View style={styles.chartContainer}>
              <PieChart
                data={pieData}
                donut
                radius={80}
                innerRadius={50}
                innerCircleColor={'#1a1a1a'}
                centerLabelComponent={() => (
                  <View style={styles.centerLabel}>
                    <Text style={styles.centerLabelText}>Total</Text>
                    <Text style={styles.centerLabelValue}>
                      {formatCurrency(data?.totals.expenses_debit || 0)}
                    </Text>
                  </View>
                )}
              />
            </View>
            <View style={styles.legendContainer}>
              {pieData.map((item, index) => (
                <View key={index} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendText} numberOfLines={1}>
                    {item.text}
                  </Text>
                  <Text style={styles.legendValue}>
                    {formatCurrency(item.value)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {pieData.length === 0 && (
          <Card>
            <View style={styles.emptyChart}>
              <Ionicons name="pie-chart-outline" size={48} color="#444" />
              <Text style={styles.emptyChartText}>No expense data yet</Text>
              <Text style={styles.emptyChartSubtext}>
                Add expenses to see category breakdown
              </Text>
            </View>
          </Card>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  year: {
    fontSize: 16,
    color: '#888',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  countsCard: {
    marginTop: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  countsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  countItem: {
    alignItems: 'center',
  },
  countIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  countValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  countLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  centerLabel: {
    alignItems: 'center',
  },
  centerLabelText: {
    fontSize: 12,
    color: '#888',
  },
  centerLabelValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  legendContainer: {
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  legendText: {
    flex: 1,
    fontSize: 14,
    color: '#fff',
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  emptyChart: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyChartText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptyChartSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
});
