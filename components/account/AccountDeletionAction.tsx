import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { accountDeletionService } from '@/services';

type AccountDeletionActionProps = {
  onDeleted: (localCleanupComplete: boolean) => void;
};

/**
 * Shared, password-confirmed exit path for both a completed profile and an
 * authenticated account that has not finished onboarding.
 */
export function AccountDeletionAction({ onDeleted }: AccountDeletionActionProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const closeModal = () => {
    setPassword('');
    setModalVisible(false);
  };

  const deleteAccount = async () => {
    if (!password || deleting) return;

    setDeleting(true);
    try {
      const result = await accountDeletionService.deleteCurrentAccount(password);
      closeModal();
      onDeleted(result.localCleanupComplete);
      if (!result.localCleanupComplete) {
        Alert.alert(
          'Account deleted',
          'Your account was deleted, but some data could not be removed from this device.'
        );
      }
    } catch (error) {
      Alert.alert(
        'Could not delete account',
        error instanceof Error ? error.message : 'Unknown deletion error'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={deleting}
        onPress={() =>
          Alert.alert(
            'Delete your account?',
            'This permanently deletes your profile, reviews, settings, follower relationships, profile image, and sign-in account. This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Continue',
                style: 'destructive',
                onPress: () => setModalVisible(true),
              },
            ]
          )
        }
        style={({ pressed }) => [
          styles.deleteAccountButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) closeModal();
        }}
        transparent
        visible={modalVisible}
      >
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Confirm account deletion</Text>
            <Text style={styles.message}>
              Enter your current password to confirm. All account data will be permanently deleted.
            </Text>
            <TextInput
              accessibilityLabel="Current password"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!deleting}
              onChangeText={setPassword}
              placeholder="Current password"
              secureTextEntry
              style={styles.passwordInput}
              textContentType="password"
              value={password}
            />
            <View style={styles.actions}>
              <Pressable
                disabled={deleting}
                onPress={closeModal}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!password || deleting}
                onPress={() => void deleteAccount()}
                style={({ pressed }) => [
                  styles.confirmButton,
                  (!password || deleting || pressed) && styles.buttonPressed,
                ]}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmText}>Delete Permanently</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  deleteAccountButton: {
    minHeight: 42,
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountButtonText: {
    color: '#991B1B',
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.55,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 24, 0.45)',
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    padding: 22,
  },
  title: {
    color: '#17171C',
    fontSize: 20,
    fontWeight: '700',
  },
  message: {
    color: '#626975',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 9,
  },
  passwordInput: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#D7DAE0',
    borderRadius: 9,
    color: '#1D1D23',
    fontSize: 16,
    marginTop: 18,
    paddingHorizontal: 13,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#4F5662',
    fontWeight: '600',
  },
  confirmButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#B91C1C',
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
