import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { getProjections, getSettings, updateSettings } from '../../src/api';
import { ProjectionsData, YearProjection } from '../../src/types';
import { useAppStore } from '../../src/store';
import { CurrencyToggle } from '../../src/components/CurrencyToggle';
import { Card } from '../../src/components/Card';
import { FormModal } from '../../src/components/FormModal';
import { FormInput } from '../../src/components/FormInput';
import { Button } from '../../src/components/Button';

const { width } = Dimensions.get('window');

export default function ProjectionsScreen() {
  const { currency, projectionYears, setProjectionYears, theme } = useAppStore();
  const c = theme.colors;
  const [data, setData] = useState<ProjectionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [yearsInput, setYearsInput] = useState(String(projectionYears));
  const [selectedYear, setSelectedYear] = useState<YearProjection | null>(null);

  const loadData = async () => {
    try {
      const projections = await getProjections(projectionYears, currency);
      setData(projections);
      if (projections.projections.length > 0) {
        setSelectedYear(projections.projections[0]);
      }
    } catch (error) {
      console.error('Failed to load projections:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currency, projectionYears]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSaveSettings = () => {
    const years = parseInt(yearsInput);
    if (years >= 1 && years <= 30) {
      setProjectionYears(years);
      setSettingsModalVisible(false);
    }
  };

  const formatCurrency = (amount: number) => {
    const symbol = currency === 'USD' ? '$' : '₹';
    if (Math.abs(amount) >= 1000000) {
      return `${symbol}${(amount / 1000000).toFixed(1)}M`;
    } else if (Math.abs(amount) >= 1000) {
      return `${symbol}${(amount / 1000).toFixed(1)}K`;
    }
    return `${symbol}${amount.toFixed(0)}`;
  };

  const getBarChartData = () => {
    if (!data) return [];
    return data.projections.map((p) => ({
      value: p.total_income,
      label: String(p.year).slice(-2),
      frontColor: '#4CAF50',
    }));
  };

  const getExpenseChartData = () => {
    if (!data) return [];
    return data.projections.map((p) => ({
      value: p.net_expenses,
      label: String(p.year).slice(-2),
      frontColor: '#f44336',
    }));
  };

  const getSavingsLineData = () => {
    if (!data) return [];
    return data.projections.map((p, index) => ({
      value: p.net_savings,
      dataPointText: index === 0 || index === data.projections.length - 1 
        ? formatCurrency(p.net_savings) 
        : '',
    }));
  };

  const getInvestmentLineData = () => {
    if (!data) return [];
    return data.projections.map((p, index) => ({
      value: p.total_investments,
      dataPointText: index === 0 || index === data.projections.length - 1 
        ? formatCurrency(p.total_investments) 
        : '',
    }));
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading projections...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const chartWidth = width - 64;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
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
            <Text style={styles.title}>Projections</Text>
            <Text style={styles.subtitle}>{projectionYears} Year Forecast</Text>
          </View>
          <View style={styles.headerActions}>
            <CurrencyToggle />
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => {
                setYearsInput(String(projectionYears));
                setSettingsModalVisible(true);
              }}
            >
              <Ionicons name="settings-outline" size={22} color="#888" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Year Selector */}
        {data && data.projections.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.yearSelector}
            contentContainerStyle={styles.yearSelectorContent}
          >
            {data.projections.map((projection) => (
              <TouchableOpacity
                key={projection.year}
                style={[
                  styles.yearTab,
                  selectedYear?.year === projection.year && styles.yearTabActive,
                ]}
                onPress={() => setSelectedYear(projection)}
              >
                <Text
                  style={[
                    styles.yearTabText,
                    selectedYear?.year === projection.year && styles.yearTabTextActive,
                  ]}
                >
                  {projection.year}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Selected Year Summary */}
        {selectedYear && (
          <Card style={styles.summaryCard}>
            <Text style={styles.cardTitle}>{selectedYear.year} Summary</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Income</Text>
                <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                  {formatCurrency(selectedYear.total_income)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Expenses</Text>
                <Text style={[styles.summaryValue, { color: '#f44336' }]}>
                  {formatCurrency(selectedYear.net_expenses)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Investments</Text>
                <Text style={[styles.summaryValue, { color: '#2196F3' }]}>
                  {formatCurrency(selectedYear.total_investments)}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Net Savings</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: selectedYear.net_savings >= 0 ? '#4CAF50' : '#f44336' },
                  ]}
                >
                  {formatCurrency(selectedYear.net_savings)}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Income vs Expenses Chart */}
        {data && data.projections.length > 0 && (
          <Card>
            <Text style={styles.cardTitle}>Income vs Expenses Trend</Text>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.legendText}>Income</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#f44336' }]} />
                <Text style={styles.legendText}>Expenses</Text>
              </View>
            </View>
            <View style={styles.chartContainer}>
              <BarChart
                data={getBarChartData()}
                barWidth={16}
                spacing={data.projections.length > 5 ? 12 : 24}
                roundedTop
                roundedBottom
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={{ color: '#666', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#888', fontSize: 10 }}
                noOfSections={4}
                maxValue={Math.max(...data.projections.map(p => Math.max(p.total_income, p.net_expenses))) * 1.2}
                width={chartWidth}
                height={180}
                isAnimated
                barBorderRadius={4}
                secondaryData={getExpenseChartData()}
                secondaryBarWidth={16}
              />
            </View>
          </Card>
        )}

        {/* Savings & Investment Growth */}
        {data && data.projections.length > 0 && (
          <Card>
            <Text style={styles.cardTitle}>Savings & Investment Growth</Text>
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.legendText}>Net Savings</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#2196F3' }]} />
                <Text style={styles.legendText}>Investments</Text>
              </View>
            </View>
            <View style={styles.chartContainer}>
              <LineChart
                data={getSavingsLineData()}
                data2={getInvestmentLineData()}
                color="#4CAF50"
                color2="#2196F3"
                thickness={3}
                thickness2={3}
                curved
                hideDataPoints={false}
                dataPointsColor="#4CAF50"
                dataPointsColor2="#2196F3"
                dataPointsRadius={4}
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={{ color: '#666', fontSize: 10 }}
                noOfSections={4}
                width={chartWidth - 40}
                height={180}
                isAnimated
                startFillColor="#4CAF5030"
                endFillColor="#4CAF5010"
                startFillColor2="#2196F330"
                endFillColor2="#2196F310"
                areaChart
              />
            </View>
          </Card>
        )}

        {/* Breakdown Details */}
        {selectedYear && (
          <>
            {selectedYear.income_breakdown.length > 0 && (
              <Card>
                <Text style={styles.cardTitle}>Income Breakdown</Text>
                {selectedYear.income_breakdown.map((item, index) => (
                  <View key={index} style={styles.breakdownItem}>
                    <View style={styles.breakdownInfo}>
                      <Ionicons name="briefcase-outline" size={18} color="#4CAF50" />
                      <Text style={styles.breakdownName}>{item.name}</Text>
                    </View>
                    <Text style={styles.breakdownValue}>
                      {formatCurrency(item.amount)}
                    </Text>
                  </View>
                ))}
              </Card>
            )}

            {selectedYear.expense_breakdown.length > 0 && (
              <Card>
                <Text style={styles.cardTitle}>Expense Breakdown</Text>
                {selectedYear.expense_breakdown.map((item, index) => (
                  <View key={index} style={styles.breakdownItem}>
                    <View style={styles.breakdownInfo}>
                      <Ionicons
                        name={item.type === 'credit' ? 'arrow-down-outline' : 'arrow-up-outline'}
                        size={18}
                        color={item.type === 'credit' ? '#4CAF50' : '#f44336'}
                      />
                      <View>
                        <Text style={styles.breakdownName}>{item.name}</Text>
                        <Text style={styles.breakdownCategory}>{item.category}</Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.breakdownValue,
                        { color: item.type === 'credit' ? '#4CAF50' : '#f44336' },
                      ]}
                    >
                      {item.type === 'credit' ? '+' : '-'}{formatCurrency(item.amount)}
                    </Text>
                  </View>
                ))}
              </Card>
            )}

            {selectedYear.investment_breakdown.length > 0 && (
              <Card>
                <Text style={styles.cardTitle}>Investment Breakdown</Text>
                {selectedYear.investment_breakdown.map((item, index) => (
                  <View key={index} style={styles.breakdownItem}>
                    <View style={styles.breakdownInfo}>
                      <Ionicons name="trending-up-outline" size={18} color="#2196F3" />
                      <View>
                        <Text style={styles.breakdownName}>{item.name}</Text>
                        <Text style={styles.breakdownCategory}>{item.type}</Text>
                      </View>
                    </View>
                    <View style={styles.investmentValues}>
                      <Text style={styles.breakdownValue}>
                        {formatCurrency(item.current_value)}
                      </Text>
                      {item.growth > 0 && (
                        <Text style={styles.growthText}>
                          +{formatCurrency(item.growth)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}

        {/* Empty State */}
        {(!data || data.projections.length === 0 || 
          (data.projections[0].total_income === 0 && 
           data.projections[0].net_expenses === 0 && 
           data.projections[0].total_investments === 0)) && (
          <Card style={styles.emptyCard}>
            <Ionicons name="analytics-outline" size={64} color="#444" />
            <Text style={styles.emptyTitle}>No Data for Projections</Text>
            <Text style={styles.emptyText}>
              Add income sources, expenses, and investments to see your multi-year financial projections.
            </Text>
          </Card>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Settings Modal */}
      <FormModal
        visible={settingsModalVisible}
        title="Projection Settings"
        onClose={() => setSettingsModalVisible(false)}
      >
        <FormInput
          label="Number of Years to Project (1-30)"
          value={yearsInput}
          onChangeText={setYearsInput}
          placeholder="5"
          keyboardType="number-pad"
        />
        <Button title="Save" onPress={handleSaveSettings} />
      </FormModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    
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
    alignItems: 'flex-start',
    marginTop: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsButton: {
    padding: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
  },
  yearSelector: {
    marginBottom: 16,
  },
  yearSelectorContent: {
    paddingVertical: 4,
  },
  yearTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    marginRight: 8,
  },
  yearTabActive: {
    backgroundColor: '#4CAF50',
  },
  yearTabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  yearTabTextActive: {
    color: '#fff',
  },
  summaryCard: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  summaryItem: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  chartContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#888',
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  breakdownInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  breakdownName: {
    fontSize: 15,
    color: '#fff',
  },
  breakdownCategory: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  breakdownValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  investmentValues: {
    alignItems: 'flex-end',
  },
  growthText: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
});
