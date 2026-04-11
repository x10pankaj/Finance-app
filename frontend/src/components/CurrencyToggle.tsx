import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppStore } from '../store';
import { Currency } from '../types';

export const CurrencyToggle: React.FC = () => {
  const { currency, setCurrency } = useAppStore();

  const currencies: Currency[] = ['USD', 'INR'];

  return (
    <View style={styles.container}>
      {currencies.map((curr) => (
        <TouchableOpacity
          key={curr}
          style={[
            styles.button,
            currency === curr && styles.activeButton,
          ]}
          onPress={() => setCurrency(curr)}
        >
          <Text
            style={[
              styles.buttonText,
              currency === curr && styles.activeButtonText,
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
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 4,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  activeButtonText: {
    color: '#fff',
  },
});
