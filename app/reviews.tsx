import { View, Text, StyleSheet } from 'react-native';

export default function Reviews() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Reviews</Text>
            <Text style={styles.subtitle}>Your movie reviews will appear here</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
    },
});
