import { Tabs } from 'expo-router';

export default function Layout() {
    return (
        <Tabs>
            <Tabs.Screen name = "home" options = {{ title: 'Home' }} />
            <Tabs.Screen name = "reviews" options = {{ title: 'Reviews' }} />
            <Tabs.Screen name = "profile" options = {{ title: 'Profile' }} />
        </Tabs>
    );
}