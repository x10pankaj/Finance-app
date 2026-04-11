import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import {
  uploadBankStatement,
  importTransactions,
  getExpenseCategories,
  ParsedTransaction,
} from '../../src/api';
import { ExpenseCategory } from '../../src/types';
import { useAppStore } from '../../src/store';
import { CurrencyToggle } from '../../src/components/CurrencyToggle';
import { FormModal } from '../../src/components/FormModal';
import { FormInput } from '../../src/components/FormInput';
import { FormSelect } from '../../src/components/FormSelect';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';

const currentYear = new Date().getFullYear();

export default function ImportScreen() {
  const { currency, theme } = useAppStore();
  const c = theme.colors;
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<ParsedTransaction | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  
  // Import settings
  const [startYear, setStartYear] = useState(String(currentYear));
  const [isRecurring, setIsRecurring] = useState(false);
  const [appreciationRate, setAppreciationRate] = useState('0');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await getExpenseCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      if (!file) {
        Alert.alert('Error', 'No file selected');
        return;
      }

      setUploading(true);

      // Create form data
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'text/csv',
      } as any);

      const response = await uploadBankStatement(formData);
      setTransactions(response.transactions);
      
      Alert.alert(
        'File Parsed',
        `Found ${response.transactions.length} transactions. Review and edit categories before importing.`
      );
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to parse file');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleSelect = (id: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleSelectAll = () => {
    const allSelected = transactions.every((t) => t.selected);
    setTransactions((prev) => prev.map((t) => ({ ...t, selected: !allSelected })));
  };

  const handleEditCategory = (transaction: ParsedTransaction) => {
    setEditingTransaction(transaction);
    setEditModalVisible(true);
  };

  const handleSaveCategory = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    if (editingTransaction && category) {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === editingTransaction.id
            ? {
                ...t,
                category_id: categoryId,
                category_name: category.name,
                suggested_category_id: categoryId,
                suggested_category_name: category.name,
              }
            : t
        )
      );
    }
    setEditModalVisible(false);
    setEditingTransaction(null);
  };

  const handleImport = async () => {
    const selectedTransactions = transactions.filter((t) => t.selected);
    if (selectedTransactions.length === 0) {
      Alert.alert('Error', 'Please select at least one transaction to import');
      return;
    }

    setImporting(true);
    try {
      const result = await importTransactions({
        transactions: selectedTransactions.map((t) => ({
          ...t,
          category_id: t.category_id || t.suggested_category_id,
          category_name: t.category_name || t.suggested_category_name,
        })),
        currency,
        start_year: parseInt(startYear) || currentYear,
        is_recurring: isRecurring,
        appreciation_rate: parseFloat(appreciationRate) || 0,
      });

      Alert.alert(
        'Import Complete',
        `Imported ${result.expenses_count} expenses and ${result.income_count} income sources.`,
        [{ text: 'OK', onPress: () => setTransactions([]) }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to import transactions');
    } finally {
      setImporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    const symbol = currency === 'USD' ? '$' : '₹';
    return `${symbol}${amount.toLocaleString()}`;
  };

  const selectedCount = transactions.filter((t) => t.selected).length;

  const categoryOptions = categories.map((cat) => ({
    value: cat.id,
    label: cat.name,
    icon: cat.icon,
  }));

  const renderTransaction = ({ item }: { item: ParsedTransaction }) => {
    const isCredit = item.transaction_type === 'credit';
    const categoryName = item.category_name || item.suggested_category_name;
    const confidence = item.confidence;

    return (
      <Card style={[styles.transactionCard, !item.selected && styles.unselected]}>
        <TouchableOpacity
          style={styles.transactionRow}
          onPress={() => handleToggleSelect(item.id)}
        >
          <View style={[styles.checkbox, item.selected && styles.checkboxSelected]}>
            {item.selected && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
          <View style={styles.transactionContent}>
            <View style={styles.transactionHeader}>
              <Text style={styles.transactionDate}>{item.date}</Text>
              <Text style={[styles.transactionAmount, { color: isCredit ? '#4CAF50' : '#f44336' }]}>
                {isCredit ? '+' : '-'}{formatCurrency(item.amount)}
              </Text>
            </View>
            <Text style={styles.transactionDesc} numberOfLines={1}>
              {item.description}
            </Text>
            <TouchableOpacity
              style={styles.categoryRow}
              onPress={() => handleEditCategory(item)}
            >
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{categoryName}</Text>
                {confidence >= 80 && (
                  <Ionicons name="checkmark-circle" size={14} color="#4CAF50" style={styles.confidenceIcon} />
                )}
              </View>
              <View style={styles.editBadge}>
                <Ionicons name="pencil" size={12} color="#888" />
                <Text style={styles.editText}>Edit</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Import Transactions</Text>
        <CurrencyToggle />
      </View>

      {transactions.length === 0 ? (
        <View style={styles.uploadContainer}>
          <View style={styles.uploadCard}>
            <View style={styles.uploadIcon}>
              <Ionicons name="cloud-upload-outline" size={64} color="#4CAF50" />
            </View>
            <Text style={styles.uploadTitle}>Upload Bank Statement</Text>
            <Text style={styles.uploadSubtitle}>
              Supports CSV and Excel files with columns: Date, Description, Amount, Type
            </Text>
            <Button
              title={uploading ? 'Processing...' : 'Select File'}
              onPress={handlePickFile}
              loading={uploading}
              style={styles.uploadButton}
            />
            <View style={styles.formatInfo}>
              <Text style={styles.formatTitle}>Supported Formats:</Text>
              <View style={styles.formatRow}>
                <Ionicons name="document-text-outline" size={16} color="#888" />
                <Text style={styles.formatText}>CSV (.csv)</Text>
              </View>
              <View style={styles.formatRow}>
                <Ionicons name="document-outline" size={16} color="#888" />
                <Text style={styles.formatText}>Excel (.xlsx, .xls)</Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <View>
              <Text style={styles.previewTitle}>{transactions.length} Transactions Found</Text>
              <Text style={styles.previewSubtitle}>{selectedCount} selected for import</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerButton} onPress={handleSelectAll}>
                <Text style={styles.headerButtonText}>
                  {transactions.every((t) => t.selected) ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => setSettingsModalVisible(true)}
              >
                <Ionicons name="settings-outline" size={20} color="#888" />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={renderTransaction}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.actionBar}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setTransactions([])}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.importButton, selectedCount === 0 && styles.importButtonDisabled]}
              onPress={handleImport}
              disabled={selectedCount === 0 || importing}
            >
              {importing ? (
                <Text style={styles.importButtonText}>Importing...</Text>
              ) : (
                <Text style={styles.importButtonText}>
                  Import {selectedCount} Transaction{selectedCount !== 1 ? 's' : ''}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Edit Category Modal */}
      <FormModal
        visible={editModalVisible}
        title="Edit Category"
        onClose={() => {
          setEditModalVisible(false);
          setEditingTransaction(null);
        }}
      >
        {editingTransaction && (
          <>
            <Text style={styles.modalDescription}>
              {editingTransaction.description}
            </Text>
            <FormSelect
              label="Category"
              value={editingTransaction.category_id || editingTransaction.suggested_category_id}
              options={categoryOptions}
              onChange={handleSaveCategory}
            />
          </>
        )}
      </FormModal>

      {/* Import Settings Modal */}
      <FormModal
        visible={settingsModalVisible}
        title="Import Settings"
        onClose={() => setSettingsModalVisible(false)}
      >
        <FormInput
          label="Start Year"
          value={startYear}
          onChangeText={setStartYear}
          placeholder={String(currentYear)}
          keyboardType="number-pad"
        />
        <FormInput
          label="Appreciation Rate (%)"
          value={appreciationRate}
          onChangeText={setAppreciationRate}
          placeholder="0"
          keyboardType="decimal-pad"
        />
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => setIsRecurring(!isRecurring)}
        >
          <Text style={styles.toggleLabel}>Mark as Recurring</Text>
          <View style={[styles.toggle, isRecurring && styles.toggleActive]}>
            <View style={[styles.toggleKnob, isRecurring && styles.toggleKnobActive]} />
          </View>
        </TouchableOpacity>
        <Button title="Save Settings" onPress={() => setSettingsModalVisible(false)} />
      </FormModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    
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
  uploadContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  uploadCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  uploadIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4CAF5015',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  uploadTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  uploadSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  uploadButton: {
    width: '100%',
  },
  formatInfo: {
    marginTop: 24,
    alignSelf: 'stretch',
  },
  formatTitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  formatText: {
    fontSize: 14,
    color: '#888',
    marginLeft: 8,
  },
  previewContainer: {
    flex: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  previewSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
  },
  headerButtonText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '600',
  },
  settingsButton: {
    padding: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  transactionCard: {
    marginBottom: 8,
    padding: 12,
  },
  unselected: {
    opacity: 0.5,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxSelected: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  transactionContent: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: '#888',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionDesc: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    color: '#aaa',
  },
  confidenceIcon: {
    marginLeft: 4,
  },
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editText: {
    fontSize: 12,
    color: '#888',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  importButton: {
    flex: 2,
    paddingVertical: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    alignItems: 'center',
  },
  importButtonDisabled: {
    backgroundColor: '#333',
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalDescription: {
    fontSize: 14,
    color: '#888',
    marginBottom: 16,
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
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
});
