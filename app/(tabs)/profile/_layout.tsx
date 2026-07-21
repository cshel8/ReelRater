import { Stack } from 'expo-router';
import { colors } from '@/constants/colors';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Profile',
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
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="find-people" options={{ title: 'Find People' }} />
      <Stack.Screen name="followers" options={{ title: 'Followers' }} />
      <Stack.Screen name="following" options={{ title: 'Following' }} />
      <Stack.Screen
        name="follow-requests"
        options={{ title: 'Follow Requests' }}
      />
      <Stack.Screen
        name="privacy-visibility"
        options={{ title: 'Privacy & Visibility' }}
      />
      <Stack.Screen
        name="about-credits"
        options={{ title: 'About & Credits' }}
      />
      <Stack.Screen name="[userId]" options={{ title: 'Profile' }} />
    </Stack>
  );
}
