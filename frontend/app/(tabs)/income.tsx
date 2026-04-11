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
  getIncomeSources,
  createIncomeSource,
  updateIncomeSource,
  deleteIncomeSource,
} from '../../src/api';
import { IncomeSource, IncrementType, Currency } from '../../src/types';
import { useAppStore } from '../../src/store';
import { CurrencyToggle } from '../../src/components/CurrencyToggle';
import { FormModal } from '../../src/components/FormModal';
import { FormInput } from '../../src/components/FormInput';
import { FormSelect } from '../../src/components/FormSelect';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { Card } from '../../src/components/Card';

const currentYear = new Date().getFullYear();

export default function IncomeScreen() {
  const { currency, theme } = useAppStore();
  const c = theme.colors;
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSource, setEditingSource] = useState<IncomeSource | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [incrementRate, setIncrementRate] = useState('');
  const [incrementType, setIncrementType] = useState<IncrementType>('percentage');
  const [startYear, setStartYear] = useState(String(currentYear));
  const [isActive, setIsActive] = useState(true);

  const loadData = async () => {
    try {
      const data = await getIncomeSources();
      setIncomeSources(data.filter((s) => s.currency === currency));
    } catch (error) {
      console.error('Failed to load income sources:', error);
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
    setAmount('');
    setIncrementRate('');
    setIncrementType('percentage');
    setStartYear(String(currentYear));
    setIsActive(true);
    setEditingSource(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (source: IncomeSource) => {
    setEditingSource(source);
    setName(source.name);
    setAmount(String(source.amount));
    setIncrementRate(String(source.increment_rate));
    setIncrementType(source.increment_type);
    setStartYear(String(source.start_year));
    setIsActive(source.is_active);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !amount) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const sourceData = {
        name: name.trim(),
        amount: parseFloat(amount),
        increment_rate: parseFloat(incrementRate) || 0,
        increment_type: incrementType,
        start_year: parseInt(startYear) || currentYear,
        currency: currency,
        is_active: isActive,
      };

      if (editingSource) {
        await updateIncomeSource(editingSource.id, sourceData);
      } else {
        await createIncomeSource(sourceData);
      }

      setModalVisible(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Failed to save income source:', error);
      Alert.alert('Error', 'Failed to save income source');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (source: IncomeSource) => {
    Alert.alert(
      'Delete Income Source',
      `Are you sure you want to delete "${source.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteIncomeSource(source.id);
              loadData();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete income source');
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

  const incrementTypeOptions = [
    { value: 'percentage', label: 'Percentage (%)' },
    { value: 'fixed', label: 'Fixed Amount' },
  ];

  const renderIncomeSource = ({ item }: { item: IncomeSource }) => {
    const incrementLabel = item.increment_type === 'percentage'
      ? `+${item.increment_rate}%/yr`
      : `+${formatCurrency(item.increment_rate)}/yr`;

    return (
      <Card onPress={() => openEditModal(item)}>
        <View style={styles.sourceHeader}>
          <View style={styles.sourceInfo}>
            <View style={[styles.icon, { backgroundColor: '#4CAF5020' }]}>
              <Ionicons name="briefcase-outline" size={20} color="#4CAF50" />
            </View>
            <View style={styles.sourceDetails}>
              <Text style={styles.sourceName}>{item.name}</Text>
              <Text style={styles.sourceStatus}>
                {item.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
          <View style={styles.amountContainer}>
            <Text style={styles.sourceAmount}>{formatCurrency(item.amount)}</Text>
            {item.increment_rate > 0 && (
              <Text style={styles.incrementRate}>{incrementLabel}</Text>
            )}
          </View>
        </View>
        <View style={styles.sourceFooter}>
          <Text style={styles.sourceYear}>Since {item.start_year}</Text>
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
          <Text style={[styles.loadingText, { color: c.textSecondary }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Income Sources</Text>
        <CurrencyToggle />
      </View>

      {incomeSources.length === 0 ? (
        <EmptyState
          icon="cash-outline"
          title="No Income Sources Yet"
          description="Add your income sources to track your earnings over time"
          actionLabel="Add Income"
          onAction={openAddModal}
        />
      ) : (
        <FlatList
          data={incomeSources}
          keyExtractor={(item) => item.id}
          renderItem={renderIncomeSource}
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
        title={editingSource ? 'Edit Income Source' : 'Add Income Source'}
        onClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <FormInput
          label="Name *"
          value={name}
          onChangeText={setName}
          placeholder="e.g., Primary Salary"
        />
        <FormInput
          label="Annual Amount *"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        <FormSelect
          label="Increment Type"
          value={incrementType}
          options={incrementTypeOptions}
          onChange={(v) => setIncrementType(v as IncrementType)}
        />
        <FormInput
          label={incrementType === 'percentage' ? 'Yearly Increment (%)' : 'Yearly Increment (Amount)'}
          value={incrementRate}
          onChangeText={setIncrementRate}
          placeholder={incrementType === 'percentage' ? 'e.g., 8 for 8% yearly raise' : 'e.g., 5000'}
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
          <Text style={styles.toggleLabel}>Active Income Source</Text>
          <View style={[styles.toggle, isActive && styles.toggleActive]}>
            <View style={[styles.toggleKnob, isActive && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>
        <View style={styles.modalButtons}>
          <Button
            title={editingSource ? 'Update' : 'Add Income'}
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
  sourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sourceInfo: {
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
  sourceDetails: {
    flex: 1,
  },
  sourceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  sourceStatus: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  sourceAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  incrementRate: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 2,
  },
  sourceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  sourceYear: {
    fontSize: 13,
    color: '#666',
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
