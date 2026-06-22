import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import useStore from '../src/store/useStore';
import { COLORS } from '../src/constants/theme';

export default function Index() {
  const { loading } = useAuth();
  const user = useStore((s) => s.user);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role === 'parent') return <Redirect href="/(parent)/dashboard" />;
  return <Redirect href="/(child)/my-chores" />;
}
