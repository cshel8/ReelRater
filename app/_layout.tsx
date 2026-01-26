import { Stack, Tabs } from 'expo-router';

export default function Layout() {
    return (
        <Tabs>
            <Tabs.Screen name = "index" options = {{title: 'Home'}} />
            <Tabs.Screen name = "login" options = {{title: 'Login'}} />
            <Tabs.Screen name = "signup" options = {{title: 'Signup'}} />
            <Tabs.Screen name = "reviews" options = {{title: 'Reviews'}} />
            <Tabs.Screen name = "profile" options = {{title: 'Profile'}} />
        </Tabs>
    );
}