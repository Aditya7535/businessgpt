import { Stack } from 'expo-router';
import Colors from '../../constants/colors';

export default function AuthLayout() {
  return (
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
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: 'Login · BusinessGPT' }} />
      <Stack.Screen name="setup-store" options={{ title: 'Setup Your Store' }} />
    </Stack>
  );
}
