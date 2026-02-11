import { View, Text, StyleSheet } from 'react-native';

export default function Ladder() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Ladder (stub)</Text>
      <Text style={styles.sub}>Coming soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 18, fontWeight: '600' },
  sub: { color: '#888', marginTop: 8 },
});
