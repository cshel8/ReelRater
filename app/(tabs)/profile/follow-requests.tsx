import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { followService, userDirectoryService } from '@/services';
import { userStore } from '@/store/userStore';
import type { PublicUserProfile } from '@/types/domain';

export default function FollowRequestsScreen() {
  const userId = userStore((state) => state.userId);
  const [profiles, setProfiles] = useState<PublicUserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refreshing = false) => {
      if (!userId) {
        setIsLoading(false);
        return;
      }
      refreshing ? setIsRefreshing(true) : setIsLoading(true);
      setError(null);
      try {
        const requests = await followService.listPendingRequests(userId);
        const results = await Promise.all(
          requests.map((request) =>
            userDirectoryService.getById(request.followerId)
          )
        );
        setProfiles(
          results.filter(
            (profile): profile is PublicUserProfile => profile !== null
          )
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Follow requests could not be loaded.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [userId]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const respond = async (
    followerId: string,
    response: 'approve' | 'reject'
  ) => {
    if (!userId || changingId) {
      return;
    }
    setChangingId(followerId);
    try {
      if (response === 'approve') {
        await followService.approveFollower(userId, followerId);
      } else {
        await followService.rejectFollower(userId, followerId);
      }
      setProfiles((current) =>
        current.filter((profile) => profile.id !== followerId)
      );
    } catch (responseError) {
      Alert.alert(
        'Could not update request',
        responseError instanceof Error
          ? responseError.message
          : 'Please try again.'
      );
    } finally {
      setChangingId(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.reviewAccent} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={[
        styles.content,
        profiles.length === 0 && styles.emptyContent,
      ]}
      data={profiles}
      keyExtractor={(profile) => profile.id}
      refreshControl={
        <RefreshControl
          onRefresh={() => void load(true)}
          refreshing={isRefreshing}
          tintColor={colors.reviewAccent}
        />
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons
            color="#C4C7CE"
            name={error ? 'alert-circle-outline' : 'person-add-outline'}
            size={46}
          />
          <Text style={styles.emptyTitle}>
            {error ? 'Unable to load requests' : 'No follow requests'}
          </Text>
          <Text style={styles.emptyText}>
            {error
              ? 'Check your connection and Firestore follower rules.'
              : 'New requests for your private account will appear here.'}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/profile/[userId]',
                params: { userId: item.id },
              })
            }
            style={({ pressed }) => [
              styles.profileLink,
              pressed && styles.pressed,
            ]}
          >
            {item.profileImage ? (
              <Image source={{ uri: item.profileImage }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {item.displayName.trim().charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.identity}>
              <Text numberOfLines={1} style={styles.name}>
                {item.displayName}
              </Text>
              <Text numberOfLines={1} style={styles.handle}>
                @{item.handle}
              </Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel={`Decline @${item.handle}`}
            disabled={changingId === item.id}
            onPress={() => void respond(item.id, 'reject')}
            style={({ pressed }) => [
              styles.declineButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons color="#737A86" name="close" size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel={`Approve @${item.handle}`}
            disabled={changingId === item.id}
            onPress={() => void respond(item.id, 'approve')}
            style={({ pressed }) => [
              styles.approveButton,
              pressed && styles.pressed,
            ]}
          >
            {changingId === item.id ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.approveText}>Approve</Text>
            )}
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 34,
  },
  emptyContent: {
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: '#3E4148',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
  },
  emptyText: {
    color: '#858B96',
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'center',
  },
  row: {
    minHeight: 78,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEDEF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileLink: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.reviewAccentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.reviewAccentText,
    fontSize: 18,
    fontWeight: '700',
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: '#24252A',
    fontWeight: '700',
  },
  handle: {
    color: '#7B8190',
    fontSize: 13,
    marginTop: 3,
  },
  declineButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#F0F1F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    minWidth: 78,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.reviewAccent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  approveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.55,
  },
});
