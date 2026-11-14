import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import useAuthStore from '../store/authStore';
import Colors from '../constants/colors';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function IndexGateway() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Image
          source={require('../assets/logo_transparent.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.badge}>
          <Text style={styles.badgeText}>AI BUSINESS PARTNER</Text>
        </View>
        <View style={{ marginTop: 24 }}>
          <LoadingSpinner message="Connecting to BusinessGPT..." />
        </View>
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/onboarding" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    width: '100%',
    height: '100%',
  },
  logo: {
    width: 240,
    height: 120,
    marginBottom: 16,
  },
  badge: {
    backgroundColor: Colors.lime,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.black,
    letterSpacing: 1,
  },
});
