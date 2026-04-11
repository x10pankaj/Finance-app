import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { useAppStore } from '../store';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({ title, onPress, variant = 'primary', loading = false, disabled = false, style }) => {
  const { theme } = useAppStore();
  const c = theme.colors;

  const getBg = () => {
    switch (variant) {
      case 'secondary': return 'transparent';
      case 'danger': return '#f44336';
      default: return c.accent;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'secondary': return c.accent;
      default: return '#fff';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: getBg() },
        variant === 'secondary' && { borderWidth: 1, borderColor: c.accent },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={[styles.buttonText, { color: getTextColor() }]}>{title}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: { padding: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  disabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600' },
});
