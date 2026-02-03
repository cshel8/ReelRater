import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserState = {
    userId: string | null;
    username: string;
    profileImage: string | null;
    setUserId: ( id: string | null ) => void;
    setUsername: ( username: string ) => void;
    setProfileImage: ( uri: string | null ) => void;
};

export const userStore = create <UserState> () (
    persist(
        ( set ) => ({
            userId: null,
            username: '',
            profileImage: null,
            setUserId: (id ) => set({ userId: id }),
            setUsername: ( name ) => set ({ username: name }),
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