import { Stack } from 'expo-router';
import { colors } from '@/constants/colors';

export default function CommunityLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Community',
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        headerTintColor: colors.reviewAccent,
        headerTitleStyle: {
          color: '#17171C',
          fontSize: 20,
          fontWeight: '700',
        },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Community' }} />
      <Stack.Screen name="find-people" options={{ title: 'Find People' }} />
      <Stack.Screen name="[userId]" options={{ title: 'Profile' }} />
    </Stack>
  );
}
