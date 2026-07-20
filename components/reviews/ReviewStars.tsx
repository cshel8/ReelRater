import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/colors';

interface ReviewStarsProps {
  rating: string;
  size?: number;
}

export function ReviewStars({ rating, size = 17 }: ReviewStarsProps) {
  const numericRating = Math.min(5, Math.max(0, Number(rating) || 0));

  return (
    <View
      accessibilityLabel={`${numericRating} out of 5 stars`}
      style={styles.stars}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <Ionicons
          color={colors.reviewAccent}
          key={value}
          name={value <= numericRating ? 'star' : 'star-outline'}
          size={size}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stars: {
    flexDirection: 'row',
    gap: 3,
  },
});
