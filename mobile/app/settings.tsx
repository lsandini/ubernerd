import { useEffect, useState } from 'react';
import { Platform, View, Text, Button, Alert, StyleSheet } from 'react-native';

const UUID_KEY = 'ug_uuid';

// On web, fall back to localStorage. On native, use SecureStore.
async function getStored(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  return SecureStore.getItemAsync(key);
}

async function setStored(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
  await SecureStore.setItemAsync(key, value);
}

function generateUUID(): string {
  return crypto.randomUUID();
}

export default function Settings() {
  const [uuid, setUuid] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      let id = await getStored(UUID_KEY);
      if (!id) {
        id = generateUUID();
        await setStored(UUID_KEY, id);
      }
      setUuid(id);
    })();
  }, []);

  const reset = () => {
    Alert.alert('Reset UUID', 'This will reset your identity and ladder history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          const id = generateUUID();
          await setStored(UUID_KEY, id);
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
