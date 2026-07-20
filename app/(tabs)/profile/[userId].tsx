import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { followService, userDirectoryService } from '@/services';
import { userStore } from '@/store/userStore';
import type { FollowStatus, PublicUserProfile } from '@/types/domain';

export default function PublicProfileScreen() {
  const currentUserId = userStore((state) => state.userId);
  const { userId: userIdParameter } = useLocalSearchParams<{
    userId: string | string[];
  }>();
  const userId = Array.isArray(userIdParameter)
    ? userIdParameter[0]
    : userIdParameter;
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);
  const [isChangingFollow, setIsChangingFollow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      if (!userId) {
        setError('This profile could not be found.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const [result, relationshipStatus] = await Promise.all([
          userDirectoryService.getById(userId),
          currentUserId && currentUserId !== userId
            ? followService.getStatus(currentUserId, userId)
            : Promise.resolve(null),
        ]);
        if (active) {
          setProfile(result);
          setFollowStatus(relationshipStatus);
          if (!result) {
            setError('This profile could not be found.');
          }
        }
      } catch (profileError) {
        if (active) {
          setProfile(null);
          setError(
            profileError instanceof Error
              ? profileError.message
              : 'This profile could not be loaded.'
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadProfile();
    return () => {
      active = false;
    };
  }, [currentUserId, retryCount, userId]);

  const follow = async () => {
    if (!currentUserId || !userId || isChangingFollow) {
      return;
    }

    setIsChangingFollow(true);
    try {
      await followService.follow(currentUserId, userId);
      setFollowStatus(
        (await followService.getStatus(currentUserId, userId)) ?? 'active'
      );
    } catch (followError) {
      Alert.alert(
        'Could not follow this person',
        followError instanceof Error
          ? followError.message
          : 'Please try again.'
      );
    } finally {
      setIsChangingFollow(false);
    }
  };

  const unfollow = async () => {
    if (!currentUserId || !userId || isChangingFollow) {
      return;
    }

    setIsChangingFollow(true);
    try {
      await followService.unfollow(currentUserId, userId);
      setFollowStatus(null);
    } catch (unfollowError) {
      Alert.alert(
        'Could not unfollow this person',
        unfollowError instanceof Error
          ? unfollowError.message
          : 'Please try again.'
      );
    } finally {
      setIsChangingFollow(false);
    }
  };

  const confirmRemoveRelationship = () => {
    const pending = followStatus === 'pending';
    Alert.alert(
      pending
        ? `Cancel request to @${profile?.handle ?? ''}?`
        : `Unfollow @${profile?.handle ?? ''}?`,
      pending
        ? 'They will no longer see this follow request.'
        : 'Their reviews will no longer appear in your community feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: pending ? 'Cancel Request' : 'Unfollow',
          style: 'destructive',
          onPress: () => void unfollow(),
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.reviewAccent} size="large" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Ionicons color="#C4C7CE" name="person-outline" size={48} />
        <Text style={styles.errorTitle}>Profile unavailable</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setRetryCount((count) => count + 1)}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {profile.profileImage ? (
        <Image source={{ uri: profile.profileImage }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {profile.displayName.trim().charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
      )}

      <Text style={styles.displayName}>{profile.displayName}</Text>
      <Text style={styles.handle}>@{profile.handle}</Text>
      {profile.accountPrivacy === 'private' ? (
        <View style={styles.privateBadge}>
          <Ionicons color="#737A86" name="lock-closed" size={12} />
          <Text style={styles.privateBadgeText}>Private account</Text>
        </View>
      ) : null}

      {currentUserId && currentUserId !== profile.id ? (
        <Pressable
          accessibilityRole="button"
          disabled={isChangingFollow}
          onPress={
            followStatus ? confirmRemoveRelationship : () => void follow()
          }
          style={({ pressed }) => [
            styles.followButton,
            followStatus && styles.followingButton,
            (pressed || isChangingFollow) && styles.buttonPressed,
          ]}
        >
          {isChangingFollow ? (
            <ActivityIndicator
              color={followStatus ? colors.reviewAccentText : '#FFFFFF'}
              size="small"
            />
          ) : (
            <>
              <Ionicons
                color={followStatus ? colors.reviewAccentText : '#FFFFFF'}
                name={
                  followStatus === 'active'
                    ? 'checkmark'
                    : followStatus === 'pending'
                      ? 'time-outline'
                      : 'person-add-outline'
                }
                size={18}
              />
              <Text
                style={[
                  styles.followButtonText,
                  followStatus && styles.followingButtonText,
                ]}
              >
                {followStatus === 'active'
                  ? 'Following'
                  : followStatus === 'pending'
                    ? 'Requested'
                    : 'Follow'}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  loadingText: {
    color: '#858B96',
    marginTop: 12,
  },
  errorTitle: {
    color: '#3E4148',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
  },
  errorText: {
    color: '#858B96',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
    textAlign: 'center',
  },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.reviewAccent,
    borderRadius: 8,
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: colors.reviewAccentText,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.55,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  avatarPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.reviewAccentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.reviewAccentText,
    fontSize: 42,
    fontWeight: '700',
  },
  displayName: {
    color: '#1F2937',
    fontSize: 25,
    fontWeight: '700',
    marginTop: 20,
  },
  handle: {
    color: '#7B8190',
    fontSize: 16,
    marginTop: 5,
  },
  privateBadge: {
    borderRadius: 12,
    backgroundColor: '#F0F1F3',
    marginTop: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  privateBadgeText: {
    color: '#737A86',
    fontSize: 12,
    fontWeight: '600',
  },
  followButton: {
    minWidth: 150,
    minHeight: 46,
    borderRadius: 9,
    backgroundColor: colors.reviewAccent,
    marginTop: 24,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  followingButton: {
    backgroundColor: colors.reviewAccentSoft,
    borderWidth: 1,
    borderColor: colors.reviewAccent,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  followingButtonText: {
    color: colors.reviewAccentText,
  },
});
