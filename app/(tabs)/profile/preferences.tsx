import { useEffect, useRef, useState } from 'react';
import { useNavigation } from 'expo-router';
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
import { colors } from '@/constants/colors';
import {
  communityPreferenceRepository,
  settingsService,
} from '@/services';
import {
  publishCommunityPreferenceUpdate,
} from '@/services/community/communitySessionState';
import { userStore } from '@/store/userStore';
import type {
  CommunityDefaultSort,
  CommunityMediaFilter,
} from '@/types/domain';

const MEDIA_OPTIONS: { label: string; value: CommunityMediaFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Movies', value: 'movie' },
  { label: 'TV Shows', value: 'tv' },
];

const SORT_OPTIONS: { label: string; value: CommunityDefaultSort }[] = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' },
  { label: 'Highest rated', value: 'highestRated' },
  { label: 'Lowest rated', value: 'lowestRated' },
];

const isValidMediaFilter = (value: unknown): value is CommunityMediaFilter =>
  MEDIA_OPTIONS.some((option) => option.value === value);

const isValidDefaultSort = (value: unknown): value is CommunityDefaultSort =>
  SORT_OPTIONS.some((option) => option.value === value);

const toActiveSort = (value: CommunityDefaultSort) =>
  value === 'highestRated'
    ? 'highest'
    : value === 'lowestRated'
      ? 'lowest'
      : value;

export default function PreferencesScreen() {
  const navigation = useNavigation();
  const userId = userStore((state) => state.userId);
  const [mediaFilter, setMediaFilter] = useState<CommunityMediaFilter>('all');
  const [savedMediaFilter, setSavedMediaFilter] =
    useState<CommunityMediaFilter>('all');
  const [sort, setSort] = useState<CommunityDefaultSort>('newest');
  const [savedSort, setSavedSort] = useState<CommunityDefaultSort>('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingNavigationAction, setPendingNavigationAction] =
    useState<NavigationAction | null>(null);
  const successMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const hasUnsavedChanges =
    !isLoading && (mediaFilter !== savedMediaFilter || sort !== savedSort);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    let active = true;
    void settingsService
      .get(userId)
      .then((settings) => {
        if (!active) {
          return;
        }
        const savedMedia = settings?.defaultMediaFilter ?? 'all';
        const savedCommunitySort = settings?.defaultSort ?? 'newest';
        setMediaFilter(savedMedia);
        setSavedMediaFilter(savedMedia);
        setSort(savedCommunitySort);
        setSavedSort(savedCommunitySort);
      })
      .catch((error) => {
        if (active) {
          Alert.alert(
            'Unable to load preferences',
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

  useEffect(
    () => () => {
      if (successMessageTimerRef.current) {
        clearTimeout(successMessageTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (hasUnsavedChanges || !pendingNavigationAction) {
      return;
    }
    navigation.dispatch(pendingNavigationAction);
    setPendingNavigationAction(null);
  }, [hasUnsavedChanges, navigation, pendingNavigationAction]);

  const save = async (onSaved?: () => void) => {
    if (!userId || isSaving) {
      return;
    }
    if (!isValidMediaFilter(mediaFilter) || !isValidDefaultSort(sort)) {
      Alert.alert('Unable to save preferences', 'Choose a valid view and sort order.');
      return;
    }
    setIsSaving(true);
    try {
      await settingsService.setCommunityDefaults(userId, {
        defaultMediaFilter: mediaFilter,
        defaultSort: sort,
      });
      const activePreferences = {
        mediaFilter,
        sort: toActiveSort(sort),
      } as const;
      await communityPreferenceRepository.setForUser(userId, activePreferences);
      publishCommunityPreferenceUpdate(userId, activePreferences);
      setSavedMediaFilter(mediaFilter);
      setSavedSort(sort);
      if (onSaved) {
        onSaved();
      } else {
        setSuccessMessage('Preferences saved');
        if (successMessageTimerRef.current) {
          clearTimeout(successMessageTimerRef.current);
        }
        successMessageTimerRef.current = setTimeout(() => {
          setSuccessMessage(null);
          successMessageTimerRef.current = null;
        }, 2500);
      }
    } catch (error) {
      Alert.alert(
        'Unable to save preferences',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  usePreventRemove(hasUnsavedChanges, ({ data }) => {
    Alert.alert(
      'Save changes?',
      "Your changes haven't been saved. Would you like to save them before leaving?",
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard Changes',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
        {
          text: 'Save Changes',
          onPress: () => void save(() => setPendingNavigationAction(data.action)),
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
      <Text style={styles.title}>Community defaults</Text>
      <Text style={styles.description}>
        Choose the default view used on new devices or when no recent
        Community selection is saved.
      </Text>
      <Text style={styles.supportingText}>
        Your recent filter and sort choices are remembered separately on each
        device.
      </Text>

      <Text style={styles.optionLabel}>Show</Text>
      <View style={styles.optionRow}>
        {MEDIA_OPTIONS.map((option) => {
          const selected = option.value === mediaFilter;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaving, selected }}
              disabled={isSaving}
              key={option.value}
              onPress={() => setMediaFilter(option.value)}
              style={[
                styles.option,
                selected && styles.optionSelected,
                isSaving && styles.muted,
              ]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.optionLabel}>Sort by</Text>
      <View style={styles.optionRow}>
        {SORT_OPTIONS.map((option) => {
          const selected = option.value === sort;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaving, selected }}
              disabled={isSaving}
              key={option.value}
              onPress={() => setSort(option.value)}
              style={[
                styles.option,
                selected && styles.optionSelected,
                isSaving && styles.muted,
              ]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isSaving || !hasUnsavedChanges}
        onPress={() => void save()}
        style={({ pressed }) => [
          styles.saveButton,
          (pressed || isSaving || !hasUnsavedChanges) && styles.muted,
        ]}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save Preferences</Text>
        )}
      </Pressable>
      {successMessage ? (
        <Text accessibilityLiveRegion="polite" style={styles.successMessage}>
          {successMessage}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: { color: '#17171C', fontSize: 22, fontWeight: '700' },
  description: {
    color: '#737A86', fontSize: 14, lineHeight: 20, marginTop: 8,
  },
  supportingText: {
    color: '#9095A0', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 24,
  },
  optionLabel: { color: '#4F535C', fontSize: 14, fontWeight: '700', marginBottom: 9 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  option: {
    borderWidth: 1, borderColor: '#D8DAE0', borderRadius: 9, minHeight: 40,
    paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center',
  },
  optionSelected: { backgroundColor: colors.reviewAccentSoft, borderColor: colors.reviewAccent },
  optionText: { color: '#555B66', fontSize: 13, fontWeight: '600' },
  optionTextSelected: { color: colors.reviewAccentText },
  saveButton: {
    minHeight: 50, borderRadius: 10, backgroundColor: colors.reviewAccent,
    marginTop: 20, alignItems: 'center', justifyContent: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  successMessage: {
    color: '#3C8058',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  muted: { opacity: 0.5 },
});
