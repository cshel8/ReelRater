import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { userStore } from '@/store/userStore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';

export default function App() {
  const { username, setUsername, setUserId } = userStore();
  const [password, setPassword] = useState('');

  const handleSignup = async () => {
    if (!username || !password ) {
      alert( 'Please fill in all fields' );
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword (
        auth,
        `${username}@example.com`,
        password
      );
      const userId = cred.user.uid;
      await setDoc( doc( db, 'users', userId ), {
        username,
        profileImage: null,
        createdAt: serverTimestamp(),
      });
      setUserId( userId );
      router.replace( '/home' );
    } catch ( error: any ) {
      alert( error.message );
    }
  };

  return (
    <View style={ styles.container }>
      <Text style={ styles.title }>Signup</Text>

      <View style={ styles.label }>
        <Text>Username</Text>
      </View>
      <TextInput
        placeholder="Type here"
        value={ username }
        onChangeText={ setUsername }
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
        onPress={ handleSignup }
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={ styles.buttonText }>Signup</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
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
});