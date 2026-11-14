import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../../constants/colors';

interface BadgeProps {
  label: string;
  variant?: 'lime' | 'red' | 'lavender' | 'amber' | 'blue' | 'neutral';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'md',
}) => {
  const getColors = () => {
    switch (variant) {
      case 'lime':
        return { bg: Colors.limeBg, text: Colors.limeDark };
      case 'red':
        return { bg: Colors.redBg, text: Colors.redDark };
      case 'lavender':
        return { bg: Colors.lavenderBg, text: Colors.lavenderDark };
      case 'amber':
        return { bg: Colors.amberBg, text: Colors.amberDark };
      case 'blue':
        return { bg: Colors.blueBg, text: Colors.blueDark };
      default:
        return { bg: Colors.surfaceElevated, text: Colors.textMain };
    }
  };

  const { bg, text } = getColors();
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          paddingVertical: isSm ? 2 : 4,
          paddingHorizontal: isSm ? 6 : 8,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: text,
            fontSize: isSm ? 10 : 12,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default Badge;
