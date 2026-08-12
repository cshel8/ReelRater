import { useLocalSearchParams } from 'expo-router';
import { ConnectionList } from '@/components/profile/ConnectionList';

export default function FollowersScreen() {
  const { userId } = useLocalSearchParams<{ userId?: string | string[] }>();
  return (
    <ConnectionList
      mode="followers"
      userId={Array.isArray(userId) ? userId[0] : userId}
    />
  );
}
