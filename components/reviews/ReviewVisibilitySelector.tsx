import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import type { ReviewVisibility } from '@/types/domain';

const OPTIONS: {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: ReviewVisibility;
}[] = [
  {
    value: 'public',
    label: 'Public',
    icon: 'earth-outline',
    description: 'Anyone can discover and read this review.',
  },
  {
    value: 'followers',
    label: 'Followers Only',
    icon: 'people-outline',
    description: 'Only people who follow you can read it.',
  },
  {
    value: 'private',
    label: 'Only Me',
    icon: 'lock-closed-outline',
    description: 'Keep it private like a personal movie journal.',
  },
];

export function ReviewVisibilitySelector({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (visibility: ReviewVisibility) => void;
  value: ReviewVisibility;
}) {
  return (
    <View accessibilityRole="radiogroup" style={styles.options}>
      {OPTIONS.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              selected && styles.selectedOption,
              (pressed || disabled) && styles.muted,
            ]}
          >
            <View
              style={[
                styles.iconContainer,
                selected && styles.selectedIconContainer,
              ]}
            >
              <Ionicons
                color={selected ? colors.reviewAccentText : '#737A86'}
                name={option.icon}
                size={21}
              />
            </View>
            <View style={styles.textContainer}>
              <Text
                style={[
                  styles.optionLabel,
                  selected && styles.selectedOptionLabel,
                ]}
              >
                {option.label}
              </Text>
              <Text style={styles.description}>{option.description}</Text>
            </View>
            <View
              style={[
                styles.radio,
                selected && styles.selectedRadio,
              ]}
            >
              {selected ? <View style={styles.radioCenter} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function reviewVisibilityLabel(visibility: ReviewVisibility): string {
  if (visibility === 'public') {
    return 'Public';
  }
  if (visibility === 'followers') {
    return 'Followers Only';
  }
  return 'Only Me';
}

const styles = StyleSheet.create({
  options: {
    gap: 10,
  },
  option: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: '#D9DCE3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedOption: {
    borderColor: colors.reviewAccent,
    backgroundColor: colors.reviewAccentSoft,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0F1F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIconContainer: {
    backgroundColor: '#F7D9E2',
  },
  textContainer: {
    flex: 1,
    minWidth: 0,
    marginLeft: 11,
    marginRight: 10,
  },
  optionLabel: {
    color: '#24252A',
    fontSize: 15,
    fontWeight: '700',
  },
  selectedOptionLabel: {
    color: colors.reviewAccentText,
  },
  description: {
    color: '#737A86',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  radio: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#B7BBC3',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedRadio: {
    borderColor: colors.reviewAccent,
  },
  radioCenter: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.reviewAccent,
  },
  muted: {
    opacity: 0.55,
  },
});
