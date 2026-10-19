import { useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { AccountPrivacySelector } from '@/components/profile/AccountPrivacySelector';
import { ReviewVisibilitySelector } from '@/components/reviews/ReviewVisibilitySelector';
import { AccountDeletionAction } from '@/components/account/AccountDeletionAction';
import {
  authService,
  profileService,
  settingsService,
  socialGraphInitializationService,
} from '@/services';
import { userStore } from '@/store/userStore';
import type { AccountPrivacy, ReviewVisibility } from '@/types/domain';
import { formatHandle, isValidHandle, normalizeHandle } from '@/utils/handle';

export default function CompleteProfile() {
  const {
    displayName,
    handle,
    setDisplayName,
    setHandle,
    setProfileImage,
    setUserId,
    userId,
  } = userStore();
  const [saving, setSaving] = useState(false);
  const [accountPrivacy, setAccountPrivacy] =
    useState<AccountPrivacy>('public');
  const [defaultVisibility, setDefaultVisibility] =
    useState<ReviewVisibility>('private');

  const completeProfile = async () => {
    if (!displayName.trim() || !handle.trim()) {
      alert('Please fill in all fields');
      return;
    }
    if (!isValidHandle(handle)) {
      alert('Handle must be 3–20 characters and use only letters, numbers, or underscores.');
      return;
    }
    if (!userId) {
      alert('Please sign in again to finish your profile.');
      router.replace('/login');
      return;
    }

    const formattedHandle = formatHandle(handle);
    setSaving(true);
    try {
      const profile = await profileService.create(userId, {
        displayName: displayName.trim(),
        handle: formattedHandle,
        handleNormalized: normalizeHandle(formattedHandle),
        accountPrivacy,
      });
      await socialGraphInitializationService.initializeCounters(userId);
      await settingsService.initializeForNewUser(
        userId,
        defaultVisibility
      );
      setDisplayName(profile.displayName);
      setHandle(profile.handle);
      setProfileImage(profile.profileImage);
      router.replace('/home');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    try {
      await authService.signOut(userId ?? undefined);
      setUserId(null);
      setDisplayName('');
      setHandle('');
      setProfileImage(null);
      router.replace('/login');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleAccountDeleted = () => {
    setUserId(null);
    setDisplayName('');
    setHandle('');
    setProfileImage(null);
    router.replace('/login');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.message}>
            Your account is secure. Finish your public profile to continue.
          </Text>

          <Text style={styles.label}>Display Name</Text>
          <TextInput
            accessibilityLabel="Display name"
            editable={!saving}
            onChangeText={setDisplayName}
            placeholder="Type here"
            style={styles.input}
            value={displayName}
          />

          <Text style={styles.label}>Handle</Text>
          <View style={styles.handleInputContainer}>
            <Text
              style={[
                styles.handlePrefix,
                !handle.trim() && styles.handlePrefixMuted,
              ]}
            >
              @
            </Text>
            <TextInput
              accessibilityLabel="Handle"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
              onChangeText={(value) => setHandle(value.replace(/^@/, ''))}
              placeholder="e.g. moviebuff"
              style={styles.handleInput}
              value={handle}
            />
          </View>

          <Text style={styles.visibilityTitle}>Account privacy</Text>
          <AccountPrivacySelector
            disabled={saving}
            onChange={setAccountPrivacy}
            value={accountPrivacy}
          />

          <Text style={styles.visibilityTitle}>Default review visibility</Text>
          <ReviewVisibilitySelector
            disabled={saving}
            onChange={setDefaultVisibility}
            value={defaultVisibility}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={completeProfile}
            style={({ pressed }) => [
              styles.button,
              (pressed || saving) && styles.buttonMuted,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            disabled={saving}
            onPress={signOut}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Sign Out</Text>
          </Pressable>

          <AccountDeletionAction onDeleted={handleAccountDeleted} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 54,
    paddingBottom: 34,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  title: {
    color: '#17171C',
    fontSize: 28,
    fontWeight: '700',
  },
  message: {
    color: '#737A86',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 9,
    marginBottom: 12,
  },
  label: {
    color: '#24252A',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D7DAE0',
    borderRadius: 10,
    color: '#1D1D23',
    fontSize: 16,
    paddingHorizontal: 14,
  },
  handleInputContainer: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D7DAE0',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  handlePrefix: {
    color: '#22252B',
    fontSize: 16,
    paddingLeft: 14,
  },
  handlePrefixMuted: {
    color: '#A6ABB4',
  },
  handleInput: {
    flex: 1,
    color: '#1D1D23',
    fontSize: 16,
    paddingHorizontal: 3,
    paddingVertical: 14,
  },
  visibilityTitle: {
    color: '#24252A',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  button: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: colors.reviewAccent,
    marginTop: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonMuted: {
    opacity: 0.55,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: colors.reviewAccentText,
    fontWeight: '600',
  },
});
