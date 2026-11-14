import { Platform } from 'react-native';

// Live tunnel URL that works globally on all phones, emulators, and browsers
export const CLOUD_BACKEND_URL = 'https://laborer-feline-absurd.ngrok-free.dev';
export const LOCAL_LAN_URL = 'http://192.168.1.8:8000';
export const LOCAL_DEV_URL = 'http://localhost:8000';

const getDefaultApiUrl = () => {
  // If explicitly specified in environment, use it
  if (process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL !== 'http://localhost:8000') {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // For web running on the local PC, localhost:8000 works directly
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8000';
  }

  // For physical phones (Android / iOS) and remote testing, always default to the live cloud tunnel
  return CLOUD_BACKEND_URL;
};

export const Config = {
  API_URL: getDefaultApiUrl(),
  TIMEOUT_MS: 15000,
  APP_NAME: 'BusinessGPT',
  VERSION: '1.0.0',
  DEFAULT_CURRENCY: 'INR',
  CURRENCY_SYMBOL: '₹',
};

export default Config;
