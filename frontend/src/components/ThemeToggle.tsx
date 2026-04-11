import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store';

export const ThemeToggle: React.FC = () => {
  const { themeMode, toggleTheme, theme } = useAppStore();
  const c = theme.colors;

  return (
    <TouchableOpacity
      testID="theme-toggle-btn"
      style={[styles.button, { backgroundColor: c.surface }]}
      onPress={toggleTheme}
    >
      <Ionicons
        name={themeMode === 'dark' ? 'sunny-outline' : 'moon-outline'}
        size={20}
        color={c.text}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
