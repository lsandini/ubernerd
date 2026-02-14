import { useEffect, useState } from 'react';
import { View, Text, Button, Alert, StyleSheet } from 'react-native';
import { getOrCreateUuid, resetUuid } from '../src/identity';

export default function Settings() {
  const [uuid, setUuid] = useState<string | null>(null);

  useEffect(() => {
    getOrCreateUuid().then(setUuid);
  }, []);

  const reset = () => {
    Alert.alert('Reset UUID', 'This will reset your identity and ladder history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          const id = await resetUuid();
          setUuid(id);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Settings</Text>
      <Text style={styles.label}>UUID</Text>
      <Text selectable style={styles.uuid}>
        {uuid ?? 'loading...'}
      </Text>
      <Button title="Reset UUID" onPress={reset} color="#e74c3c" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  heading: { fontSize: 18, fontWeight: '600' },
  label: { fontSize: 14, color: '#888', marginTop: 8 },
  uuid: { fontFamily: 'monospace', fontSize: 13 },
});
