import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import type { AccountPrivacy } from '@/types/domain';

const OPTIONS: {
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: AccountPrivacy;
}[] = [
  {
    value: 'public',
    label: 'Public Account',
    icon: 'earth-outline',
    description: 'Anyone can follow you immediately.',
  },
  {
    value: 'private',
    label: 'Private Account',
    icon: 'lock-closed-outline',
    description: 'You approve each new follower request.',
  },
];

export function AccountPrivacySelector({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (privacy: AccountPrivacy) => void;
  value: AccountPrivacy;
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
            <Ionicons
              color={selected ? colors.reviewAccentText : '#737A86'}
              name={option.icon}
              size={23}
            />
            <View style={styles.text}>
              <Text
                style={[
                  styles.label,
                  selected && styles.selectedLabel,
                ]}
              >
                {option.label}
              </Text>
              <Text style={styles.description}>{option.description}</Text>
            </View>
            <Ionicons
              color={selected ? colors.reviewAccent : '#B7BBC3'}
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={22}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: 10,
  },
  option: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: '#D9DCE3',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedOption: {
    borderColor: colors.reviewAccent,
    backgroundColor: colors.reviewAccentSoft,
  },
  text: {
    flex: 1,
  },
  label: {
    color: '#24252A',
    fontSize: 15,
    fontWeight: '700',
  },
  selectedLabel: {
    color: colors.reviewAccentText,
  },
  description: {
    color: '#737A86',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  muted: {
    opacity: 0.55,
  },
});
