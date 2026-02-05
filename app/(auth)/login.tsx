import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { userStore } from '@/store/userStore';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

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
      const cred = await signInWithEmailAndPassword( 
        auth, 
        `${localUsername}@example.com`, 
        password
      );
      const userId = cred.user.uid;
      const userDoc = await getDoc( doc( db, 'users', userId ));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUsername( userData.username );
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