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

type ConnectionMode = 'followers' | 'following';

type ConnectionItem = {
  relationshipUserId: string;
  profile: PublicUserProfile;
};

type ConnectionListProps = {
  mode: ConnectionMode;
};

function ConnectionAvatar({ profile }: { profile: PublicUserProfile }) {
  if (profile.profileImage) {
    return <Image source={{ uri: profile.profileImage }} style={styles.avatar} />;
  }

  return (
    <View style={styles.avatarPlaceholder}>
      <Text style={styles.avatarText}>
        {profile.displayName.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

export function ConnectionList({ mode }: ConnectionListProps) {
  const currentUserId = userStore((state) => state.userId);
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [changingUserId, setChangingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = useCallback(
    async (refreshing = false) => {
      if (!currentUserId) {
        setConnections([]);
        setError('Sign in to view these connections.');
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const relationships =
          mode === 'followers'
            ? await followService.listFollowers(currentUserId)
            : await followService.listFollowing(currentUserId);
        const userIds = relationships.map((relationship) =>
          mode === 'followers'
            ? relationship.followerId
            : relationship.followedUserId
        );
        const profiles = await Promise.all(
          userIds.map((userId) => userDirectoryService.getById(userId))
        );

        setConnections(
          profiles.flatMap((profile, index) =>
            profile
              ? [{ profile, relationshipUserId: userIds[index] }]
              : []
          )
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'These connections could not be loaded.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentUserId, mode]
  );

  useFocusEffect(
    useCallback(() => {
      void loadConnections();
    }, [loadConnections])
  );

  const removeConnection = async (item: ConnectionItem) => {
    if (!currentUserId || changingUserId) {
      return;
    }

    setChangingUserId(item.relationshipUserId);
    try {
      if (mode === 'followers') {
        await followService.removeFollower(
          currentUserId,
          item.relationshipUserId
        );
      } else {
        await followService.unfollow(
          currentUserId,
          item.relationshipUserId
        );
      }
      setConnections((current) =>
        current.filter(
          (connection) =>
            connection.relationshipUserId !== item.relationshipUserId
        )
      );
    } catch (removeError) {
      Alert.alert(
        mode === 'followers'
          ? 'Could not remove follower'
          : 'Could not unfollow',
        removeError instanceof Error ? removeError.message : 'Please try again.'
      );
    } finally {
      setChangingUserId(null);
    }
  };

  const confirmRemove = (item: ConnectionItem) => {
    const isFollower = mode === 'followers';
    Alert.alert(
      isFollower
        ? `Remove @${item.profile.handle}?`
        : `Unfollow @${item.profile.handle}?`,
      isFollower
        ? 'They will stop seeing followers-only reviews. This does not block them, so they can follow you again.'
        : 'Their reviews will no longer appear in your community feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isFollower ? 'Remove' : 'Unfollow',
          style: 'destructive',
          onPress: () => void removeConnection(item),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.reviewAccent} size="large" />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={[
        styles.content,
        connections.length === 0 && styles.emptyContent,
      ]}
      data={connections}
      keyExtractor={(item) => item.relationshipUserId}
      refreshControl={
        <RefreshControl
          colors={[colors.reviewAccent]}
          onRefresh={() => void loadConnections(true)}
          refreshing={isRefreshing}
          tintColor={colors.reviewAccent}
        />
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons
            color="#C4C7CE"
            name={error ? 'alert-circle-outline' : 'people-outline'}
            size={46}
          />
          <Text style={styles.emptyTitle}>
            {error
              ? 'Unable to load people'
              : mode === 'followers'
                ? 'No followers yet'
                : 'Not following anyone yet'}
          </Text>
          <Text style={styles.emptyText}>
            {error
              ? 'Check your connection and Firestore follower rules.'
              : mode === 'followers'
                ? 'People who follow you will appear here.'
                : 'Use Find People on your profile to discover movie fans.'}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.connectionRow}>
          <Pressable
            accessibilityHint="Opens this public profile"
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/profile/[userId]',
                params: { userId: item.profile.id },
              })
            }
            style={({ pressed }) => [
              styles.profileLink,
              pressed && styles.pressed,
            ]}
          >
            <ConnectionAvatar profile={item.profile} />
            <View style={styles.identity}>
              <Text numberOfLines={1} style={styles.displayName}>
                {item.profile.displayName}
              </Text>
              <Text numberOfLines={1} style={styles.handle}>
                @{item.profile.handle}
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={changingUserId === item.relationshipUserId}
            onPress={() => confirmRemove(item)}
            style={({ pressed }) => [
              styles.actionButton,
              (pressed || changingUserId === item.relationshipUserId) &&
                styles.pressed,
            ]}
          >
            {changingUserId === item.relationshipUserId ? (
              <ActivityIndicator color={colors.reviewAccentText} size="small" />
            ) : (
              <Text style={styles.actionText}>
                {mode === 'followers' ? 'Remove' : 'Unfollow'}
              </Text>
            )}
          </Pressable>
        </View>
      )}
      showsVerticalScrollIndicator={false}
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
  loadingText: {
    color: '#858B96',
    marginTop: 12,
  },
  content: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 36,
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
    textAlign: 'center',
  },
  emptyText: {
    color: '#858B96',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'center',
  },
  connectionRow: {
    width: '100%',
    maxWidth: 560,
    minHeight: 78,
    alignSelf: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEDEF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileLink: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.reviewAccentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.reviewAccentText,
    fontSize: 19,
    fontWeight: '700',
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  displayName: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
  },
  handle: {
    color: '#7B8190',
    fontSize: 14,
    marginTop: 3,
  },
  actionButton: {
    minWidth: 78,
    minHeight: 36,
    borderWidth: 1,
    borderColor: colors.reviewAccent,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  actionText: {
    color: colors.reviewAccentText,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.55,
  },
});
