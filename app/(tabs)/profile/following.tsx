import { useLocalSearchParams } from 'expo-router';
import { ConnectionList } from '@/components/profile/ConnectionList';

export default function FollowingScreen() {
  const { userId } = useLocalSearchParams<{ userId?: string | string[] }>();
  return (
    <ConnectionList
      mode="following"
      userId={Array.isArray(userId) ? userId[0] : userId}
    />
  );
}
