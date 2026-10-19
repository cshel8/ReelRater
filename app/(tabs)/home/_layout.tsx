import { Stack } from 'expo-router';
import { colors } from '@/constants/colors';

export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Home',
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
      <Stack.Screen name="index" options={{ title: '' }} />
      <Stack.Screen
        name="media/[catalogId]"
        options={{ title: 'Details' }}
      />
    </Stack>
  );
}
