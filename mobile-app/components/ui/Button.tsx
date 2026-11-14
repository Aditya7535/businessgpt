import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
  View,
} from 'react-native';
import Colors from '../../constants/colors';
import { Shadows } from '../../constants/theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'dark' | 'outline' | 'danger' | 'lavender';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  style,
  disabled,
  ...props
}) => {
  const getBackgroundColor = () => {
    if (disabled) return '#E5E2D9';
    switch (variant) {
      case 'primary':
        return Colors.lime;
      case 'dark':
        return Colors.black;
      case 'outline':
        return Colors.white;
      case 'danger':
        return Colors.red;
      case 'lavender':
        return Colors.lavender;
    }
  };

  const getTextColor = () => {
    if (disabled) return '#8E8E93';
    switch (variant) {
      case 'dark':
        return Colors.white;
      default:
        return Colors.black;
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'sm':
        return { paddingVertical: 8, paddingHorizontal: 12, fontSize: 13 };
      case 'lg':
        return { paddingVertical: 16, paddingHorizontal: 24, fontSize: 17 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 18, fontSize: 15 };
    }
  };

  const p = getPadding();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          backgroundColor: getBackgroundColor(),
          paddingVertical: p.paddingVertical,
          paddingHorizontal: p.paddingHorizontal,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'dark' ? Colors.white : Colors.black}
        />
      ) : (
        <View style={styles.content}>
          {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
          <Text
            style={[
              styles.text,
              { color: getTextColor(), fontSize: p.fontSize },
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.brutalSm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconContainer: {
    marginRight: 2,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default Button;
