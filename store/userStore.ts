import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserState = {
    userId: string | null;
    displayName: string;
    handle: string;
    profileImage: string | null;
    setUserId: ( id: string | null ) => void;
    setDisplayName: ( displayName: string ) => void;
    setHandle: ( handle: string ) => void;
    setProfileImage: ( uri: string | null ) => void;
};

export const userStore = create <UserState> () (
    persist(
        ( set ) => ({
            userId: null,
            displayName: '',
            handle: '',
            profileImage: null,
            setUserId: (id ) => set({ userId: id }),
            setDisplayName: ( displayName ) => set ({ displayName }),
            setHandle: ( handle ) => set ({ handle }),
            setProfileImage: ( uri ) => set ({ profileImage: uri }),
        }),
        {
            name: 'user-storage',
            storage: {
                getItem: async ( name ) => {
                    const value = await AsyncStorage.getItem ( name );
                    return value ? JSON.parse ( value ) : null;
                },
                setItem: async ( name, value ) => {
                    await AsyncStorage.setItem( name, JSON.stringify( value ));
                },
                removeItem: async ( name ) => {
                    await AsyncStorage.removeItem( name );
                },
            },
        }
    )
);
