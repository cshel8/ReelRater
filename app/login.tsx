import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';

export default function App() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = () => {
        
    }
    return (
        <View style = {styles.container}>
            <Text style = {styles.title}>Login</Text>
            <View style = {styles.label}>
                <Text>Username</Text>
            </View>
            <View style = {styles.box}>
                <TextInput placeholder = "Type here" value = {username} onChangeText = {text => setUsername(text)} style = {styles.input} />
            </View>
            <View style = {styles.label}>
                <Text>Password</Text>
            </View>
            <View style = {styles.box}>
                <TextInput placeholder = "Type here" value = {password} onChangeText = {text => setPassword(text)} style = {styles.input} />
            </View>
            <Pressable onPress = {handleLogin}>
                <Text>Login</Text>
            </Pressable>
        </View>
    )
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
    },
    box: {
      borderWidth: 1,
      borderColor: '#ccc',
      padding: 10,
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
    }
});