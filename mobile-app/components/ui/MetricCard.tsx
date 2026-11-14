import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  variant?: 'white' | 'lime' | 'lavender' | 'amber' | 'red';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  badge,
  variant = 'white',
}) => {
  const getBg = () => {
    switch (variant) {
      case 'lime':
        return Colors.limeBg;
      case 'lavender':
        return Colors.lavenderBg;
      case 'amber':
        return Colors.amberBg;
      case 'red':
        return Colors.redBg;
      default:
        return Colors.white;
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: getBg() }]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {icon && <View style={styles.iconBox}>{icon}</View>}
      </View>
      <View style={styles.body}>
        <Text style={styles.value}>{value}</Text>
        {badge}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    ...Shadows.brutalSm,
    flex: 1,
    minWidth: 150,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 6,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textMain,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textDim,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default MetricCard;
