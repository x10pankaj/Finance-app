import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, style, onPress }) => {
  const { theme } = useAppStore();
  const c = theme.colors;
  const cardStyle = [{ backgroundColor: c.card, borderRadius: 12, padding: 16, marginBottom: 12 }, style];

  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

interface StatCardProps {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color = '#4CAF50',
  trend,
}) => {
  const { theme } = useAppStore();
  const c = theme.colors;

  return (
    <View style={[styles.statCard, { backgroundColor: c.card }]}>
      <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={[styles.statTitle, { color: c.textSecondary }]}>{title}</Text>
      <View style={styles.valueContainer}>
        <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  statCard: {
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: 140,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statTitle: {
    fontSize: 13,
    marginBottom: 4,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
