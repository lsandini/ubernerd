import { useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

export default function Question() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Question {id}</Text>
      <Text style={styles.countdown}>3...2...1... (stub)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 18, fontWeight: '600' },
  countdown: { fontSize: 32, fontWeight: '700', marginTop: 24, color: '#4a6cf7' },
});
