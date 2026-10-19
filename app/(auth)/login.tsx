import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { colors } from '@/constants/colors';
import { userStore } from '@/store/userStore';
import { authService, profileService } from '@/services';

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

/** Friendly wording for sign-in failures without internal error strings. */
const friendlyLoginMessage = (error: unknown) => {
  const code =
    typeof (error as { code?: unknown })?.code === 'string'
      ? ((error as { code: string }).code)
      : '';
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email'
  ) {
    return 'Incorrect email or password. Check your entries and try again.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Wait a moment and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return "Couldn't reach ReelRater. Check your connection and try again.";
  }
  return "Something went wrong signing you in. Try again.";
};

export default function Login() {
  const {
    displayName: cachedDisplayName,
    handle: cachedHandle,
    setDisplayName,
    setHandle,
    setProfileImage,
    setUserId,
    userId: cachedUserId,
  } = userStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert(
        'Missing information',
        'Enter your email and password to log in.'
      );
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await authService.signIn(trimmedEmail, password);
      const userId = user.id;
      const profile = await profileService.get(userId);
      setUserId(userId);
      if (profile?.handleNormalized) {
        setDisplayName(profile.displayName);
        setHandle(profile.handle);
        setProfileImage(profile.profileImage);
        router.replace('/home');
      } else {
        const isResumingSameAccount = cachedUserId === userId;
        setDisplayName(
          profile?.displayName
          ?? (isResumingSameAccount ? cachedDisplayName : '')
        );
        setHandle(isResumingSameAccount ? cachedHandle : '');
        setProfileImage(profile?.profileImage ?? null);
        router.replace('/complete-profile');
      }
    } catch (error) {
      Alert.alert('Login failed', friendlyLoginMessage(error));
    } finally {
      setIsSubmitting(false);
    }
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
          <Text style={styles.brand}>
            Reel
            <Text style={styles.brandAccent}>Rater</Text>
          </Text>
          <Text style={styles.title}>Login</Text>
          <Text style={styles.subtitle}>
            Welcome back. Sign in to continue.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@example.com"
            style={styles.input}
            textContentType="emailAddress"
            value={email}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordInputContainer}>
            <TextInput
              accessibilityLabel="Password"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry={!showPassword}
              style={styles.passwordInput}
              textContentType="none"
              value={password}
            />
            <Pressable
              accessibilityLabel={
                showPassword ? 'Hide password' : 'Show password'
              }
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setShowPassword((visible) => !visible)}
              style={styles.passwordToggle}
            >
              <Ionicons
                color="#737A86"
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
              />
            </Pressable>
          </View>

          <Pressable
            accessibilityLabel="Log in"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => void handleLogin()}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isSubmitting) && styles.pressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Login</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => router.push('/signup')}
            style={styles.signupLink}
          >
            <Text style={styles.signupLinkText}>Create an account</Text>
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
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 34,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  brand: {
    color: '#17171C',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 26,
    textAlign: 'center',
  },
  brandAccent: {
    color: colors.reviewAccent,
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
  passwordInputContainer: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D7DAE0',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    color: '#1D1D23',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  passwordToggle: {
    paddingHorizontal: 12,
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
  signupLink: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
  },
  signupLinkText: {
    color: colors.reviewAccentText,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.55,
  },
});
