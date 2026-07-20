import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { userStore } from '@/store/userStore';
import { authService, profileService } from '@/services';
import { AwsHealthStatus } from '@/components/AwsHealthStatus';

export default function App() {
  const {
    displayName: cachedDisplayName,
    handle: cachedHandle,
    setDisplayName,
    setHandle,
    setProfileImage,
    setUserId,
    userId: cachedUserId,
  } = userStore();
  const [ email, setEmail ] = useState('');
  const [ password, setPassword ] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password ) {
      alert( 'Please fill in all fields' );
      return;
    }
    try {
      const user = await authService.signIn(email.trim(), password);
      const userId = user.id;
      const profile = await profileService.get(userId);
      setUserId( userId );
      if (profile?.handleNormalized) {
        setDisplayName(profile.displayName);
        setHandle(profile.handle);
        setProfileImage(profile.profileImage);
        router.replace( '/home' );
      } else {
        const isResumingSameAccount = cachedUserId === userId;
        setDisplayName(
          profile?.displayName
          ?? (isResumingSameAccount ? cachedDisplayName : '')
        );
        setHandle(isResumingSameAccount ? cachedHandle : '');
        setProfileImage(profile?.profileImage ?? null);
        router.replace('/complete-profile');
      }
    } catch ( error: any ) {
      alert( error.message );
    }
  };

  return (
    <View style={ styles.container }>
      <Text style={ styles.title }>Login</Text>

      <View style={ styles.label }>
        <Text>Email</Text>
      </View>
      <TextInput
        placeholder="Type here"
        value={ email }
        onChangeText={ setEmail }
        style={ styles.input }
        autoCapitalize="none"
        autoCorrect={ false }
        keyboardType="email-address"
        textContentType="emailAddress"
      />

      <View style={ styles.label }>
        <Text>Password</Text>
      </View>
      <TextInput
        placeholder="Type here"
        value={ password }
        onChangeText={ setPassword }
        style={ styles.input }
        secureTextEntry
      />

      <Pressable
        onPress={ handleLogin }
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style = { styles.buttonText }>Login</Text>
      </Pressable>
      <Pressable 
        onPress = {() => router.push('/signup')}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        >
          <Text style = { styles.buttonText }>Go to Signup</Text>
      </Pressable>

      <View style={styles.healthStatus}>
        <AwsHealthStatus />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: {
    padding: 10,
    alignSelf: 'flex-start',
    width: '90%',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    width: '90%',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginVertical: 8,
    borderRadius: 6,
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
  healthStatus: {
    width: '100%',
    marginTop: 24,
  },
});
