import React from 'react';
import { Tabs } from 'expo-router';
import Colors from '../../constants/colors';
import {
  LayoutDashboard,
  Boxes,
  ShoppingBag,
  Sparkles,
  Menu,
} from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopWidth: 2,
          borderTopColor: Colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.black,
        tabBarInactiveTintColor: Colors.textDim,
        tabBarLabelStyle: {
          fontWeight: '800',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size, focused }) => (
            <LayoutDashboard
              size={22}
              color={focused ? Colors.black : color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color, size, focused }) => (
            <Boxes
              size={22}
              color={focused ? Colors.black : color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="pos"
        options={{
          title: 'POS Bill',
          tabBarIcon: ({ color, size, focused }) => (
            <ShoppingBag
              size={22}
              color={focused ? Colors.black : color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: 'AI Copilot',
          tabBarIcon: ({ color, size, focused }) => (
            <Sparkles
              size={22}
              color={focused ? Colors.lavenderDark : color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size, focused }) => (
            <Menu
              size={22}
              color={focused ? Colors.black : color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
    </Tabs>
  );
}
