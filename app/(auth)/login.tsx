import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { userStore } from '@/store/userStore';
import { authService, profileService } from '@/services';
import { AwsHealthStatus } from '@/components/AwsHealthStatus';

export default function App() {
  const { setUsername, setUserId } = userStore();
  const [ localUsername, setLocalUsername ] = useState('');
  const [ password, setPassword ] = useState('');

  const handleLogin = async () => {
    if (!localUsername || !password ) {
      alert( 'Please fill in all fields' );
      return;
    }
    try {
      const user = await authService.signIn(localUsername, password);
      const userId = user.id;
      const profile = await profileService.get(userId);
      if (profile) {
        setUsername(profile.username);
      }
      setUserId( userId );
      router.replace( '/home' );
    } catch ( error: any ) {
      alert( error.message );
    }
  };

  return (
    <View style={ styles.container }>
      <Text style={ styles.title }>Login</Text>

      <View style={ styles.label }>
        <Text>Username</Text>
      </View>
      <TextInput
        placeholder="Type here"
        value={ localUsername }
        onChangeText={ setLocalUsername }
        style={ styles.input }
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
