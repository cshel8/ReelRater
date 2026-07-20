import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { userDirectoryService } from '@/services';
import { userStore } from '@/store/userStore';
import type { PublicUserProfile } from '@/types/domain';

function ProfileAvatar({ profile }: { profile: PublicUserProfile }) {
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

export default function FindPeopleScreen() {
  const pathname = usePathname();
  const currentUserId = userStore((state) => state.userId);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<PublicUserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedSearchTerm = searchTerm.trim().replace(/^@/, '');

  useEffect(() => {
    if (!normalizedSearchTerm) {
      setResults([]);
      setError(null);
      setIsSearching(false);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setIsSearching(true);
      setError(null);

      userDirectoryService
        .searchByHandle(normalizedSearchTerm, currentUserId ?? undefined)
        .then((profiles) => {
          if (active) {
            setResults(profiles);
          }
        })
        .catch((searchError) => {
          if (active) {
            setResults([]);
            setError(
              searchError instanceof Error
                ? searchError.message
                : 'Profile search failed'
            );
          }
        })
        .finally(() => {
          if (active) {
            setIsSearching(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentUserId, normalizedSearchTerm]);

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={results}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(profile) => profile.id}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          {isSearching ? (
            <>
              <ActivityIndicator color={colors.reviewAccent} size="large" />
              <Text style={styles.emptyText}>Searching…</Text>
            </>
          ) : (
            <>
              <Ionicons
                color="#C4C7CE"
                name={error ? 'alert-circle-outline' : 'people-outline'}
                size={44}
              />
              <Text style={styles.emptyTitle}>
                {error
                  ? 'Unable to search profiles'
                  : normalizedSearchTerm
                    ? 'No matching people'
                    : 'Search by handle'}
              </Text>
              <Text style={styles.emptyText}>
                {error
                  ? 'Check your connection and Firestore profile-read rules.'
                  : normalizedSearchTerm
                    ? 'Try another handle.'
                    : 'Enter a username to find other movie fans.'}
              </Text>
            </>
          )}
        </View>
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.searchField}>
            <Ionicons color="#7B8190" name="search-outline" size={23} />
            <TextInput
              accessibilityLabel="Search people by handle"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setSearchTerm}
              placeholder="Search by handle"
              placeholderTextColor="#9DA3AE"
              returnKeyType="search"
              style={styles.searchInput}
              value={searchTerm}
            />
            {searchTerm.length > 0 && (
              <Pressable
                accessibilityLabel="Clear search"
                hitSlop={8}
                onPress={() => setSearchTerm('')}
              >
                <Ionicons color="#858B96" name="close-circle" size={20} />
              </Pressable>
            )}
          </View>
          {results.length > 0 && (
            <Text style={styles.resultLabel}>People</Text>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityHint="Opens this public profile"
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: pathname.startsWith('/community')
                ? '/community/[userId]'
                : '/profile/[userId]',
              params: { userId: item.id },
            })
          }
          style={({ pressed }) => [
            styles.profileRow,
            pressed && styles.profileRowPressed,
          ]}
        >
          <ProfileAvatar profile={item} />
          <View style={styles.profileIdentity}>
            <Text numberOfLines={1} style={styles.displayName}>
              {item.displayName}
            </Text>
            <Text numberOfLines={1} style={styles.handle}>
              @{item.handle}
            </Text>
          </View>
          <Ionicons color="#858B96" name="chevron-forward" size={21} />
        </Pressable>
      )}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  header: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  searchField: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: '#D9DCE3',
    borderRadius: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    color: '#1D1D23',
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
  },
  resultLabel: {
    color: '#17171C',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 26,
    marginBottom: 8,
  },
  profileRow: {
    width: '100%',
    maxWidth: 560,
    minHeight: 76,
    alignSelf: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEDEF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  profileRowPressed: {
    opacity: 0.55,
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
  profileIdentity: {
    flex: 1,
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
  emptyState: {
    minHeight: 340,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyTitle: {
    color: '#3E4148',
    fontSize: 17,
    fontWeight: '600',
    marginTop: 14,
    textAlign: 'center',
  },
  emptyText: {
    color: '#858B96',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },
});
