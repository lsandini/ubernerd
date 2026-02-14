import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { syncPacks, getLocalItems } from '../src/packs';
import { hasAttempt, syncAttempts, clearAllAttempts } from '../src/attempts';
import { getOrCreateNextDrop, clearSchedule } from '../src/drops';
import { requestPermissions } from '../src/notifications';
import { reschedule } from '../src/scheduler';

export default function Index() {
  const router = useRouter();
  const [totalCount, setTotalCount] = useState(0);
  const [attemptedCount, setAttemptedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadStats = useCallback(async (sync: boolean) => {
    try {
      setError(null);
      if (sync) {
        setSyncing(true);
        await syncPacks('medical', 'en');
        requestPermissions().then(() => reschedule('medical'));
      }
      const local = getLocalItems('medical');
      setTotalCount(local.length);
      let done = 0;
      for (const item of local) {
        if (hasAttempt(item.id)) done++;
      }
      setAttemptedCount(done);
    } catch (e: any) {
      setError(e.message || 'Failed to load questions');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadStats(true);
  }, [loadStats]);

  useFocusEffect(
    useCallback(() => {
      loadStats(false);
      syncAttempts();
    }, [loadStats])
  );

  const onStartDrop = () => {
    const drop = getOrCreateNextDrop('medical');
    if (!drop) {
      setError('No unattempted questions available for a drop');
      return;
    }
    router.push(`/drop?dropId=${drop.dropId}`);
  };

  const onReset = () => {
    clearAllAttempts();
    clearSchedule();
    loadStats(false);
  };

  const remaining = totalCount - attemptedCount;

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Medical Nerdology</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalCount}</Text>
            <Text style={styles.statLabel}>Questions</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{attemptedCount}</Text>
            <Text style={styles.statLabel}>Attempted</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: remaining > 0 ? '#22c55e' : '#888' }]}>
              {remaining}
            </Text>
            <Text style={styles.statLabel}>Remaining</Text>
          </View>
        </View>

        <Pressable
          style={[styles.dropBtn, remaining === 0 && styles.dropBtnDisabled]}
          onPress={onStartDrop}
          disabled={remaining === 0}
        >
          <Text style={styles.dropBtnText}>
            {remaining > 0 ? 'Start Drop (3 Questions)' : 'All Caught Up!'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
          onPress={() => loadStats(true)}
          disabled={syncing}
        >
          <Text style={styles.syncBtnText}>
            {syncing ? 'Syncing...' : 'Sync Questions'}
          </Text>
        </Pressable>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.footerBtn, pressed && styles.footerBtnPressed]}
            onPress={() => router.push('/settings')}
          >
            <Text style={styles.footerBtnText}>Settings</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.footerBtn, pressed && styles.footerBtnPressed]}
            onPress={() => router.push('/ladder')}
          >
            <Text style={styles.footerBtnText}>Ladder</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.footerBtn, pressed && styles.footerBtnPressed]}
            onPress={onReset}
          >
            <Text style={styles.footerBtnText}>Reset</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f23' },
  loadingText: { color: '#8888aa', fontSize: 16 },
  content: { padding: 24, paddingTop: 40, alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 32 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 40, width: '100%' },
  statBox: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: { fontSize: 28, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4 },

  dropBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  dropBtnDisabled: { backgroundColor: '#333', opacity: 0.6 },
  dropBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  syncBtn: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: { color: '#8888aa', fontSize: 14, fontWeight: '600' },

  footer: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingVertical: 32 },
  footerBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
  },
  footerBtnPressed: { opacity: 0.6 },
  footerBtnText: { color: '#4a6cf7', fontSize: 15, fontWeight: '600' },
  errorBanner: { backgroundColor: '#ef444433', padding: 12 },
  errorText: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
});
