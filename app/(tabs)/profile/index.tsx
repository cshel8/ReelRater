import {
    View,
    Text,
    StyleSheet,
    Image,
    Pressable,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { colors } from '@/constants/colors';
import { userStore } from '@/store/userStore';
import * as ImagePicker from 'expo-image-picker';
import { authService, followService, profileService } from '@/services';

export default function Profile() {
    const {
        displayName,
        handle,
        profileImage,
        setDisplayName,
        setHandle,
        setProfileImage,
        setUserId,
        userId,
    } = userStore();
    const [ loading, setLoading ] = useState( false );
    const [ signingOut, setSigningOut ] = useState( false );
    const [ followerCount, setFollowerCount ] = useState( 0 );
    const [ followingCount, setFollowingCount ] = useState( 0 );
    const [ requestCount, setRequestCount ] = useState( 0 );

    useFocusEffect(useCallback(() => {
        if ( !userId ) return;
        let active = true;

        const fetchUserData = async () => {
            try {
                const [profile, followers, following, requests] = await Promise.all([
                    profileService.get(userId),
                    followService.listFollowers(userId),
                    followService.listFollowing(userId),
                    followService.listPendingRequests(userId),
                ]);
                if ( active && profile ) {
                    if ( profile.displayName ) setDisplayName( profile.displayName );
                    if ( profile.handle ) setHandle( profile.handle );
                    setProfileImage( profile.profileImage );
                }
                if ( active ) {
                    setFollowerCount(followers.length);
                    setFollowingCount(following.length);
                    setRequestCount(requests.length);
                }
            } catch ( error: any ) {
                console.log( 'Error fetching user data:', error.message );
            }
        };

        fetchUserData();
        return () => {
            active = false;
        };
    }, [setDisplayName, setHandle, setProfileImage, userId]));

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: [ 'images' ],
            allowsEditing: true,
            aspect: [ 1, 1 ],
            quality: 1,
        });

        if ( !result.canceled && result.assets.length > 0 && userId ) {
            setLoading( true );
            try {
                const localUri = result.assets[0].uri;
                setProfileImage( localUri ); 

                const downloadURL = await profileService.uploadImage(userId, localUri);
                setProfileImage( downloadURL ); 
            } catch ( error: any ) {
                alert( 'Error uploading image: ' + error.message );
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSignOut = async () => {
        setSigningOut(true);
        try {
            await authService.signOut();
            setUserId(null);
            setDisplayName('');
            setHandle('');
            setProfileImage(null);
            router.replace('/login');
        } catch (error: any) {
            alert('Error signing out: ' + error.message);
        } finally {
            setSigningOut(false);
        }
    };

    return (
        <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
        >
            <Text style={styles.title}>Profile</Text>

            <View style={styles.profileCard}>
                {loading ? (
                    <View style={styles.avatarPlaceholder}>
                        <ActivityIndicator size="large" color="#007AFF" />
                    </View>
                ) : profileImage ? (
                    <Image source={{ uri: profileImage }} style={ styles.avatar } />
                ) : (
                    <View style={ styles.avatarPlaceholder }>
                        <Text style={ styles.avatarText }>
                            {displayName.trim().charAt(0).toUpperCase() || '?'}
                        </Text>
                    </View>
                )}

                <Text style={ styles.displayName }>
                    {displayName || 'Your display name'}
                </Text>
                {handle ? (
                    <Text style={ styles.handle }>@{handle}</Text>
                ) : null}

                <View style={styles.connectionCounts}>
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push('/profile/followers')}
                        style={({ pressed }) => [
                            styles.connectionCount,
                            pressed && styles.buttonPressed,
                        ]}
                    >
                        <Text style={styles.connectionNumber}>{followerCount}</Text>
                        <Text style={styles.connectionLabel}>Followers</Text>
                    </Pressable>
                    <View style={styles.connectionDivider} />
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push('/profile/following')}
                        style={({ pressed }) => [
                            styles.connectionCount,
                            pressed && styles.buttonPressed,
                        ]}
                    >
                        <Text style={styles.connectionNumber}>{followingCount}</Text>
                        <Text style={styles.connectionLabel}>Following</Text>
                    </Pressable>
                </View>

                <Pressable
                    onPress={pickImage}
                    style={({ pressed }) => [
                        styles.imageButton,
                        pressed && styles.buttonPressed,
                    ]}
                >
                    <Text style={ styles.imageButtonText }>Change Profile Image</Text>
                </Pressable>
            </View>

            <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/profile/find-people')}
                style={({ pressed }) => [
                    styles.findPeopleButton,
                    pressed && styles.buttonPressed,
                ]}
            >
                <Ionicons
                    color={colors.reviewAccentText}
                    name="search-outline"
                    size={20}
                />
                <Text style={styles.findPeopleButtonText}>Find People</Text>
            </Pressable>

            <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/profile/follow-requests')}
                style={({ pressed }) => [
                    styles.requestButton,
                    pressed && styles.buttonPressed,
                ]}
            >
                <Ionicons
                    color={colors.reviewAccentText}
                    name="person-add-outline"
                    size={20}
                />
                <Text style={styles.requestButtonText}>Follow Requests</Text>
                {requestCount > 0 ? (
                    <View style={styles.requestCount}>
                        <Text style={styles.requestCountText}>{requestCount}</Text>
                    </View>
                ) : null}
                <Ionicons color="#858B96" name="chevron-forward" size={19} />
            </Pressable>

            <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/profile/privacy-visibility')}
                style={({ pressed }) => [
                    styles.settingsButton,
                    pressed && styles.buttonPressed,
                ]}
            >
                <Ionicons
                    color="#4F5662"
                    name="shield-checkmark-outline"
                    size={20}
                />
                <Text style={styles.settingsButtonText}>
                    Privacy & Visibility
                </Text>
                <Ionicons
                    color="#858B96"
                    name="chevron-forward"
                    size={19}
                />
            </Pressable>

            <Pressable
                disabled={signingOut}
                onPress={handleSignOut}
                style={({ pressed }) => [
                    styles.signOutButton,
                    (pressed || signingOut) && styles.buttonPressed,
                ]}
            >
                <Text style={styles.signOutButtonText}>
                    {signingOut ? 'Signing Out...' : 'Sign Out'}
                </Text>
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 48,
        paddingBottom: 36,
    },
    title: {
        alignSelf: 'flex-start',
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 24,
    },
    profileCard: {
        width: '100%',
        maxWidth: 420,
        alignItems: 'center',
        paddingVertical: 28,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 14,
        backgroundColor: '#FAFAFA',
    },
    displayName: {
        marginTop: 16,
        fontSize: 22,
        fontWeight: '600',
        color: '#1F2937',
    },
    handle: {
        marginTop: 4,
        fontSize: 15,
        color: '#6B7280',
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
    },
    avatarPlaceholder: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 38,
        fontWeight: '600',
        color: '#6B7280',
    },
    imageButton: {
        marginTop: 18,
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: '#007AFF',
        borderRadius: 8,
    },
    buttonPressed: {
        opacity: 0.55,
    },
    imageButtonText: {
        color: '#007AFF',
        fontWeight: '600',
    },
    signOutButton: {
        width: '100%',
        maxWidth: 420,
        marginTop: 20,
        paddingVertical: 13,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#DC2626',
        borderRadius: 8,
    },
    signOutButtonText: {
        color: '#DC2626',
        fontWeight: '600',
    },
    findPeopleButton: {
        width: '100%',
        maxWidth: 420,
        minHeight: 50,
        marginTop: 20,
        borderRadius: 9,
        backgroundColor: colors.reviewAccentSoft,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    findPeopleButtonText: {
        color: colors.reviewAccentText,
        fontWeight: '700',
    },
    settingsButton: {
        width: '100%',
        maxWidth: 420,
        minHeight: 50,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#E1E3E7',
        borderRadius: 9,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
    },
    requestButton: {
        width: '100%',
        maxWidth: 420,
        minHeight: 50,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#F0CFD8',
        borderRadius: 9,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
    },
    requestButtonText: {
        color: colors.reviewAccentText,
        flex: 1,
        fontWeight: '600',
    },
    requestCount: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.reviewAccent,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    requestCountText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    settingsButtonText: {
        color: '#363A42',
        flex: 1,
        fontWeight: '600',
    },
    connectionCounts: {
        marginTop: 20,
        flexDirection: 'row',
        alignItems: 'center',
    },
    connectionCount: {
        minWidth: 100,
        alignItems: 'center',
        paddingVertical: 5,
    },
    connectionNumber: {
        color: '#1F2937',
        fontSize: 18,
        fontWeight: '700',
    },
    connectionLabel: {
        color: '#6B7280',
        fontSize: 13,
        marginTop: 2,
    },
    connectionDivider: {
        width: 1,
        height: 34,
        backgroundColor: '#D9DCE3',
    },
});
