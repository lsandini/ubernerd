import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quiz Gauntlet</Text>
      <Text style={styles.sub}>Welcome. Drops will appear when scheduled.</Text>
      <Link href="/settings" style={styles.link}>
        Go to Settings
      </Link>
      <Link href="/ladder" style={styles.link}>
        View Ladder
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  sub: { color: '#666' },
  link: { color: '#4a6cf7', fontSize: 16 },
});
