import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';

export type CommunityMode = 'following' | 'everyone';

export function CommunityModeToggle({
  mode,
  onChange,
}: {
  mode: CommunityMode;
  onChange: (mode: CommunityMode) => void;
}) {
  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {(['following', 'everyone'] as const).map((option) => {
        const selected = mode === option;
        const label = option === 'following' ? 'Following' : 'Everyone';
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              styles.option,
              selected && styles.selectedOption,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.optionText, selected && styles.selectedOptionText]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F1F4',
    borderRadius: 18,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 3,
  },
  option: {
    alignItems: 'center',
    borderRadius: 15,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  selectedOption: {
    backgroundColor: colors.reviewAccent,
    shadowColor: '#7A263C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  optionText: {
    color: '#4C5360',
    fontSize: 14,
    fontWeight: '700',
  },
  selectedOptionText: {
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.72,
  },
});
