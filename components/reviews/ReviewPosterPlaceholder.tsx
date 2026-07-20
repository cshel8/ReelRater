import { Ionicons } from '@expo/vector-icons';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/colors';

interface ReviewPosterPlaceholderProps {
  title: string;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}

export function ReviewPosterPlaceholder({
  title,
  iconSize = 31,
  style,
}: ReviewPosterPlaceholderProps) {
  return (
    <View
      accessibilityLabel={`Poster placeholder for ${title}`}
      style={[styles.poster, style]}
    >
      <Ionicons
        color={colors.reviewAccent}
        name="film-outline"
        size={iconSize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  poster: {
    backgroundColor: colors.reviewAccentSoft,
    borderWidth: 1,
    borderColor: '#F1CAD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
