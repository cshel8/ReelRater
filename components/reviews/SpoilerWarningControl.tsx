import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';

export function SpoilerWarningControl({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel="Contains spoilers"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.control,
        value && styles.controlSelected,
        pressed && !disabled && styles.controlPressed,
        disabled && styles.controlDisabled,
      ]}
    >
      <View style={[styles.checkbox, value && styles.checkboxSelected]}>
        {value ? (
          <Ionicons color="#FFFFFF" name="checkmark" size={16} />
        ) : null}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Contains spoilers</Text>
        <Text style={styles.description}>
          Hide your review text until someone chooses to reveal it.
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    alignItems: 'flex-start',
    borderColor: '#D9DDE5',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  controlSelected: {
    backgroundColor: '#FFF2F5',
    borderColor: colors.reviewAccent,
  },
  controlPressed: {
    opacity: 0.72,
  },
  controlDisabled: {
    opacity: 0.5,
  },
  checkbox: {
    alignItems: 'center',
    borderColor: '#9DA3AE',
    borderRadius: 5,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    marginTop: 1,
    width: 22,
  },
  checkboxSelected: {
    backgroundColor: colors.reviewAccent,
    borderColor: colors.reviewAccent,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: '#25272D',
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    color: '#727887',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
});
