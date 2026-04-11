import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store';

interface Option {
  value: string;
  label: string;
  icon?: string;
}

interface FormSelectProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  error?: string;
}

export const FormSelect: React.FC<FormSelectProps> = ({ label, value, options, onChange, error }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useAppStore();
  const c = theme.colors;
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.selector, { backgroundColor: c.inputBg, borderColor: c.inputBorder }, error && { borderColor: '#f44336' }]}
        onPress={() => setIsOpen(true)}
      >
        <Text style={[styles.selectorText, { color: c.text }]}>{selectedOption?.label || 'Select...'}</Text>
        <Ionicons name="chevron-down" size={20} color={c.textSecondary} />
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}

      <Modal visible={isOpen} transparent={true} animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <TouchableOpacity style={[styles.overlay, { backgroundColor: c.modalOverlay }]} activeOpacity={1} onPress={() => setIsOpen(false)}>
          <View style={[styles.dropdown, { backgroundColor: c.card }]}>
            <Text style={[styles.dropdownTitle, { color: c.text, borderBottomColor: c.border }]}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, { borderBottomColor: c.surface }, value === item.value && { backgroundColor: c.surface }]}
                  onPress={() => { onChange(item.value); setIsOpen(false); }}
                >
                  {item.icon && (
                    <Ionicons name={item.icon as any} size={20} color={value === item.value ? c.accent : c.textSecondary} style={styles.optionIcon} />
                  )}
                  <Text style={[styles.optionText, { color: c.text }, value === item.value && { color: c.accent }]}>{item.label}</Text>
                  {value === item.value && <Ionicons name="checkmark" size={20} color={c.accent} />}
                </TouchableOpacity>
              )}
              style={styles.list}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, marginBottom: 8 },
  selector: { borderRadius: 8, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1 },
  selectorText: { fontSize: 16 },
  error: { color: '#f44336', fontSize: 12, marginTop: 4 },
  overlay: { flex: 1, justifyContent: 'center', padding: 20 },
  dropdown: { borderRadius: 12, maxHeight: '70%' },
  dropdownTitle: { fontSize: 18, fontWeight: 'bold', padding: 16, borderBottomWidth: 1 },
  list: { maxHeight: 400 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  optionIcon: { marginRight: 12 },
  optionText: { fontSize: 16, flex: 1 },
});
