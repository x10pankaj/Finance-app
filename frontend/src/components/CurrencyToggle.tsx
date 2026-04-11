import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppStore } from '../store';
import { Currency } from '../types';

export const CurrencyToggle: React.FC = () => {
  const { currency, setCurrency, theme } = useAppStore();
  const c = theme.colors;

  const currencies: Currency[] = ['USD', 'INR'];

  return (
    <View style={[styles.container, { backgroundColor: c.surface }]}>
      {currencies.map((curr) => (
        <TouchableOpacity
          key={curr}
          style={[
            styles.button,
            currency === curr && { backgroundColor: c.accent },
          ]}
          onPress={() => setCurrency(curr)}
        >
          <Text
            style={[
              styles.buttonText,
              { color: c.textSecondary },
              currency === curr && { color: '#fff' },
            ]}
          >
            {curr === 'USD' ? '$' : '₹'} {curr}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 4,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
