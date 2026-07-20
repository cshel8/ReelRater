import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { authService, profileService, reviewService } from '@/services';
import { userStore } from '@/store/userStore';

export default function Index() {
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        let active = true;
        let unsubscribe = () => {};

        const startSessionCheck = async () => {
            await userStore.persist.rehydrate();
            if (!active) return;

            unsubscribe = authService.observeAuthState(async (user) => {
                if (!active) return;

                if (!user) {
                    const state = userStore.getState();
                    state.setUserId(null);
                    state.setDisplayName('');
                    state.setHandle('');
                    state.setProfileImage(null);
                    router.replace('/login');
                    return;
                }

                try {
                    const cachedState = userStore.getState();
                    const isResumingSameAccount = cachedState.userId === user.id;
                    const profile = await profileService.get(user.id);
                    if (!active) return;

                    cachedState.setUserId(user.id);
                    void reviewService.syncPending(user.id).catch((syncError) => {
                        const message = syncError instanceof Error
                            ? syncError.message
                            : 'Unknown synchronization error';
                        console.log('Review startup sync failed:', message);
                    });

                    if (profile?.handleNormalized) {
                        cachedState.setDisplayName(profile.displayName);
                        cachedState.setHandle(profile.handle);
                        cachedState.setProfileImage(profile.profileImage);
                        router.replace('/home');
                    } else {
                        cachedState.setDisplayName(
                            profile?.displayName
                            ?? (isResumingSameAccount ? cachedState.displayName : '')
                        );
                        cachedState.setHandle(
                            isResumingSameAccount ? cachedState.handle : ''
                        );
                        cachedState.setProfileImage(profile?.profileImage ?? null);
                        router.replace('/complete-profile');
                    }
                } catch (sessionError: any) {
                    if (active) {
                        setError(sessionError.message);
                    }
                }
            });
        };

        startSessionCheck().catch((sessionError: any) => {
            if (active) {
                setError(sessionError.message);
            }
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, [retryCount]);

    return (
        <View style={styles.container}>
            {error ? (
                <>
                    <Text style={styles.error}>
                        We couldn't restore your session. Check your connection and try again.
                    </Text>
                    <Pressable
                        onPress={() => {
                            setError(null);
                            setRetryCount((count) => count + 1);
                        }}
                        style={({ pressed }) => [
                            styles.button,
                            pressed && styles.buttonPressed,
                        ]}
                    >
                        <Text style={styles.buttonText}>Try Again</Text>
                    </Pressable>
                </>
            ) : (
                <>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.message}>Loading ReelRater...</Text>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#fff',
    },
    message: {
        marginTop: 14,
        color: '#6B7280',
    },
    error: {
        maxWidth: 360,
        marginBottom: 18,
        color: '#B42318',
        textAlign: 'center',
    },
    button: {
        paddingVertical: 11,
        paddingHorizontal: 24,
        borderRadius: 8,
        backgroundColor: '#007AFF',
    },
    buttonPressed: {
        opacity: 0.55,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
    },
});
