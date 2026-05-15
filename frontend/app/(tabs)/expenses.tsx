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
  getExpenses,
  getExpenseCategories,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../../src/api';
import { Expense, ExpenseCategory, TransactionType, Currency } from '../../src/types';
import { useAppStore } from '../../src/store';
import { CurrencyToggle } from '../../src/components/CurrencyToggle';
import { FormModal } from '../../src/components/FormModal';
import { FormInput } from '../../src/components/FormInput';
import { FormSelect } from '../../src/components/FormSelect';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { Card } from '../../src/components/Card';

const currentYear = new Date().getFullYear();

export default function ExpensesScreen() {
  const { currency, theme, bumpDataVersion } = useAppStore();
  const c = theme.colors;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [transactionType, setTransactionType] = useState<TransactionType>('debit');
  const [appreciationRate, setAppreciationRate] = useState('');
  const [startYear, setStartYear] = useState(String(currentYear));
  const [isRecurring, setIsRecurring] = useState(true);

  const loadData = async () => {
    try {
      const [expensesData, categoriesData] = await Promise.all([
        getExpenses(),
        getExpenseCategories(),
      ]);
      setExpenses(expensesData.filter((e) => e.currency === currency));
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load expenses:', error);
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
    setCategoryId('');
    setTransactionType('debit');
    setAppreciationRate('');
    setStartYear(String(currentYear));
    setIsRecurring(true);
    setEditingExpense(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setName(expense.name);
    setAmount(String(expense.amount));
    setCategoryId(expense.category_id);
    setTransactionType(expense.transaction_type);
    setAppreciationRate(String(expense.appreciation_rate));
    setStartYear(String(expense.start_year));
    setIsRecurring(expense.is_recurring);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !amount || !categoryId) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const selectedCategory = categories.find((c) => c.id === categoryId);
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    setSaving(true);
    try {
      const expenseData = {
        name: name.trim(),
        amount: parseFloat(amount),
        category_id: categoryId,
        category_name: selectedCategory.name,
        transaction_type: transactionType,
        appreciation_rate: parseFloat(appreciationRate) || 0,
        start_year: parseInt(startYear) || currentYear,
        currency: currency,
        is_recurring: isRecurring,
      };

      if (editingExpense) {
        await updateExpense(editingExpense.id, expenseData);
      } else {
        await createExpense(expenseData);
      }

      setModalVisible(false);
      resetForm();
      loadData();
      bumpDataVersion();
    } catch (error) {
      console.error('Failed to save expense:', error);
      Alert.alert('Error', 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (expense: Expense) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${expense.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense(expense.id);
              loadData();
              bumpDataVersion();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete expense');
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

  const categoryOptions = categories.map((cat) => ({
    value: cat.id,
    label: cat.name,
    icon: cat.icon,
  }));

  const transactionTypeOptions = [
    { value: 'debit', label: 'Debit (Expense)' },
    { value: 'credit', label: 'Credit (Refund/Cashback)' },
  ];

  const renderExpense = ({ item }: { item: Expense }) => {
    const category = categories.find((c) => c.id === item.category_id);
    const isCredit = item.transaction_type === 'credit';

    return (
      <Card onPress={() => openEditModal(item)}>
        <View style={styles.expenseHeader}>
          <View style={styles.expenseInfo}>
            <View style={[styles.categoryIcon, { backgroundColor: isCredit ? '#4CAF5020' : '#f4433620' }]}>
              <Ionicons
                name={category?.icon as any || 'cash-outline'}
                size={20}
                color={isCredit ? '#4CAF50' : '#f44336'}
              />
            </View>
            <View style={styles.expenseDetails}>
              <Text style={styles.expenseName}>{item.name}</Text>
              <Text style={styles.expenseCategory}>{item.category_name}</Text>
            </View>
          </View>
          <View style={styles.expenseAmountContainer}>
            <Text style={[styles.expenseAmount, { color: isCredit ? '#4CAF50' : '#f44336' }]}>
              {isCredit ? '+' : '-'}{formatCurrency(item.amount)}
            </Text>
            {item.appreciation_rate > 0 && (
              <Text style={styles.appreciationRate}>
                +{item.appreciation_rate}%/yr
              </Text>
            )}
          </View>
        </View>
        <View style={styles.expenseFooter}>
          <Text style={styles.expenseYear}>Since {item.start_year}</Text>
          <View style={styles.expenseActions}>
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
        <Text style={[styles.title, { color: c.text }]}>Expenses</Text>
        <CurrencyToggle />
      </View>

      {expenses.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title="No Expenses Yet"
          description="Add your recurring expenses to track your budget over time"
          actionLabel="Add Expense"
          onAction={openAddModal}
        />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={renderExpense}
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

      <TouchableOpacity style={[styles.fab, { backgroundColor: c.fabBg }]} onPress={openAddModal}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <FormModal
        visible={modalVisible}
        title={editingExpense ? 'Edit Expense' : 'Add Expense'}
        onClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <FormInput
          label="Name *"
          value={name}
          onChangeText={setName}
          placeholder="e.g., Monthly Rent"
        />
        <FormInput
          label="Amount *"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
        <FormSelect
          label="Category *"
          value={categoryId}
          options={categoryOptions}
          onChange={setCategoryId}
        />
        <FormSelect
          label="Type"
          value={transactionType}
          options={transactionTypeOptions}
          onChange={(v) => setTransactionType(v as TransactionType)}
        />
        <FormInput
          label="Yearly Appreciation Rate (%)"
          value={appreciationRate}
          onChangeText={setAppreciationRate}
          placeholder="e.g., 5 for 5% annual increase"
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
          onPress={() => setIsRecurring(!isRecurring)}
        >
          <Text style={styles.toggleLabel}>Recurring Expense</Text>
          <View style={[styles.toggle, isRecurring && styles.toggleActive]}>
            <View style={[styles.toggleKnob, isRecurring && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>
        <View style={styles.modalButtons}>
          <Button
            title={editingExpense ? 'Update' : 'Add Expense'}
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
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  expenseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseDetails: {
    flex: 1,
  },
  expenseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  expenseCategory: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  expenseAmountContainer: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  appreciationRate: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 2,
  },
  expenseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  expenseYear: {
    fontSize: 13,
    color: '#666',
  },
  expenseActions: {
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
