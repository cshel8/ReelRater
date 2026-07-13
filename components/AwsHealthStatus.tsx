import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { healthService, type HealthStatus } from '@/services/http/healthService';

export function AwsHealthStatus() {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setStatus(await healthService.get());
    } catch {
      setStatus(null);
      setError('Unable to reach the AWS API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>AWS API Status</Text>

      {loading ? (
        <ActivityIndicator accessibilityLabel="Checking AWS API" color="#007AFF" />
      ) : status ? (
        <View style={styles.details}>
          <Text style={styles.connected}>Connected</Text>
          <Text style={styles.detail}>App: {status.app}</Text>
          <Text style={styles.detail}>Served by: {status.served_by}</Text>
          <Text style={styles.detail}>Time: {new Date(status.time).toLocaleString()}</Text>
        </View>
      ) : (
        <Text style={styles.error}>{error}</Text>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={loadStatus}
        style={({ pressed }) => [
          styles.button,
          (pressed || loading) && styles.buttonMuted,
        ]}
      >
        <Text style={styles.buttonText}>Refresh</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E7FF',
    backgroundColor: '#F5F9FF',
  },
  heading: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#17233A',
  },
  details: {
    gap: 5,
  },
  connected: {
    marginBottom: 3,
    color: '#1B7F3A',
    fontWeight: '700',
  },
  detail: {
    color: '#33415C',
    fontSize: 13,
  },
  error: {
    color: '#B42318',
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  buttonMuted: {
    opacity: 0.55,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
