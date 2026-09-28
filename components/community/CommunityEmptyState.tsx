import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';

export type CommunityEmptyStateKind =
  | 'error'
  | 'following-empty'
  | 'following-quiet'
  | 'following-saved-empty'
  | 'filtered'
  | 'search'
  | 'everyone-empty'
  | 'everyone-saved-empty'
  | 'everyone-unavailable';

export function CommunityEmptyState({
  kind,
  onExploreEveryone,
  onFindPeople,
  onRetry,
}: {
  kind: CommunityEmptyStateKind;
  onExploreEveryone?: () => void;
  onFindPeople?: () => void;
  onRetry?: () => void;
}) {
  const content = {
    error: {
      icon: 'cloud-offline-outline' as const,
      title: 'Community unavailable',
      body: 'This feed is online-only for now. Check your connection and try again.',
    },
    'following-empty': {
      icon: 'people-outline' as const,
      title: 'Your Following feed is quiet',
      body: 'Follow other movie fans to see the reviews they share, or explore what the wider community is discussing.',
    },
    'following-quiet': {
      icon: 'people-outline' as const,
      title: 'Your Following feed is quiet',
      body: 'People you follow are not sharing any reviews that match this view yet.',
    },
    'following-saved-empty': {
      icon: 'cloud-offline-outline' as const,
      title: 'No saved Following reviews',
      body: 'Community could not be reached and there are no saved Following reviews for this view.',
    },
    filtered: {
      icon: 'film-outline' as const,
      title: 'No reviews for this filter',
      body: 'Try a different media filter or sort order.',
    },
    search: {
      icon: 'search-outline' as const,
      title: 'No matching reviews',
      body: 'Try another title or phrase from a review.',
    },
    'everyone-empty': {
      icon: 'newspaper-outline' as const,
      title: 'No public reviews yet',
      body: 'Public reviews from the ReelRater community will appear here.',
    },
    'everyone-saved-empty': {
      icon: 'cloud-offline-outline' as const,
      title: 'No saved public reviews',
      body: 'Community could not be reached and there are no saved public reviews for this view.',
    },
    'everyone-unavailable': {
      icon: 'newspaper-outline' as const,
      title: 'Everyone is coming next',
      body: 'Broader public discovery is being added in the next Community checkpoint.',
    },
  }[kind];

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons color={colors.reviewAccent} name={content.icon} size={31} />
      </View>
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.body}>{content.body}</Text>
      {kind === 'error' || kind === 'everyone-saved-empty' || kind === 'following-saved-empty' ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.outlineButton}>
          <Text style={styles.outlineButtonText}>Try Again</Text>
        </Pressable>
      ) : null}
      {kind === 'following-empty' ? (
        <>
          <Pressable accessibilityRole="button" onPress={onFindPeople} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Find People</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onExploreEveryone} style={styles.secondaryTextButton}>
            <Text style={styles.secondaryTextButtonText}>Explore Everyone</Text>
          </Pressable>
        </>
      ) : null}
      {kind === 'following-quiet' ? (
        <Pressable accessibilityRole="button" onPress={onExploreEveryone} style={styles.outlineButton}>
          <Text style={styles.outlineButtonText}>Explore Everyone</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  iconCircle: { alignItems: 'center', backgroundColor: colors.reviewAccentSoft, borderRadius: 32, height: 64, justifyContent: 'center', width: 64 },
  title: { color: '#23252B', fontSize: 20, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  body: { color: '#737A86', fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: 'center' },
  primaryButton: { alignItems: 'center', backgroundColor: colors.reviewAccent, borderRadius: 9, justifyContent: 'center', marginTop: 22, minHeight: 46, paddingHorizontal: 21 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700' },
  outlineButton: { alignItems: 'center', borderColor: colors.reviewAccent, borderRadius: 9, borderWidth: 1, justifyContent: 'center', marginTop: 22, minHeight: 44, paddingHorizontal: 21 },
  outlineButtonText: { color: colors.reviewAccentText, fontWeight: '700' },
  secondaryTextButton: { alignItems: 'center', justifyContent: 'center', marginTop: 12, minHeight: 36, paddingHorizontal: 12 },
  secondaryTextButtonText: { color: colors.reviewAccentText, fontSize: 14, fontWeight: '700' },
});
