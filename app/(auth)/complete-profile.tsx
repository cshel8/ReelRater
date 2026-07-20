import { useState } from 'react';
import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AccountPrivacySelector } from '@/components/profile/AccountPrivacySelector';
import { ReviewVisibilitySelector } from '@/components/reviews/ReviewVisibilitySelector';
import { authService, profileService, settingsService } from '@/services';
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
      await settingsService.setDefaultReviewVisibility(
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
      await authService.signOut();
      setUserId(null);
      setDisplayName('');
      setHandle('');
      setProfileImage(null);
      router.replace('/login');
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Complete Your Profile</Text>
      <Text style={styles.message}>
        Your account is secure. Finish your public profile to continue.
      </Text>

      <View style={styles.label}>
        <Text>Display Name</Text>
      </View>
      <TextInput
        placeholder="Type here"
        value={displayName}
        onChangeText={setDisplayName}
        style={styles.input}
      />

      <View style={styles.label}>
        <Text>Handle</Text>
      </View>
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
          placeholder="e.g. moviebuff"
          value={handle}
          onChangeText={(value) => setHandle(value.replace(/^@/, ''))}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.handleInput}
        />
      </View>

      <Text style={styles.visibilityTitle}>Account privacy</Text>
      <View style={styles.visibilityOptions}>
        <AccountPrivacySelector
          disabled={saving}
          onChange={setAccountPrivacy}
          value={accountPrivacy}
        />
      </View>

      <Text style={styles.visibilityTitle}>Default review visibility</Text>
      <View style={styles.visibilityOptions}>
        <ReviewVisibilitySelector
          disabled={saving}
          onChange={setDefaultVisibility}
          value={defaultVisibility}
        />
      </View>

      <Pressable
        disabled={saving}
        onPress={completeProfile}
        style={({ pressed }) => [
          styles.button,
          (pressed || saving) && styles.buttonMuted,
        ]}
      >
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Continue'}
        </Text>
      </Pressable>

      <Pressable disabled={saving} onPress={signOut} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Sign Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 10,
  },
  message: {
    width: '90%',
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  label: {
    padding: 10,
    alignSelf: 'flex-start',
    width: '90%',
  },
  input: {
    width: '90%',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginVertical: 8,
    borderRadius: 6,
  },
  handleInputContainer: {
    width: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    marginVertical: 8,
    borderRadius: 6,
  },
  handlePrefix: {
    paddingLeft: 10,
    fontSize: 16,
    color: '#222',
  },
  handlePrefixMuted: {
    color: '#aaa',
  },
  handleInput: {
    flex: 1,
    padding: 10,
    paddingLeft: 2,
  },
  button: {
    marginTop: 16,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
  },
  visibilityTitle: {
    width: '90%',
    color: '#24252A',
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
  },
  visibilityOptions: {
    width: '90%',
  },
  buttonMuted: {
    opacity: 0.55,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 18,
    padding: 10,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
