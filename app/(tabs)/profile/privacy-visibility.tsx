import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import {
  usePreventRemove,
  type NavigationAction,
} from 'expo-router/react-navigation';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AccountPrivacySelector } from '@/components/profile/AccountPrivacySelector';
import { ReviewVisibilitySelector } from '@/components/reviews/ReviewVisibilitySelector';
import { colors } from '@/constants/colors';
import { followService, settingsService } from '@/services';
import { userStore } from '@/store/userStore';
import type { AccountPrivacy, ReviewVisibility } from '@/types/domain';

export default function PrivacyVisibilityScreen() {
  const navigation = useNavigation();
  const userId = userStore((state) => state.userId);
  const [accountPrivacy, setAccountPrivacy] =
    useState<AccountPrivacy>('public');
  const [savedAccountPrivacy, setSavedAccountPrivacy] =
    useState<AccountPrivacy>('public');
  const [visibility, setVisibility] =
    useState<ReviewVisibility>('private');
  const [savedVisibility, setSavedVisibility] =
    useState<ReviewVisibility>('private');
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingNavigationAction, setPendingNavigationAction] =
    useState<NavigationAction | null>(null);

  const hasUnsavedChanges =
    !isLoading &&
    (visibility !== savedVisibility ||
      accountPrivacy !== savedAccountPrivacy);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let active = true;
    settingsService
      .get(userId)
      .then((settings) => {
        if (!active) {
          return;
        }
        const current = settings?.defaultReviewVisibility ?? 'private';
        const currentAccountPrivacy = settings?.accountPrivacy ?? 'public';
        setAccountPrivacy(currentAccountPrivacy);
        setSavedAccountPrivacy(currentAccountPrivacy);
        setVisibility(current);
        setSavedVisibility(current);
      })
      .catch((error) => {
        if (active) {
          Alert.alert(
            'Unable to load settings',
            error instanceof Error ? error.message : 'Please try again.'
          );
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        setPendingRequestCount(0);
        return;
      }

      let active = true;
      followService
        .listPendingRequests(userId)
        .then((requests) => {
          if (active) {
            setPendingRequestCount(requests.length);
          }
        })
        .catch((error) => {
          console.log(
            'Unable to load pending request count:',
            error instanceof Error ? error.message : error
          );
        });

      return () => {
        active = false;
      };
    }, [userId])
  );

  useEffect(() => {
    if (hasUnsavedChanges || !pendingNavigationAction) {
      return;
    }

    navigation.dispatch(pendingNavigationAction);
    setPendingNavigationAction(null);
  }, [hasUnsavedChanges, navigation, pendingNavigationAction]);

  const persistPreferences = async (onSaved?: () => void) => {
    if (!userId || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await settingsService.setPrivacyPreferences(userId, {
        accountPrivacy,
        defaultReviewVisibility: visibility,
      });
      setSavedAccountPrivacy(accountPrivacy);
      setSavedVisibility(visibility);
      if (onSaved) {
        onSaved();
      } else {
        Alert.alert('Privacy settings updated');
      }
    } catch (error) {
      Alert.alert(
        'Unable to save settings',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const save = (onSaved?: () => void) => {
    const isBecomingPublic =
      savedAccountPrivacy === 'private' && accountPrivacy === 'public';

    if (isBecomingPublic && pendingRequestCount > 0) {
      const requestLabel =
        pendingRequestCount === 1
          ? '1 pending follower request'
          : `${pendingRequestCount} pending follower requests`;

      Alert.alert(
        'Make account public?',
        `Anyone will be able to follow you immediately after this change. Your ${requestLabel} will remain pending.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Review Requests',
            onPress: () => router.push('/profile/follow-requests'),
          },
          {
            text: 'Make Public',
            onPress: () => void persistPreferences(onSaved),
          },
        ]
      );
      return;
    }

    void persistPreferences(onSaved);
  };

  usePreventRemove(hasUnsavedChanges, ({ data }) => {
    Alert.alert(
      'Save changes?',
      "Your changes haven't been saved. Would you like to save them before leaving?",
      [
        {
          text: 'Keep Editing',
          style: 'cancel',
        },
        {
          text: 'Discard Changes',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
        {
          text: 'Save Changes',
          onPress: () =>
            save(() => setPendingNavigationAction(data.action)),
        },
      ]
    );
  });

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.reviewAccent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Account privacy</Text>
      <Text style={styles.description}>
        Private accounts approve new follower requests. Existing followers
        remain approved if you change this setting.
      </Text>

      <AccountPrivacySelector
        disabled={isSaving}
        onChange={setAccountPrivacy}
        value={accountPrivacy}
      />

      <View style={styles.sectionDivider} />

      <Text style={styles.title}>Default review visibility</Text>
      <Text style={styles.description}>
        New reviews begin with this audience selected. You can choose a
        different audience while writing or editing any individual review.
      </Text>

      <ReviewVisibilitySelector
        disabled={isSaving}
        onChange={setVisibility}
        value={visibility}
      />

      <Pressable
        accessibilityRole="button"
        disabled={
          isSaving ||
          (visibility === savedVisibility &&
            accountPrivacy === savedAccountPrivacy)
        }
        onPress={() => save()}
        style={({ pressed }) => [
          styles.saveButton,
          (pressed ||
            isSaving ||
            (visibility === savedVisibility &&
              accountPrivacy === savedAccountPrivacy)) &&
            styles.muted,
        ]}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save Settings</Text>
        )}
      </Pressable>

      <View style={styles.note}>
        <Text style={styles.noteText}>
          Changing the default affects future reviews only. It does not change
          reviews you have already posted.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    color: '#17171C',
    fontSize: 22,
    fontWeight: '700',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#ECEDEF',
    marginVertical: 28,
  },
  description: {
    color: '#737A86',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 22,
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: colors.reviewAccent,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  note: {
    borderRadius: 10,
    backgroundColor: '#F4F5F7',
    marginTop: 18,
    padding: 13,
  },
  noteText: {
    color: '#686E79',
    fontSize: 13,
    lineHeight: 19,
  },
  muted: {
    opacity: 0.5,
  },
});
