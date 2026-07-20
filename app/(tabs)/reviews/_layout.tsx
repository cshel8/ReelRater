import { Stack } from 'expo-router';
import { colors } from '@/constants/colors';

export default function ReviewsLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: 'Reviews',
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
      <Stack.Screen
        name="index"
        options={{
          title: 'My Reviews',
        }}
      />
      <Stack.Screen
        name="write"
        options={{
          title: 'Write Review',
        }}
      />
      <Stack.Screen
        name="[reviewId]"
        options={{
          title: 'Review Details',
        }}
      />
    </Stack>
  );
}
