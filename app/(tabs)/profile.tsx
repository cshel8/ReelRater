import { View, Text, StyleSheet, Image, Pressable, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { userStore } from '@/store/userStore';
import * as ImagePicker from 'expo-image-picker';
import { db, storage } from '@/config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function Profile() {
    const { profileImage, setProfileImage, userId, username, setUsername } = userStore();
    const [ loading, setLoading ] = useState( false );

    useEffect(() => {
        if ( !userId ) return;

        const fetchUserData = async () => {
            try {
                const userDoc = await getDoc( doc( db, 'users', userId ));
                if ( userDoc.exists() ) {
                    const data = userDoc.data();
                    if ( data.username ) setUsername( data.username );
                    if ( data.profileImage ) setProfileImage( data.profileImage );
                }
            } catch ( error: any ) {
                console.log( 'Error fetching user data:', error.message );
            }
        };

        fetchUserData();
    }, [userId]);

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

                const response = await fetch( localUri );
                const blob = await response.blob();
                const storageRef = ref( storage, `users/${userId}/profileImage.jpg` );
                await uploadBytes( storageRef, blob );

                const downloadURL = await getDownloadURL( storageRef );
                await updateDoc(doc( db, 'users', userId), { profileImage: downloadURL });
                setProfileImage( downloadURL ); 
            } catch ( error: any ) {
                alert( 'Error uploading image: ' + error.message );
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Profile</Text>

            {loading ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginBottom: 16 }} />
            ) : profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.avatar} />
            ) : (
                <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>?</Text>
                </View>
            )}

            <Pressable
                onPress={pickImage}
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            >
                <Text style={styles.buttonText}>Change Image</Text>
            </Pressable>

            <Text style={styles.label}>Username:</Text>
            <Text style={styles.subtitle}>{username || 'Placeholder'}</Text>

            <Text style={styles.label}>Password:</Text>
            <Text style={styles.subtitle}>*********</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginBottom: 16,
    },
    avatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#ccc',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    avatarText: {
        fontSize: 36,
        fontWeight: '600',
        color: '#555',
    },
    button: {
        marginTop: 16,
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 8,
    },
    buttonPressed: {
        backgroundColor: '#ddd',
    },
    buttonText: {
        color: 'white',
        fontWeight: '600',
    },
});