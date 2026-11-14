import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import useAuthStore from '../store/authStore';
import Colors from '../constants/colors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

export default function RootLayout() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider style={styles.container}>
        <View style={styles.container}>
          <StatusBar style="dark" backgroundColor={Colors.warmBg} />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: Colors.warmBg,
              },
              headerTintColor: Colors.textMain,
              headerTitleStyle: {
                fontWeight: '800',
              },
              contentStyle: {
                backgroundColor: Colors.warmBg,
              },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="customers/index"
              options={{ title: 'Customer Ledger' }}
            />
            <Stack.Screen
              name="customers/[id]"
              options={{ title: 'Customer Details' }}
            />
            <Stack.Screen
              name="analytics/index"
              options={{ title: 'Sales Analytics' }}
            />
            <Stack.Screen
              name="forecasting/index"
              options={{ title: 'AI Demand Forecast' }}
            />
            <Stack.Screen
              name="reports/index"
              options={{ title: 'Business Reports' }}
            />
            <Stack.Screen
              name="alerts/index"
              options={{ title: 'Action Alerts' }}
            />
            <Stack.Screen
              name="whatsapp/index"
              options={{ title: 'WhatsApp Integration' }}
            />
            <Stack.Screen
              name="settings/index"
              options={{ title: 'Store Settings' }}
            />
          </Stack>
        </View>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.warmBg,
    width: '100%',
    height: '100%',
  },
});
