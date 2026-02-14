import { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, Alert, StyleSheet } from 'react-native';
import { getOrCreateUuid, resetUuid } from '../src/identity';
import { getAlias, setAlias } from '../src/api';

export default function Settings() {
  const [uuid, setUuid] = useState<string | null>(null);
  const [alias, setAliasText] = useState('');
  const [savedAlias, setSavedAlias] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOrCreateUuid().then((id) => {
      setUuid(id);
      getAlias(id)
        .then((r) => {
          const a = r.alias ?? '';
          setAliasText(a);
          setSavedAlias(a);
        })
        .catch(() => {});
    });
  }, []);

  const saveAlias = async () => {
    if (!uuid) return;
    setSaving(true);
    try {
      const r = await setAlias(uuid, alias.trim());
      const a = r.alias ?? '';
      setAliasText(a);
      setSavedAlias(a);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save alias');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    Alert.alert('Reset UUID', 'This will reset your identity and ladder history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          const id = await resetUuid();
          setUuid(id);
          setAliasText('');
          setSavedAlias('');
        },
      },
    ]);
  };

  const aliasChanged = alias.trim() !== savedAlias;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Settings</Text>

      <Text style={styles.label}>Public Alias</Text>
      <TextInput
        style={styles.input}
        value={alias}
        onChangeText={setAliasText}
        placeholder="Enter a display name (2–20 chars)"
        placeholderTextColor="#666"
        maxLength={20}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {aliasChanged && (
        <Button title={saving ? 'Saving...' : 'Save Alias'} onPress={saveAlias} disabled={saving} />
      )}

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
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: '#000',
    backgroundColor: '#fff',
  },
});
