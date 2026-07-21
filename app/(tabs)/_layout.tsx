import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { colors } from '@/constants/colors';
import { movieCacheMaintenanceService, reviewService } from '@/services';
import { userStore } from '@/store/userStore';

export default function Layout() {
    const userId = userStore((state) => state.userId);

    useEffect(() => {
        if (!userId) {
            return;
        }

        return NetInfo.addEventListener((state) => {
            if (state.isConnected && state.isInternetReachable !== false) {
                void reviewService.syncPending(userId).catch((syncError) => {
                    const message = syncError instanceof Error
                        ? syncError.message
                        : 'Unknown synchronization error';
                    console.log('Review connection sync failed:', message);
                });
                void movieCacheMaintenanceService.run().catch((cacheError) => {
                    const message = cacheError instanceof Error
                        ? cacheError.message
                        : 'Unknown cache maintenance error';
                    console.log('Movie cache maintenance failed:', message);
                });
            }
        });
    }, [userId]);

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: colors.reviewAccent,
                tabBarInactiveTintColor: '#737A86',
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '500',
                },
                tabBarStyle: {
                    paddingTop: 7,
                    paddingBottom: 7,
                    height: 68,
                },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color, focused, size }) => (
                        <Ionicons
                            color={color}
                            name={focused ? 'home' : 'home-outline'}
                            size={size}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="reviews"
                options={{
                    headerShown: false,
                    title: 'Reviews',
                    tabBarIcon: ({ color, focused, size }) => (
                        <Ionicons
                            color={color}
                            name={focused ? 'create' : 'create-outline'}
                            size={size}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="community"
                options={{
                    headerShown: false,
                    title: 'Community',
                    tabBarIcon: ({ color, focused, size }) => (
                        <Ionicons
                            color={color}
                            name={focused ? 'people' : 'people-outline'}
                            size={size}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    headerShown: false,
                    title: 'Profile',
                    tabBarIcon: ({ color, focused, size }) => (
                        <Ionicons
                            color={color}
                            name={focused ? 'person' : 'person-outline'}
                            size={size}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}
