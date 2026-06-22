import { Tabs } from 'expo-router';
import { COLORS } from '../../src/constants/theme';

export default function ParentLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.subtext,
        tabBarStyle: { backgroundColor: COLORS.card, borderTopColor: COLORS.border },
        headerStyle: { backgroundColor: COLORS.card },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard', tabBarLabel: 'Home', tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} /> }} />
      <Tabs.Screen name="chores" options={{ title: 'Chores', tabBarLabel: 'Chores', tabBarIcon: ({ color }) => <TabIcon icon="✅" color={color} /> }} />
      <Tabs.Screen name="monitoring" options={{ title: 'Monitoring', tabBarLabel: 'Monitor', tabBarIcon: ({ color }) => <TabIcon icon="👁" color={color} /> }} />
    </Tabs>
  );
}

function TabIcon({ icon }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20 }}>{icon}</Text>;
}
