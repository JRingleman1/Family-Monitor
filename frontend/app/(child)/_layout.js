import { Tabs } from 'expo-router';
import { COLORS } from '../../src/constants/theme';

export default function ChildLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.success,
        tabBarInactiveTintColor: COLORS.subtext,
        tabBarStyle: { backgroundColor: COLORS.card, borderTopColor: COLORS.border },
        headerStyle: { backgroundColor: COLORS.card },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="my-chores" options={{ title: 'My Chores', tabBarLabel: 'Chores', tabBarIcon: () => <TabIcon icon="📋" /> }} />
      <Tabs.Screen name="points" options={{ title: 'My Points', tabBarLabel: 'Points', tabBarIcon: () => <TabIcon icon="⭐" /> }} />
    </Tabs>
  );
}

function TabIcon({ icon }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 20 }}>{icon}</Text>;
}
