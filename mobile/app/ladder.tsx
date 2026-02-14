import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getLadder, type LadderEntry } from '../src/api';
import { syncAttempts } from '../src/attempts';
import { getOrCreateUuid } from '../src/identity';

type Period = 'day' | 'week' | 'month' | 'all';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'all', label: 'All Time' },
];

export default function Ladder() {
  const [entries, setEntries] = useState<LadderEntry[]>([]);
  const [period, setPeriod] = useState<Period>('week');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myUuid, setMyUuid] = useState<string | null>(null);
  const [myRank, setMyRank] = useState<LadderEntry | null>(null);

  const fetchLadder = useCallback(async (p: Period) => {
    try {
      setError(null);
      // Ensure UUID exists and local attempts reach the server before we query
      await syncAttempts();
      const [data, uuid] = await Promise.all([
        getLadder({ domain: 'medical', period: p }),
        getOrCreateUuid(),
      ]);
      setEntries(data.entries);
      setMyUuid(uuid);

      const me = data.entries.find((e) => e.uuid === uuid);
      setMyRank(me ?? null);
    } catch (e: any) {
      setError(e.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLadder(period);
  }, [period]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLadder(period);
  };

  const onPeriodChange = (p: Period) => {
    if (p === period) return;
    setPeriod(p);
  };

  const renderEntry = ({ item }: { item: LadderEntry }) => {
    const isMe = item.uuid === myUuid;
    return (
      <View style={[styles.row, isMe && styles.rowMe]}>
        <Text style={[styles.rank, isMe && styles.textMe]}>
          {item.rank <= 3 ? ['', '\u{1F947}', '\u{1F948}', '\u{1F949}'][item.rank] : `#${item.rank}`}
        </Text>
        <View style={styles.rowInfo}>
          <Text style={[styles.uuid, isMe && styles.textMe]} numberOfLines={1}>
            {isMe ? 'You' : item.uuid.slice(0, 8)}
          </Text>
          <Text style={styles.meta}>
            {item.numAttempts} answers · {(item.avgRtMs / 1000).toFixed(1)}s avg
          </Text>
        </View>
        <Text style={[styles.score, isMe && styles.textMe]}>
          {item.score.toLocaleString()}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading leaderboard...</Text>
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

      {/* Period tabs */}
      <View style={styles.tabs}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.tab, period === p.key && styles.tabActive]}
            onPress={() => onPeriodChange(p.key)}
          >
            <Text style={[styles.tabText, period === p.key && styles.tabTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* My rank card (if on the board) */}
      {myRank && (
        <View style={styles.myCard}>
          <Text style={styles.myLabel}>Your Rank</Text>
          <Text style={styles.myRank}>#{myRank.rank}</Text>
          <Text style={styles.myScore}>{myRank.score.toLocaleString()} pts</Text>
        </View>
      )}

      <FlatList
        data={entries}
        keyExtractor={(item) => item.uuid}
        renderItem={renderEntry}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4a6cf7"
            colors={['#4a6cf7']}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No entries yet.</Text>
            <Text style={styles.emptySubText}>Complete some drops to get on the board!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: '#8888aa', fontSize: 16 },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#4a6cf7' },
  tabText: { color: '#888', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  myCard: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#4a6cf711',
    borderWidth: 1,
    borderColor: '#4a6cf744',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  myLabel: { color: '#4a6cf7', fontSize: 12, fontWeight: '600' },
  myRank: { color: '#fff', fontSize: 24, fontWeight: '800' },
  myScore: { color: '#22c55e', fontSize: 16, fontWeight: '700', marginLeft: 'auto' },

  list: { paddingHorizontal: 16, paddingBottom: 32 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 12,
  },
  rowMe: {
    backgroundColor: '#4a6cf718',
    borderWidth: 1,
    borderColor: '#4a6cf744',
  },
  rank: { fontSize: 16, fontWeight: '700', color: '#888', width: 40, textAlign: 'center' },
  rowInfo: { flex: 1 },
  uuid: { color: '#ccc', fontSize: 14, fontWeight: '600' },
  meta: { color: '#666', fontSize: 11, marginTop: 2 },
  score: { color: '#22c55e', fontSize: 16, fontWeight: '700' },
  textMe: { color: '#fff' },

  errorBanner: { backgroundColor: '#ef444433', padding: 12 },
  errorText: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
  emptyText: { color: '#888', fontSize: 16 },
  emptySubText: { color: '#666', fontSize: 13, marginTop: 4 },
});
