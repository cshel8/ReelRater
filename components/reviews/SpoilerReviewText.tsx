import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';

export function SpoilerReviewText({
  numberOfLines,
  onReveal,
  presentation = 'inline',
  reviewText,
  spoilerWarning,
  textStyle,
}: {
  numberOfLines?: number;
  onReveal?: () => void;
  presentation?: 'community' | 'inline';
  reviewText: string;
  spoilerWarning: boolean;
  textStyle?: object;
}) {
  const [isRevealed, setIsRevealed] = useState(false);

  if (!spoilerWarning || isRevealed) {
    return (
      <Text numberOfLines={numberOfLines} style={textStyle}>
        {reviewText}
      </Text>
    );
  }

  return (
    <View accessibilityLabel="Spoiler warning" style={[styles.cover, presentation === 'community' ? styles.communityCover : styles.inlineCover]}>
      <View style={[styles.messageRow, presentation === 'inline' && styles.inlineMessageRow]}>
        <Ionicons color={colors.reviewAccentText} name="eye-off-outline" size={18} />
        <View style={styles.copy}>
          <Text style={styles.title}>Contains spoilers</Text>
          <Text style={styles.description}>This review is hidden to avoid spoilers.</Text>
        </View>
      </View>
      <Pressable
          accessibilityRole="button"
          onPress={() => {
            setIsRevealed(true);
            onReveal?.();
          }}
          style={({ pressed }) => [styles.revealButton, presentation === 'community' && styles.communityRevealButton, pressed && styles.pressed]}
        >
          <Text style={styles.revealText}>Reveal Review</Text>
        </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    backgroundColor: '#FFF5F7',
    borderColor: '#F6C9D5',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  inlineCover: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  communityCover: {
    marginTop: 12,
    padding: 11,
  },
  messageRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  inlineMessageRow: { flex: 1 },
  copy: {
    flex: 1,
  },
  title: {
    color: '#96374F',
    fontSize: 13,
    fontWeight: '700',
  },
  description: {
    color: '#7B6670',
    fontSize: 12,
    marginTop: 1,
  },
  revealButton: {
    alignSelf: 'flex-end',
    borderColor: colors.reviewAccent,
    borderRadius: 7,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  communityRevealButton: { alignSelf: 'stretch', alignItems: 'center', marginTop: 10 },
  revealText: {
    color: colors.reviewAccentText,
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.6,
  },
});
