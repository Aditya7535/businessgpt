import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'white' | 'warm' | 'dark' | 'lime' | 'lavender';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'white',
  ...props
}) => {
  const getBgColor = () => {
    switch (variant) {
      case 'warm':
        return Colors.warmBg;
      case 'dark':
        return Colors.surfaceDark;
      case 'lime':
        return Colors.limeBg;
      case 'lavender':
        return Colors.lavenderBg;
      default:
        return Colors.white;
    }
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: getBgColor() },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    ...Shadows.brutal,
  },
});

export default Card;
