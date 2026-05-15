import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getInvestments,
  getInvestmentTypes,
  createInvestment,
  updateInvestment,
  deleteInvestment,
} from '../../src/api';
import { Investment, InvestmentType, Currency } from '../../src/types';
import { useAppStore } from '../../src/store';
import { FormModal } from '../../src/components/FormModal';
import { FormInput } from '../../src/components/FormInput';
import { FormSelect } from '../../src/components/FormSelect';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { Card } from '../../src/components/Card';

const currentYear = new Date().getFullYear();

export default function InvestmentsScreen() {
  const { currency, theme, bumpDataVersion } = useAppStore();
  const c = theme.colors;
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [investmentTypes, setInvestmentTypes] = useState<InvestmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [principal, setPrincipal] = useState('');
  const [typeId, setTypeId] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [startYear, setStartYear] = useState(String(currentYear));
  const [isActive, setIsActive] = useState(true);

  const loadData = async () => {
    try {
      const [investmentsData, typesData] = await Promise.all([
        getInvestments(),
        getInvestmentTypes(),
      ]);
      setInvestments(investmentsData.filter((i) => i.currency === currency));
      setInvestmentTypes(typesData);
    } catch (error) {
      console.error('Failed to load investments:', error);
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

  const resetForm = () => {
    setName('');
    setPrincipal('');
    setTypeId('');
    setInterestRate('');
    setStartYear(String(currentYear));
    setIsActive(true);
    setEditingInvestment(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (investment: Investment) => {
    setEditingInvestment(investment);
    setName(investment.name);
    setPrincipal(String(investment.principal));
    setTypeId(investment.type_id);
    setInterestRate(String(investment.interest_rate));
    setStartYear(String(investment.start_year));
    setIsActive(investment.is_active);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !principal || !typeId) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const selectedType = investmentTypes.find((t) => t.id === typeId);
    if (!selectedType) {
      Alert.alert('Error', 'Please select an investment type');
      return;
    }

    setSaving(true);
    try {
      const investmentData = {
        name: name.trim(),
        principal: parseFloat(principal),
        type_id: typeId,
        type_name: selectedType.name,
        interest_rate: parseFloat(interestRate) || 0,
        start_year: parseInt(startYear) || currentYear,
        currency: currency,
        is_active: isActive,
      };

      if (editingInvestment) {
        await updateInvestment(editingInvestment.id, investmentData);
      } else {
        await createInvestment(investmentData);
      }

      setModalVisible(false);
      resetForm();
      loadData();
      bumpDataVersion();
    } catch (error) {
      console.error('Failed to save investment:', error);
      Alert.alert('Error', 'Failed to save investment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (investment: Investment) => {
    Alert.alert(
      'Delete Investment',
      `Are you sure you want to delete "${investment.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInvestment(investment.id);
              loadData();
              bumpDataVersion();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete investment');
            }
          },
        },
      ]
    );
  };

  const formatCurrency = (amount: number) => {
    const symbol = currency === 'USD' ? '$' : '₹';
    return `${symbol}${amount.toLocaleString()}`;
  };

  const calculateCurrentValue = (investment: Investment) => {
    const yearsSinceStart = currentYear - investment.start_year;
    if (yearsSinceStart <= 0) return investment.principal;
    return investment.principal * Math.pow(1 + investment.interest_rate / 100, yearsSinceStart);
  };

  const typeOptions = investmentTypes.map((type) => ({
    value: type.id,
    label: type.name,
    icon: type.icon,
  }));

  const renderInvestment = ({ item }: { item: Investment }) => {
    const investmentType = investmentTypes.find((t) => t.id === item.type_id);
    const currentValue = calculateCurrentValue(item);
    const growth = currentValue - item.principal;
    const growthPercentage = ((growth / item.principal) * 100).toFixed(1);

    return (
      <Card onPress={() => openEditModal(item)}>
        <View style={styles.investmentHeader}>
          <View style={styles.investmentInfo}>
            <View style={[styles.icon, { backgroundColor: '#2196F320' }]}>
              <Ionicons
                name={investmentType?.icon as any || 'trending-up-outline'}
                size={20}
                color="#2196F3"
              />
            </View>
            <View style={styles.investmentDetails}>
              <Text style={styles.investmentName}>{item.name}</Text>
              <Text style={styles.investmentType}>{item.type_name}</Text>
            </View>
          </View>
          <View style={styles.valueContainer}>
            <Text style={styles.currentValue}>{formatCurrency(currentValue)}</Text>
            {growth > 0 && (
              <Text style={styles.growth}>
                +{formatCurrency(growth)} ({growthPercentage}%)
              </Text>
            )}
          </View>
        </View>
        <View style={styles.investmentFooter}>
          <View style={styles.footerInfo}>
            <Text style={styles.footerLabel}>Principal: </Text>
            <Text style={styles.footerValue}>{formatCurrency(item.principal)}</Text>
            <Text style={styles.footerLabel}> • </Text>
            <Text style={styles.footerLabel}>Rate: </Text>
            <Text style={styles.footerValue}>{item.interest_rate}%</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash-outline" size={18} color="#f44336" />
            </TouchableOpacity>
          </View>
        </View>
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Investments</Text>
      </View>

      {investments.length === 0 ? (
        <EmptyState
          icon="trending-up-outline"
          title="No Investments Yet"
          description="Add your savings and investments to track your wealth growth"
          actionLabel="Add Investment"
          onAction={openAddModal}
        />
      ) : (
        <FlatList
          data={investments}
          keyExtractor={(item) => item.id}
          renderItem={renderInvestment}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4CAF50"
            />
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={openAddModal}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <FormModal
        visible={modalVisible}
        title={editingInvestment ? 'Edit Investment' : 'Add Investment'}
        onClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <FormInput
          label="Name *"
          value={name}
          onChangeText={setName}
          placeholder="e.g., Emergency Fund FD"
        />
        <FormInput
          label="Principal Amount *"
          value={principal}
          onChangeText={setPrincipal}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        <FormSelect
          label="Investment Type *"
          value={typeId}
          options={typeOptions}
          onChange={setTypeId}
        />
        <FormInput
          label="Annual Interest Rate (%)"
          value={interestRate}
          onChangeText={setInterestRate}
          placeholder="e.g., 7.5"
          keyboardType="decimal-pad"
        />
        <FormInput
          label="Start Year"
          value={startYear}
          onChangeText={setStartYear}
          placeholder={String(currentYear)}
          keyboardType="number-pad"
        />
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => setIsActive(!isActive)}
        >
          <Text style={styles.toggleLabel}>Active Investment</Text>
          <View style={[styles.toggle, isActive && styles.toggleActive]}>
            <View style={[styles.toggleKnob, isActive && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>
        <View style={styles.modalButtons}>
          <Button
            title={editingInvestment ? 'Update' : 'Add Investment'}
            onPress={handleSave}
            loading={saving}
          />
        </View>
      </FormModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    
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
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  investmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  investmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  investmentDetails: {
    flex: 1,
  },
  investmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  investmentType: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  valueContainer: {
    alignItems: 'flex-end',
  },
  currentValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  growth: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  investmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLabel: {
    fontSize: 13,
    color: '#666',
  },
  footerValue: {
    fontSize: 13,
    color: '#fff',
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#fff',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#333',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#4CAF50',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleKnobActive: {
    transform: [{ translateX: 22 }],
  },
  modalButtons: {
    marginTop: 8,
  },
});
