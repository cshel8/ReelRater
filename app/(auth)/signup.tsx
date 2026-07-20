import { useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AccountPrivacySelector } from '@/components/profile/AccountPrivacySelector';
import { ReviewVisibilitySelector } from '@/components/reviews/ReviewVisibilitySelector';
import { colors } from '@/constants/colors';
import { authService, profileService, settingsService } from '@/services';
import { userStore } from '@/store/userStore';
import type { AccountPrivacy, ReviewVisibility } from '@/types/domain';
import { formatHandle, isValidHandle, normalizeHandle } from '@/utils/handle';

type SignupStep = 1 | 2 | 3 | 4;

export default function Signup() {
  const {
    setDisplayName,
    setHandle,
    setProfileImage,
    setUserId,
  } = userStore();
  const [step, setStep] = useState<SignupStep>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setLocalDisplayName] = useState('');
  const [handle, setLocalHandle] = useState('');
  const [accountPrivacy, setAccountPrivacy] =
    useState<AccountPrivacy>('public');
  const [defaultVisibility, setDefaultVisibility] =
    useState<ReviewVisibility>('private');
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const continueFromAccount = () => {
    if (!email.trim() || !password) {
      Alert.alert('Please enter an email and password');
      return;
    }
    setStep(2);
  };

  const continueFromProfile = () => {
    if (!displayName.trim() || !handle.trim()) {
      Alert.alert('Please enter a display name and handle');
      return;
    }
    if (!isValidHandle(handle)) {
      Alert.alert(
        'Invalid handle',
        'Use 3–20 letters, numbers, or underscores.'
      );
      return;
    }
    setStep(3);
  };

  const finishSignup = async () => {
    if (isFinishing) {
      return;
    }

    const formattedHandle = formatHandle(handle);
    const profileInput = {
      displayName: displayName.trim(),
      handle: formattedHandle,
      handleNormalized: normalizeHandle(formattedHandle),
      accountPrivacy,
    };

    setIsFinishing(true);
    let userId = createdUserId;
    try {
      if (!userId) {
        const user = await authService.signUp(email.trim(), password);
        userId = user.id;
        setCreatedUserId(userId);
        setUserId(userId);
      }

      const profile = await profileService.create(userId, profileInput);
      await settingsService.setDefaultReviewVisibility(
        userId,
        defaultVisibility
      );

      setDisplayName(profile.displayName);
      setHandle(profile.handle);
      setProfileImage(profile.profileImage);
      router.replace('/home');
    } catch (error) {
      Alert.alert(
        userId ? 'Could not finish setup' : 'Could not create account',
        `${
          error instanceof Error ? error.message : 'Unknown signup error'
        }${userId ? ' You can correct anything needed and try Finish again.' : ''}`
      );
    } finally {
      setIsFinishing(false);
    }
  };

  const returnToLogin = async () => {
    if (createdUserId) {
      await authService.signOut().catch(() => undefined);
      setUserId(null);
    }
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
          <Text style={styles.stepLabel}>Step {step} of 4</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${step * 25}%` }]} />
          </View>

          {step === 1 ? (
            <>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>
                Use your email to sign in securely.
              </Text>

              <Text style={styles.label}>Email</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Type here"
                style={styles.input}
                textContentType="emailAddress"
                value={email}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                onChangeText={setPassword}
                placeholder="Type here"
                secureTextEntry
                style={styles.input}
                value={password}
              />

              <Pressable
                accessibilityRole="button"
                onPress={continueFromAccount}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
              </Pressable>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.title}>Choose your profile</Text>
              <Text style={styles.subtitle}>
                Your display name can change later. Your handle identifies your
                account.
              </Text>

              <Text style={styles.label}>Display Name</Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={setLocalDisplayName}
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
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={(value) =>
                    setLocalHandle(value.replace(/^@/, ''))
                  }
                  placeholder="e.g. moviebuff"
                  style={styles.handleInput}
                  value={handle}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={continueFromProfile}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep(1)}
                style={styles.backButton}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={styles.title}>Who can follow you?</Text>
              <Text style={styles.subtitle}>
                Public accounts accept followers immediately. Private accounts
                approve each request.
              </Text>

              <AccountPrivacySelector
                onChange={setAccountPrivacy}
                value={accountPrivacy}
              />

              <Pressable
                accessibilityRole="button"
                onPress={() => setStep(4)}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setStep(2)}
                style={styles.backButton}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <Text style={styles.title}>Who can see your reviews?</Text>
              <Text style={styles.subtitle}>
                Choose the starting audience for future reviews. You can still
                choose a different audience on any individual review.
              </Text>

              <ReviewVisibilitySelector
                disabled={isFinishing}
                onChange={setDefaultVisibility}
                value={defaultVisibility}
              />

              <Text style={styles.settingsNote}>
                You can change this anytime in Profile → Privacy & Visibility.
              </Text>

              <Pressable
                accessibilityRole="button"
                disabled={isFinishing}
                onPress={() => void finishSignup()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || isFinishing) && styles.pressed,
                ]}
              >
                {isFinishing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Finish</Text>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isFinishing}
                onPress={() => setStep(3)}
                style={styles.backButton}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            </>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isFinishing}
            onPress={() => void returnToLogin()}
            style={styles.loginButton}
          >
            <Text style={styles.loginButtonText}>Back to Login</Text>
          </Pressable>
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
  stepLabel: {
    color: '#7B8190',
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ECEDEF',
    marginTop: 8,
    marginBottom: 34,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.reviewAccent,
  },
  title: {
    color: '#17171C',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#737A86',
    fontSize: 15,
    lineHeight: 21,
    marginTop: 9,
    marginBottom: 26,
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
  primaryButton: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: colors.reviewAccent,
    marginTop: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 7,
  },
  backButtonText: {
    color: colors.reviewAccentText,
    fontWeight: '600',
  },
  settingsNote: {
    color: '#737A86',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 15,
    textAlign: 'center',
  },
  loginButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
  },
  loginButtonText: {
    color: '#737A86',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.55,
  },
});
